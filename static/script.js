// Reference to the static text box for behavior notes
const behaviourTextBox = document.getElementById("static_text_box");

// Array of animal behaviour notes
const behaviourNotes = [
  "Animals are most active at dawn and dusk.",
  "Weather conditions significantly impact animal movement.",
  "Animals are active feeding on new spring growth right now.",
  "Tahr have been sighted feeding around 900m elevation.",
  "Stags are feeding in open country within bachelor groups.",
  "Hinds are preferring dense vegetation as they birth and raise their fawns."
];

// Set an interval to cycle through the notes every 5 seconds (5000 ms)
let noteIndex = 0;
setInterval(() => {
  behaviourTextBox.textContent = behaviourNotes[noteIndex];
  noteIndex = (noteIndex + 1) % behaviourNotes.length;
}, 5000);

// Initialize the map on window load
window.addEventListener('load', function() {
    console.log('Window loaded and script running');

    // Initialize the map
    initializeMap();

    // Add event listener for the menu toggle button
    const menuToggleBtn = document.getElementById('menuToggle');
    const sideMenu = document.getElementById('sideMenu');
    const container = document.getElementById('container');

    menuToggleBtn.addEventListener('click', function() {
        sideMenu.classList.toggle('open');
        container.classList.toggle('menu-open'); // Toggle 'menu-open' class on #container
    });

    // Adjust the map size after the transition ends
    sideMenu.addEventListener('transitionend', function(e) {
        if (e.propertyName === 'width') {
            map.invalidateSize();
        }
    });
});

// Initialize the map and set its view to New Zealand with a zoom level
const map = L.map("map").setView([-43.446754, 171.592242], 7);

// Add a tile layer from OpenStreetMap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

// Create layer groups for each type of data
const animalLayerGroup = L.layerGroup();
const tempLayerGroup = L.layerGroup();
const rainLayerGroup = L.layerGroup();
const windLayerGroup = L.layerGroup();
const cloudLayerGroup = L.layerGroup();
const redDeerLayerGroup = L.layerGroup();
const vegetationLayerGroup = L.layerGroup();

// Variables to store date and time period indices
let currentDateIndex = 0;
let currentTimeIndex = 0;

// Define the time periods as strings with leading zeros
const timePeriods = ['01', '04', '07', '10', '13', '16', '19', '22'];

// Function to get an array of dates in yymmdd format for the next 4 days
function getDatesArray(numDays) {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < numDays; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yymmdd = yy + mm + dd;
        dates.push({ 
            date: `${yy}-${mm}-${dd}`, 
            readable: `${date.toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            })}`, 
            yymmdd 
        });
    }
    return dates;
}

// Get the unique dates
const uniqueDates = getDatesArray(4); // 4 days' worth of files

// Get today's date and format it
const today = new Date();
const yy = String(today.getFullYear()).slice(-2);
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const todayYymmdd = yy + mm + dd;

// Find the index of today's date in uniqueDates
currentDateIndex = uniqueDates.findIndex(dateObj => dateObj.yymmdd === todayYymmdd);
if (currentDateIndex === -1) {
    // If today's date is not found, default to the first date
    currentDateIndex = 0;
}

// Update the displayed date information
function updateDisplayedDate() {
    const dateDisplay = document.getElementById("day-time-text");
    const selectedDate = uniqueDates[currentDateIndex];
    dateDisplay.textContent = `${selectedDate.readable} - Time: ${timePeriods[currentTimeIndex]}:00`;
}

