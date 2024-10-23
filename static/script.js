// // Reference to the static text box for behavior notes
// const behaviourTextBox = document.getElementById("static_text_box");

// // Array of animal behaviour notes
// const behaviourNotes = [
//   "Animals are most active at dawn and dusk.",
//   "Weather conditions significantly impact animal movement.",
//   "Animals are active feeding on new spring growth right now.",
//   "Tahr have been sighted feeding around 900m elevation.",
//   "Stags are feeding in open country within bachelor groups.",
//   "Hinds are preferring dense vegetation as they birth and raise their fawns."
// ];

// // Set an interval to cycle through the notes every 5 seconds (5000 ms)
// let noteIndex = 0;
// setInterval(() => {
//   if (behaviourTextBox) {
//     behaviourTextBox.textContent = behaviourNotes[noteIndex];
//     noteIndex = (noteIndex + 1) % behaviourNotes.length;
//   }
// }, 5000);

// ---------------------- Modal Handling Starts Here ---------------------- //

// Get modal elements
const signupModal = document.getElementById('signupModal');
const loginModal = document.getElementById('loginModal');

// Get buttons that open the modals
const openSignupBtn = document.getElementById('openSignup');
const openLoginBtn = document.getElementById('openLogin');

// Get <span> elements that close the modals
const closeSignupSpan = document.getElementById('closeSignup');
const closeLoginSpan = document.getElementById('closeLogin');

// Function to open modal
function openModal(modal) {
    modal.style.display = 'block';
}

// Function to close modal
function closeModal(modal) {
    modal.style.display = 'none';
}

// When the user clicks the open buttons, open the respective modals
if (openSignupBtn) {
    openSignupBtn.addEventListener('click', () => {
        openModal(signupModal);
    });
}

if (openLoginBtn) {
    openLoginBtn.addEventListener('click', () => {
        openModal(loginModal);
    });
}

// When the user clicks on <span> (x), close the respective modals
if (closeSignupSpan) {
    closeSignupSpan.addEventListener('click', () => {
        closeModal(signupModal);
    });
}

if (closeLoginSpan) {
    closeLoginSpan.addEventListener('click', () => {
        closeModal(loginModal);
    });
}

// When the user clicks anywhere outside of the modal, close it
window.addEventListener('click', (event) => {
    if (event.target === signupModal) {
        closeModal(signupModal);
    }
    if (event.target === loginModal) {
        closeModal(loginModal);
    }
});

// ---------------------- Existing Code Continues ---------------------- //

// Initialize the map and set its view to New Zealand with a zoom level
const map = L.map("map").setView([-43.446754, 171.592242], 7);

const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
});

// Add the topographic layer to the map by default
topo.addTo(map);

// Create layer groups for each type of data
const animalLayerGroup = L.layerGroup();
const tempLayerGroup = L.layerGroup();
const rainLayerGroup = L.layerGroup();
const windLayerGroup = L.layerGroup();
const cloudLayerGroup = L.layerGroup();
const redDeerLayerGroup = L.layerGroup();
// const vegetationLayerGroup = L.layerGroup();

// Initialize the MarkerClusterGroup once
const markers = L.markerClusterGroup();

// Add the MarkerClusterGroup to the map
map.addLayer(markers);

// FeatureGroup to store drawn layers (global scope)
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Draw Control - but do not add it to the map yet
const drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems,
        edit: false,
        remove: false
    },
    draw: {
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
        polygon: {
            allowIntersection: false,
            showArea: true,
            shapeOptions: {
                color: '#FF5722'
            }
        }
    }
});

const drawPolygonBtn = document.getElementById('drawPolygonBtn');

drawPolygonBtn.addEventListener('click', () => {
    // Add the draw control to the map
    map.addControl(drawControl);

    // Programmatically start the polygon drawing
    new L.Draw.Polygon(map, drawControl.options.draw.polygon).enable();

    // Optionally, disable the button to prevent multiple clicks
    drawPolygonBtn.disabled = true;
});