// Function to plot data layers
const plotDataLayer = async (layerGroup, layerType, dateIndex, timeIndex) => {
    layerGroup.clearLayers(); // Clear existing layers

    const selectedDate = uniqueDates[dateIndex].yymmdd; // Use the yymmdd format
    const selectedTimePeriod = timePeriods[timeIndex];

    // Construct the filename based on layer type
    let filename;
    if (layerType === 'animal_behaviour') {
        filename = `animal/animal_behaviour_${selectedDate}_${selectedTimePeriod}.geojson`;
    } else if (layerType === 'temperature') {
        filename = `weather/temperature_${selectedDate}_${selectedTimePeriod}.geojson`;
    } else if (layerType === 'rain') {
        filename = `weather/rain_${selectedDate}_${selectedTimePeriod}.geojson`;
    } else if (layerType === 'wind_speed') {
        filename = `weather/wind_speed_${selectedDate}_${selectedTimePeriod}.geojson`;
    } else if (layerType === 'cloud_cover') {
        filename = `weather/cloud_cover_${selectedDate}_${selectedTimePeriod}.geojson`;
    } else if (layerType === 'red_deer_location') {
        filename = `animal/red_deer_location.geojson`;
    } else if (layerType === 'vegetation') {
        filename = `vegetation/vegetation_native.geojson`;
    } else {
        console.error(`Unknown layer type: ${layerType}`);
        return;
    }

    // Fetch the GeoJSON data
    try {
        const res = await fetch(`/data/static/${filename}`);  
        if (!res.ok) {
            console.warn(`File not found: ${filename}`);
            return;
        }
        const data = await res.json();

        // Create and add GeoJSON layer to the specified layer group
        const geoJsonLayer = L.geoJSON(data, {
            style: function (feature) {
                return {
                    color: feature.properties.color || '#ff0000',
                    fillColor: feature.properties.color || '#ff0000',
                    weight: 0.5,
                    opacity: 0.25,
                    fillOpacity: 0.25,
                };
            },
            onEachFeature: function (feature, layer) {
                const props = feature.properties;
                const popupContent = `
                    <strong>${layerType.replace('_', ' ')} Data</strong><br>
                    Date: ${selectedDate}<br>
                    Time Period: ${selectedTimePeriod}:00<br>
                    ${Object.keys(props).map(key => `${key}: ${props[key]}`).join('<br>')}
                `;
                layer.bindPopup(popupContent);
            },
        });

        // Add the layer to the map
        layerGroup.addLayer(geoJsonLayer);
    } catch (err) {
        console.error(`Error fetching ${layerType} data for ${filename}:`, err);
    }
};

// Helper function to remove all layers from the map
const removeAllLayers = () => {
    const allLayerGroups = [
        animalLayerGroup,
        tempLayerGroup,
        rainLayerGroup,
        windLayerGroup,
        cloudLayerGroup,
        redDeerLayerGroup,
        vegetationLayerGroup
    ];
    allLayerGroups.forEach(layerGroup => {
        map.removeLayer(layerGroup);
    });
};

// Function to get the closest time index based on current hour
function getClosestTimeIndex(currentHour) {
    const timePeriodsNumbers = timePeriods.map(tp => parseInt(tp));
    for (let i = timePeriodsNumbers.length - 1; i >= 0; i--) {
        if (currentHour >= timePeriodsNumbers[i]) {
            return i;
        }
    }
    // If currentHour is less than all time periods, return 0
    return 0;
}

// Function to set up layer toggles
const setupLayerToggles = () => {
    // Select the layer buttons inside the sideMenu
    const layerButtons = document.querySelectorAll('#sideMenu input[name="layer-toggle"]');

    layerButtons.forEach(button => {
        button.addEventListener('change', async (event) => {
            // Remove all layers from the map
            removeAllLayers();

            const selectedLayerId = event.target.id;

            if (selectedLayerId !== 'none') {
                const layerGroup = getLayerGroupById(selectedLayerId);
                if (layerGroup) {
                    // Layer is selected, plot the data for the current date and time period
                    await plotDataLayer(layerGroup, selectedLayerId, currentDateIndex, currentTimeIndex);
                    map.addLayer(layerGroup); // Add the layer group to the map
                }
            }
            // If 'none' is selected, no layers are displayed

            // Optionally, close the side menu after selection
            // const sideMenu = document.getElementById('sideMenu');
            // sideMenu.classList.remove('open');
            // document.getElementById('container').classList.remove('menu-open');
        });
    });
};

// Helper function to get the corresponding layer group by radio button ID
const getLayerGroupById = (id) => {
    switch (id) {
        case 'animal_behaviour':
            return animalLayerGroup;
        case 'temperature':
            return tempLayerGroup;
        case 'rain':
            return rainLayerGroup;
        case 'wind_speed':
            return windLayerGroup;
        case 'cloud_cover':
            return cloudLayerGroup;
        case 'red_deer_location':
            return redDeerLayerGroup;
        case 'vegetation':
            return vegetationLayerGroup;
        default:
            console.error(`Unknown layer group for ID: ${id}`);
            return null;
    }
};