// Listen for the creation of a new polygon
map.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;

    // Add the new polygon to the feature group
    drawnItems.addLayer(layer);

    // You can access the polygon's coordinates
    const coordinates = layer.getLatLngs();

    // Re-enable the button
    drawPolygonBtn.disabled = false;

    // Optional: Prompt the user to name the favorite spot
    const spotName = prompt("Enter a name for your favorite spot:");

    // Store the polygon data as needed
    const spotData = {
        name: spotName,
        coordinates: coordinates
    };

    // Get the access token
    const token = getAccessToken();
    if (!token) {
        alert('You must be logged in to save favorite spots.');
        // Remove the layer if user is not logged in
        drawnItems.removeLayer(layer);
        return;
    }

    // Send the spot data to the server
    fetch('/wildvision/spots', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(spotData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Spot saved:', data);
        if (data.status === 'success') {
            // Assign the spotId to the layer
            layer.spotId = data.id;

            // Bind a popup with the spot's name and Edit/Delete buttons
            const popupContent = `
                <div>
                    <b>${spotName}</b><br>
                    <button class="edit-spot-btn" data-id="${data.id}" data-name="${spotName}">Edit</button>
                    <button class="delete-spot-btn" data-id="${data.id}">Delete</button>
                </div>
            `;
            layer.bindPopup(popupContent);

            // Open the popup
            layer.openPopup();
        } else {
            alert('Error saving spot: ' + data.message);
            // Remove the layer from the map
            drawnItems.removeLayer(layer);
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('An error occurred while saving the spot.');
        // Remove the layer from the map
        drawnItems.removeLayer(layer);
    });
});

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
    if (dateDisplay) {
        const selectedDate = uniqueDates[currentDateIndex];
        dateDisplay.textContent = `${selectedDate.readable} - Time: ${timePeriods[currentTimeIndex]}:00`;
    }
}

// Function to plot data layers
const plotDataLayer = async (layerGroup, layerType, dateIndex, timeIndex) => {
    layerGroup.clearLayers(); // Clear existing layers

    const selectedDate = uniqueDates[dateIndex].yymmdd; // Use the yymmdd format
    const selectedTimePeriod = timePeriods[timeIndex];

    // Construct the filename based on layer type
    let filename;
    if (layerType === 'animal_behaviour') {
        filename = `static/animal/animal_behaviour_${selectedDate}_${selectedTimePeriod}.geojson`;
    } else if (layerType === 'temperature') {
        filename = `static/weather/temperature_${selectedDate}_${selectedTimePeriod}.geojson`;
    } else if (layerType === 'rain') {
        filename = `static/weather/rain_${selectedDate}_${selectedTimePeriod}.geojson`;
    } else if (layerType === 'wind_speed') {
        filename = `static/weather/wind_speed_${selectedDate}_${selectedTimePeriod}.geojson`;
    } else if (layerType === 'cloud_cover') {
        filename = `static/weather/cloud_cover_${selectedDate}_${selectedTimePeriod}.geojson`;
    } else if (layerType === 'red_deer_location') {
        filename = `static/animal/red_deer_location.geojson`;
    // } else if (layerType === 'vegetation') {
    //     filename = `vegetation/vegetation_native.geojson`;
    } else {
        console.error(`Unknown layer type: ${layerType}`);
        return;
    }

    // Fetch the GeoJSON data
    try {
        const res = await fetch(`/data/${filename}`, { // Adjusted to match backend route
            headers: {
                'Authorization': `Bearer ${getAccessToken()}`
            }
        });  
        if (!res.ok) {
            console.warn(`File not found or unauthorized: ${filename}`);
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
                 if (layerType === 'red_deer_location.geojson') {
                    // Map abundance levels to colours
                    let abundance = feature.properties.abundance;
                    let color;
                    if (abundance === 'H') {
                        color = '#FF0000'; // Red for High
                    } else if (abundance === 'M') {
                        color = '#FFA500'; // Orange for Medium
                    } else if (abundance === 'L') {
                        color = '#008000'; // Green for Low
                    } else {
                        color = '#808080'; // Gray for unknown abundance
                    }
                    styleOptions.color = color;
                    styleOptions.fillColor = color;
                } else {
                    // Use default or existing properties
                    styleOptions.color = feature.properties.color || '#ff0000';
                    styleOptions.fillColor = feature.properties.color || '#ff0000';
                }

                return styleOptions;
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
        // vegetationLayerGroup
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
        // case 'vegetation':
        //     return vegetationLayerGroup;
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
    const map_container = document.getElementById('map_container');
    
    // Check if the click is outside the side menu and the toggle button
    if (!sideMenu.contains(event.target) && !menuToggleBtn.contains(event.target)) {
        sideMenu.classList.remove('open');
        map_container.classList.remove('menu-open');
    }
});

// **Observation Recording Functionality Starts Here**

// Variable to store the current user's ID received via JWT
let currentUserId = null;

// Function to decode JWT and extract user ID
function decodeJWT(token) {
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        return decoded.sub; // Assuming 'sub' contains userId
    } catch (e) {
        console.error('Failed to decode JWT:', e);
        return null;
    }
}

// Function to get JWT token from localStorage
function getAccessToken() {
    return localStorage.getItem('access_token');
}

// Initialize observation mode flag
let observationMode = false;

// Add event listener for the "Add Observation" button
document.getElementById('addObservationBtn').addEventListener('click', toggleObservationMode);

// Function to toggle observation mode
function toggleObservationMode() {
    observationMode = !observationMode; // Toggle the flag

    const addObservationBtn = document.getElementById('addObservationBtn');

    if (observationMode) {
        addObservationBtn.classList.add('active');
        addObservationBtn.textContent = 'Cancel Observation';
        alert('Observation mode activated. Click on the map to add observations.');
    } else {
        addObservationBtn.classList.remove('active');
        addObservationBtn.textContent = 'Add Animal Observation';
    }
}

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
    
    // Create a unique ID for the observation form
    const uniqueFormId = `obsForm-${Date.now()}`;
    
    // Create a popup with a form
    const popup = L.popup()
        .setLatLng(e.latlng)
        .setContent(`
            <div class="observation-form">
                <h3>Add Observation</h3>
                <form id="${uniqueFormId}">
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
    document.getElementById(uniqueFormId).addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent the default form submission behavior
        
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
            longitude: lng
            // userId is handled server-side via JWT
        };
        
        try {
            const response = await submitObservation(data);
            
            if (response.status === 'success') {
                alert('Observation added successfully!');
                // Add marker to the map
                addObservationMarker({
                    id: response.observation.id, // Ensure the ID is set correctly
                    species: species,
                    gender: gender,
                    quantity: quantity,
                    latitude: lat,
                    longitude: lng,
                    timestamp: new Date().toISOString()
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

// Function to add an observation marker
function addObservationMarker(obs) {
    // Check for required properties
    if (!obs.latitude || !obs.longitude) {
        console.warn('Observation missing required properties:', obs);
        return; // Skip this observation
    }

    // Use existing 'id' or generate a temporary one
    const observationId = obs.id || `temp-${Date.now()}`;
    const observationTimestamp = obs.timestamp ? new Date(obs.timestamp).toLocaleString() : 'N/A';
    
    console.log(`Adding observation marker for ID: ${observationId}`);
    const marker = L.marker([obs.latitude, obs.longitude]);

    // Construct popup content using classes and data attributes
    const popupContent = `
        <div class="popup-content">
            <strong>Observation ID: ${observationId}</strong><br>
            Species: ${obs.species || 'N/A'}<br>
            Gender: ${obs.gender || 'N/A'}<br>
            Quantity: ${obs.quantity || 'N/A'}<br>
            Timestamp: ${observationTimestamp}<br><br>
            <button class="edit-btn" data-id="${observationId}">Edit</button>
            <button class="delete-btn" data-id="${observationId}">Delete</button>
        </div>
    `;
    marker.bindPopup(popupContent);

    // Attach event listeners when the popup is opened
    marker.on('popupopen', function() {
        console.log(`Popup opened for observation ID: ${observationId}`);
        const popupElement = marker.getPopup().getElement().openPopup();
        if (popupElement) {
            const editBtn = popupElement.querySelector('.edit-btn');
            const deleteBtn = popupElement.querySelector('.delete-btn');

            if (editBtn) {
                editBtn.addEventListener('click', function() {
                    console.log(`Edit button clicked for observation ID: ${observationId}`);
                    openEditModal(observationId, obs.species, obs.gender, obs.quantity, obs.latitude, obs.longitude);
                });
            } else {
                console.warn(`Edit button not found for observation ID: ${observationId}`);
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', function() {
                    console.log(`Delete button clicked for observation ID: ${observationId}`);
                    confirmDeleteObservation(observationId);
                });
            } else {
                console.warn(`Delete button not found for observation ID: ${observationId}`);
            }
        } else {
            console.warn(`Popup element not found for observation ID: ${observationId}`);
        }
    });

    // Add marker to the cluster group
    markers.addLayer(marker);
}

// Toggle Markers Button
const toggleMarkersBtn = document.getElementById('toggleMarkersBtn');
let markersVisible = true;

toggleMarkersBtn.addEventListener('click', () => {
    if (markersVisible) {
        map.removeLayer(markers);
        toggleMarkersBtn.textContent = 'Show Markers';
    } else {
        map.addLayer(markers);
        toggleMarkersBtn.textContent = 'Hide Markers';
    }
    markersVisible = !markersVisible;
});

// Function to fetch and display all observations on map load
async function fetchAllObservations() {
    try {
        const response = await fetch('/api/get_observations', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAccessToken()}`
            }
        });
        const data = await response.json();
        console.log('Fetched Observations:', data);
        if (data.status === 'success') {
            data.observations.forEach(obs => {
                console.log('Adding marker for observation:', obs);
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
        const token = getAccessToken();
        if (!token) {
            alert('You must be logged in to add an observation.');
            throw new Error('No access token found.');
        }

        const response = await fetch('/api/add_observation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
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

// Function to initialize the map and set up UI
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
        if (dateDisplay) {
            dateDisplay.textContent = 'No Data Available';
        }
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
}


// Variable to keep track of spots visibility
let spotsVisible = true;

// Toggle Favorite Spots Button
const toggleSpotsBtn = document.getElementById('toggleSpotsBtn');

// Add event listener to the Toggle Spots button
toggleSpotsBtn.addEventListener('click', () => {
    if (spotsVisible) {
        map.removeLayer(drawnItems);
        toggleSpotsBtn.textContent = 'Show Favorite Spots';
    } else {
        map.addLayer(drawnItems);
        toggleSpotsBtn.textContent = 'Hide Favorite Spots';
    }
    spotsVisible = !spotsVisible;
});

// Function to fetch favorite spots and display them on the map
function fetchFavoriteSpots() {
    const token = getAccessToken();
    if (!token) {
        console.warn('User is not logged in.');
        return;
    }

    fetch('/wildvision/spots', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch favorite spots.');
        }
        return response.json();
    })
    .then(data => {
        // Clear existing spots from drawnItems
        drawnItems.clearLayers();

        // data should be an array of spots
        data.forEach(spot => {
            // Create a polygon layer and add it to the map
            const polygon = L.polygon(spot.coordinates, {
                color: '#FF5722'
            });

            // Store the spotId in the polygon
            polygon.spotId = spot.id;

            // Bind a popup with the spot's name and Edit/Delete buttons
            const popupContent = `
                <div>
                    <b>${spot.name}</b><br>
                    <button class="edit-spot-btn" data-id="${spot.id}" data-name="${spot.name}">Edit</button>
                    <button class="delete-spot-btn" data-id="${spot.id}">Delete</button>
                </div>
            `;
            polygon.bindPopup(popupContent);

            // Add the polygon to the drawnItems group
            drawnItems.addLayer(polygon);
        });

        // Ensure the drawnItems layer group is added to the map if spots are visible
        if (spotsVisible && !map.hasLayer(drawnItems)) {
            map.addLayer(drawnItems);
        }
    })
    .catch(error => {
        console.error('Error fetching favorite spots:', error);
    });
}

// Initialize the map on window load
window.addEventListener('load', function() {
    console.log('Window loaded and script running');

    // Initialize the map
    initializeMap();

    // Add event listener for the menu toggle button
    const menuToggleBtn = document.getElementById('menuToggle');
    const sideMenu = document.getElementById('sideMenu');
    const map_container = document.getElementById('map_container');

    menuToggleBtn.addEventListener('click', function() {
        sideMenu.classList.toggle('open');
        map_container.classList.toggle('menu-open'); // Toggle 'menu-open' class on #map_container
    });

    // Adjust the map size after the transition ends
    sideMenu.addEventListener('transitionend', function(e) {
        if (e.propertyName === 'width') {
            map.invalidateSize();
        }
    });

    // Fetch and display all observations and favorite spots if user is logged in
    const token = getAccessToken();
    if (token) {
        currentUserId = decodeJWT(token);
        fetchAllObservations();
        fetchFavoriteSpots();
    }
});

// ---------------------- Modal Handling Continues ---------------------- //

// Function to display messages in modals
function displayMessage(modalType, message, isSuccess) {
    const messageDiv = document.getElementById(`${modalType}Message`);
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.style.color = isSuccess ? 'green' : 'red';
    }
}