// Function to update layers for the selected date and time
const updateLayersForSelectedDateAndTime = async (dateIndex, timeIndex) => {
    const layerSelections = document.querySelectorAll('input[name="layer-toggle"]:checked');

    // Since only one layer can be checked at a time, we can safely remove all layers
    removeAllLayers();

    if (layerSelections.length > 0) {
        const selection = layerSelections[0];
        const layerGroup = getLayerGroupById(selection.id);
        if (layerGroup) {
            await plotDataLayer(layerGroup, selection.id, dateIndex, timeIndex);
            map.addLayer(layerGroup); // Ensure the layer group is added to the map
        }
    }
};

// Close side menu when clicking outside
window.addEventListener('click', function(event) {
    const sideMenu = document.getElementById('sideMenu');
    const menuToggleBtn = document.getElementById('menuToggle');
    const container = document.getElementById('container');
    
    // Check if the click is outside the side menu and the toggle button
    if (!sideMenu.contains(event.target) && !menuToggleBtn.contains(event.target)) {
        sideMenu.classList.remove('open');
        container.classList.remove('menu-open');
    }
});

// **Observation Recording Functionality Starts Here**

// Variable to store the current user's ID received via postMessage
let currentUserId = null;

// Listen for messages from the parent window (Wix)
window.addEventListener('message', (event) => {
    // For security, verify the origin of the message
    const allowedOrigin = 'https://www.wildvisionhunt.com'; // Replace with your actual Wix site URL
    if (event.origin !== allowedOrigin) {
        console.warn('Origin not allowed:', event.origin);
        return;
    }

    const data = event.data;
    if (data.type === 'USER_ID') {
        currentUserId = data.userId;
        console.log('Received User ID:', currentUserId);
    }
}, false);


// Function to toggle observation mode
function toggleObservationMode() {
    observationMode = !observationMode; // Toggle the flag

    const addObservationBtn = document.getElementById('addObservationBtn');

    if (observationMode) {
        // Activate observation mode
        addObservationBtn.classList.add('active');
        addObservationBtn.textContent = 'Cancel Observation';
        alert('Observation mode activated. Click on the map to add observations.');
    } else {
        // Deactivate observation mode
        addObservationBtn.classList.remove('active');
        addObservationBtn.textContent = 'Add Animal Observation';
    }
}

// Initialize observation mode flag
let observationMode = false;

// Add event listener for the "Add Observation" button
document.getElementById('addObservationBtn').addEventListener('click', toggleObservationMode);

// Modify the existing map click handler to include observation recording
map.on('click', function(e) {
    if (!observationMode) {
        // If observation mode is not active, do nothing or handle other click events
        return;
    }

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // Close any existing popup before opening a new one
    map.closePopup();
    
    // Create a popup with a form
    const popup = L.popup()
        .setLatLng(e.latlng)
        .setContent(`
            <div class="observation-form">
                <h3>Add Observation</h3>
                <form id="obsForm">
                    <label for="species">Species:</label>
                    <input type="text" id="species" name="species" required>
                    
                    <label for="gender">Gender:</label>
                    <select id="gender" name="gender" required>
                        <option value="" disabled selected>Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Unknown">Unknown</option>
                    </select>
                    
                    <label for="quantity">Quantity:</label>
                    <input type="number" id="quantity" name="quantity" min="1" required>
                    
                    <button type="submit">Submit</button>
                </form>
            </div>
        `)
        .openOn(map);
    
    // Handle form submission
    document.getElementById('obsForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const species = document.getElementById('species').value.trim();
        const gender = document.getElementById('gender').value;
        const quantity = document.getElementById('quantity').value;
        
        if (!species || !gender || !quantity) {
            alert('Please fill in all fields.');
            return;
        }
        
        if (!currentUserId) {
            alert('User not logged in. Please log in to submit observations.');
            return;
        }
        
        // Prepare data to send
        const data = {
            species: species,
            gender: gender,
            quantity: parseInt(quantity),
            latitude: lat,
            longitude: lng,
            userId: currentUserId
        };
        
        try {
            const response = await submitObservation(data);
            
            if (response.status === 'success') {
                alert('Observation added successfully!');
                // Add marker to the map
                addObservationMarker({
                    species: species,
                    gender: gender,
                    quantity: quantity,
                    latitude: lat,
                    longitude: lng,
                    timestamp: new Date().toLocaleString()
                });
                map.closePopup();
                // Optionally, deactivate observation mode after submission
                toggleObservationMode();
            } else {
                alert('Error adding observation: ' + response.message);
            }
        } catch (error) {
            console.error('Error submitting observation:', error);
            alert('An error occurred while submitting your observation.');
        }
    });
});