// Handle Signup Form Submission
document.getElementById('signupForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    
    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayMessage('signup', data.message, true);
            document.getElementById('signupForm').reset();
            // Optionally, close the modal after a delay
            setTimeout(() => {
                closeModal(signupModal);
            }, 2000);
        } else {
            displayMessage('signup', data.message, false);
        }
    } catch (error) {
        console.error('Signup Error:', error);
        displayMessage('signup', 'An error occurred. Please try again.', false);
    }
});

// Handle Login Form Submission
document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayMessage('login', 'Login successful!', true);
            document.getElementById('loginForm').reset();
            // Store the access token (for example, in localStorage)
            localStorage.setItem('access_token', data.access_token);
            // Optionally, close the modal after a delay
            setTimeout(() => {
                closeModal(loginModal);
                // Optionally, refresh the page or update the UI to reflect logged-in state
                currentUserId = decodeJWT(data.access_token); // Set currentUserId
                fetchAllObservations(); // Fetch observations now that the user is logged in
                fetchFavoriteSpots();    // Fetch favorite spots
            }, 2000);
        } else {
            displayMessage('login', data.message, false);
        }
    } catch (error) {
        console.error('Login Error:', error);
        displayMessage('login', 'An error occurred. Please try again.', false);
    }
});

// Function to check if user is authenticated
function isAuthenticated() {
    const token = getAccessToken();
    // Basic check: token exists
    // For better security, you might want to decode and verify the token's expiration
    return !!token;
}

// Automatically open login modal if user is not authenticated
window.addEventListener('load', () => {
    if (!isAuthenticated()) {
        openModal(loginModal);
    }
});

// Function to open the Edit Modal with pre-filled data
function openEditModal(id, species, gender, quantity, latitude, longitude) {
    document.getElementById('editObservationId').value = id;
    document.getElementById('editSpecies').value = species;
    document.getElementById('editGender').value = gender;
    document.getElementById('editQuantity').value = quantity;
    
    // Open the modal
    const editModal = document.getElementById('editModal');
    editModal.style.display = 'block';
}

// Function to close the Edit Modal
document.getElementById('closeEditModal').addEventListener('click', () => {
    const editModal = document.getElementById('editModal');
    editModal.style.display = 'none';
});

// Close the Edit Modal when clicking outside of it
window.addEventListener('click', (event) => {
    const editModal = document.getElementById('editModal');
    if (event.target === editModal) {
        editModal.style.display = 'none';
    }
});

// Handle Edit Observation Form Submission
document.getElementById('editObservationForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const observation_id = document.getElementById('editObservationId').value;
    const species = document.getElementById('editSpecies').value.trim();
    const gender = document.getElementById('editGender').value;
    const quantity = parseInt(document.getElementById('editQuantity').value);
    
    if (!species || !gender || !quantity) {
        alert('Please fill in all fields.');
        return;
    }
    
    try {
        const response = await fetch('/api/edit_observation', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAccessToken()}`
            },
            body: JSON.stringify({
                observation_id,
                species,
                gender,
                quantity
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.status === 'success') {
            alert('Observation updated successfully!');
            // Refresh the markers
            refreshMarkers();
            // Close the modal
            const editModal = document.getElementById('editModal');
            editModal.style.display = 'none';
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error editing observation:', error);
        alert('An error occurred while editing the observation.');
    }
});

// Function to confirm deletion
function confirmDeleteObservation(id) {
    if (confirm('Are you sure you want to delete this observation? This action cannot be undone.')) {
        deleteObservation(id);
    }
}

// Function to delete the observation
async function deleteObservation(id) {
    try {
        const response = await fetch('/api/delete_observation', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAccessToken()}`
            },
            body: JSON.stringify({ observation_id: id })
        });
        
        const data = await response.json();
        
        if (response.ok && data.status === 'success') {
            alert('Observation deleted successfully!');
            // Refresh the markers
            refreshMarkers();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error deleting observation:', error);
        alert('An error occurred while deleting the observation.');
    }
}