// Function to add observation marker to the map
function addObservationMarker(obs) {
    const marker = L.marker([obs.latitude, obs.longitude]).addTo(map);
    const popupContent = `
        <strong>Observation</strong><br>
        Species: ${obs.species}<br>
        Gender: ${obs.gender}<br>
        Quantity: ${obs.quantity}<br>
        Timestamp: ${obs.timestamp}
    `;
    marker.bindPopup(popupContent);
}

// Function to fetch and display all observations on map load
async function fetchAllObservations() {
    try {
        const response = await fetch('/api/get_observations', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(observationData)
        });
        const data = await response.json();
        if (data.status === 'success') {
            data.observations.forEach(obs => {
                addObservationMarker(obs);
            });
        } else {
            console.error('Failed to fetch observations:', data.message);
        }
    } catch (error) {
        console.error('Error fetching observations:', error);
    }
}

// Function to submit observation data to the backend
async function submitObservation(observationData) {
    try {
        const response = await fetch('/api/add_observation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': '592a7f2d37881d292b6da3dacf16508628afc77dcf08c2deb196497e39f24bb6' // Securely manage your API key
            },
            body: JSON.stringify(observationData)
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error submitting observation:', error);
        throw error;
    }
}

// Function to fetch and display all observations when initializing the map
function initializeMap() {
    console.log('initializeMap called');

    const dateTimeSlider = document.getElementById('DateTimeSlider');
    const totalPeriods = uniqueDates.length * timePeriods.length;

    if (totalPeriods > 0) {
        dateTimeSlider.max = totalPeriods - 1; // Set the slider's max value

        // Get today's date and time
        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayYymmdd = yy + mm + dd;

        // Find currentDateIndex
        currentDateIndex = uniqueDates.findIndex(dateObj => dateObj.yymmdd === todayYymmdd);
        if (currentDateIndex === -1) {
            // If today's date is not in uniqueDates, default to 0
            currentDateIndex = 0;
        }

        // Get current time index
        const currentHour = today.getHours();
        currentTimeIndex = getClosestTimeIndex(currentHour);

        // Compute combined index
        let combinedIndex = currentDateIndex * timePeriods.length + currentTimeIndex;

        // Ensure combinedIndex is within the slider's range
        if (combinedIndex > dateTimeSlider.max) {
            combinedIndex = dateTimeSlider.max;
        }

        dateTimeSlider.value = combinedIndex;

        updateDisplayedDate(); // Update the displayed date

        // Plot layers based on the current selection
        updateLayersForSelectedDateAndTime(currentDateIndex, currentTimeIndex);
    } else {
        const dateDisplay = document.getElementById("day-time-text");
        dateDisplay.textContent = 'No Data Available';
    }

    // Set up layer toggles
    setupLayerToggles();

    // Add event listener for the date-time slider
    dateTimeSlider.addEventListener('input', () => {
        const combinedIndex = parseInt(dateTimeSlider.value);
        currentDateIndex = Math.floor(combinedIndex / timePeriods.length);
        currentTimeIndex = combinedIndex % timePeriods.length;

        updateDisplayedDate();
        // Update layers for the new date and time
        updateLayersForSelectedDateAndTime(currentDateIndex, currentTimeIndex);
    });

    // Fetch and display all observations
    fetchAllObservations();
}