// Function to refresh all markers
async function refreshMarkers() {
    console.log('Refreshing markers...');
    // Clear existing markers
    markers.clearLayers();
    
    // Fetch observations again
    await fetchAllObservations();
}

// ---------------------- Event Delegation for Popup Buttons ---------------------- //

// Ensure only one event listener is attached to document.body
document.body.addEventListener('click', function(event) {
    // Handle Observation Edit Button Clicks
    if (event.target.classList.contains('edit-btn')) {
        const observationId = event.target.getAttribute('data-id');
        // Fetch observation details as needed
        fetchObservationById(observationId).then(obs => {
            if (obs) {
                openEditModal(obs.id, obs.species, obs.gender, obs.quantity, obs.latitude, obs.longitude);
            } else {
                alert('Observation details not found.');
            }
        });
    }

    // Handle Observation Delete Button Clicks
    if (event.target.classList.contains('delete-btn')) {
        const observationId = event.target.getAttribute('data-id');
        confirmDeleteObservation(observationId);
    }

    // Handle Spot Edit Button Clicks
    if (event.target.classList.contains('edit-spot-btn')) {
        const spotId = event.target.getAttribute('data-id');
        const spotName = event.target.getAttribute('data-name');

        // Find the polygon by spotId
        const polygon = findPolygonBySpotId(spotId);
        if (polygon) {
            // Enable editing on the polygon
            polygon.editing.enable();

            // Optionally, change the style to indicate editing mode
            polygon.setStyle({ color: 'blue' });

            // Listen for when the user finishes editing
            polygon.on('edit', function(e) {
                // Get the updated coordinates
                const updatedCoordinates = polygon.getLatLngs();

                // Send the updated coordinates to the server
                updateSpotCoordinates(spotId, updatedCoordinates);

                // Disable editing
                polygon.editing.disable();

                // Reset the style
                polygon.setStyle({ color: '#FF5722' });

                // Remove the edit listener to prevent multiple triggers
                polygon.off('edit');
            });
        }

        // Open the edit spot modal if you want to edit the name
        openEditSpotModal(spotId, spotName);
    }

    // Handle Spot Delete Button Clicks
    if (event.target.classList.contains('delete-spot-btn')) {
        const spotId = event.target.getAttribute('data-id');
        confirmDeleteSpot(spotId);
    }
});

// Helper function to retrieve observation details
async function fetchObservationById(id) {
    try {
        const response = await fetch('/api/get_observations', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAccessToken()}`
            }
        });
        const data = await response.json();
        if (data.status === 'success') {
            return data.observations.find(obs => obs.id === id);
        } else {
            console.error('Failed to fetch observations:', data.message);
            return null;
        }
    } catch (error) {
        console.error('Error fetching observation by ID:', error);
        return null;
    }
}

// Add a single event listener to the document body
document.body.addEventListener('click', function(event) {
    // Handle Observation Edit Button Clicks
    if (event.target.classList.contains('edit-btn')) {
        // ... existing code for observations ...
    }

    // Handle Observation Delete Button Clicks
    if (event.target.classList.contains('delete-btn')) {
        // ... existing code for observations ...
    }

        // Handle Spot Edit Button Clicks
        if (event.target.classList.contains('edit-spot-btn')) {
            const spotId = event.target.getAttribute('data-id');
            const spotName = event.target.getAttribute('data-name');
    
            // Find the polygon by spotId
            const polygon = findPolygonBySpotId(spotId);
            if (polygon) {
                // Enable editing on the polygon
                polygon.editing.enable();
    
                // Optionally, change the style to indicate editing mode
                polygon.setStyle({ color: 'blue' });
    
                // Listen for when the user finishes editing
                polygon.on('edit', function(e) {
                    // Get the updated coordinates
                    const updatedCoordinates = polygon.getLatLngs();
    
                    // Send the updated coordinates to the server
                    updateSpotCoordinates(spotId, updatedCoordinates);
    
                    // Disable editing
                    polygon.editing.disable();
    
                    // Reset the style
                    polygon.setStyle({ color: '#FF5722' });
                });
            }
    
            // Open the edit spot modal if you want to edit the name
            openEditSpotModal(spotId, spotName);
        }

    // Handle Spot Delete Button Clicks
    if (event.target.classList.contains('delete-spot-btn')) {
        const spotId = event.target.getAttribute('data-id');
        confirmDeleteSpot(spotId);
    }
});

// Get modal elements
const editSpotModal = document.getElementById('editSpotModal');
const closeEditSpotModal = document.getElementById('closeEditSpotModal');

// Function to open the Edit Spot Modal
function openEditSpotModal(id, name) {
    document.getElementById('editSpotId').value = id;
    document.getElementById('editSpotName').value = name || '';

    editSpotModal.style.display = 'block';
}

// Function to close the Edit Spot Modal
closeEditSpotModal.addEventListener('click', () => {
    editSpotModal.style.display = 'none';
});

// Close the Edit Spot Modal when clicking outside of it
window.addEventListener('click', (event) => {
    if (event.target === editSpotModal) {
        editSpotModal.style.display = 'none';
    }
});

// Handle Edit Spot Form Submission
document.getElementById('editSpotForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const spotId = document.getElementById('editSpotId').value;
    const spotName = document.getElementById('editSpotName').value.trim();

    if (!spotName) {
        alert('Please enter a spot name.');
        return;
    }

    try {
        const response = await fetch('/wildvision/spots', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAccessToken()}`
            },
            body: JSON.stringify({
                spot_id: spotId,
                name: spotName
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Spot updated successfully!');
            // Refresh the spots
            fetchFavoriteSpots();
            // Close the modal
            editSpotModal.style.display = 'none';
        } else {
            alert(`Error updating spot: ${data.message}`);
        }
    } catch (error) {
        console.error('Error updating spot:', error);
        alert('An error occurred while updating the spot.');
    }
});

// Function to confirm deletion of a spot
function confirmDeleteSpot(id) {
    if (confirm('Are you sure you want to delete this favorite spot? This action cannot be undone.')) {
        deleteSpot(id);
    }
}

// Function to update spot coordinates
function updateSpotCoordinates(spotId, coordinates) {
    fetch('/wildvision/spots', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({
            spot_id: spotId,
            coordinates: coordinates
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert('Spot coordinates updated successfully!');
            // Refresh the spots to reflect the updated polygon
            fetchFavoriteSpots();
        } else {
            alert(`Error updating spot coordinates: ${data.message}`);
        }
    })
    .catch(error => {
        console.error('Error updating spot coordinates:', error);
        alert('An error occurred while updating the spot coordinates.');
    });
}

// Function to delete the spot
async function deleteSpot(id) {
    try {
        const response = await fetch('/wildvision/spots', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAccessToken()}`
            },
            body: JSON.stringify({ spot_id: id })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Favorite spot deleted successfully!');
            // Refresh the spots
            fetchFavoriteSpots();
        } else {
            alert(`Error deleting spot: ${data.message}`);
        }
    } catch (error) {
        console.error('Error deleting spot:', error);
        alert('An error occurred while deleting the spot.');
    }
}

// When creating the polygon, store a reference to it
polygon.spotId = spot.id;

// Add an event listener to enable editing when the user clicks the Edit button
polygon.on('editable:editing', function(e) {
    console.log('Polygon is being edited');
});

// In the event delegation for the Edit Spot Button
if (event.target.classList.contains('edit-spot-btn')) {
    const spotId = event.target.getAttribute('data-id');
    const spotName = event.target.getAttribute('data-name');

    // Find the polygon by spotId
    const polygon = findPolygonBySpotId(spotId);
    if (polygon) {
        polygon.enableEdit(); // Enable editing (requires Leaflet.Editable or similar plugin)
    }

    openEditSpotModal(spotId, spotName);
}
