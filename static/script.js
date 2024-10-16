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

// // Modal Popup Logic
// const modal = document.getElementById('popupModal'); // Reference to the modal element
// const infoButton = document.getElementById('infoButton'); // Reference to the "Info" button
// const closeModal = document.querySelector('.close'); // Reference to the close (X) button

window.addEventListener('load', function() {
    // modal.style.display = 'block'; // Show the modal
    initializeMap(); // Initialize the map and display behavior decisions
});

// infoButton.onclick = function() {
//     modal.style.display = 'block'; // Show the modal when Info button is clicked
// };

// closeModal.onclick = function() {
//     modal.style.display = 'none'; // Hide the modal when the close button is clicked
// };

// window.onclick = function(event) {
//     if (event.target == modal) {
//         modal.style.display = 'none'; // Hide the modal if the user clicks outside the modal
//     }
// };

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
let dateTimeSliderInterval = null;

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
        dates.push({ date: `${yy}-${mm}-${dd}`, readable: `${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, yymmdd });
    }
    return dates;
}

// Get the unique dates
const uniqueDates = getDatesArray(4); // 4 days' worth of files

// Update the displayed date information
function updateDisplayedDate() {
    const dateDisplay = document.getElementById("day-time-text");
    const selectedDate = uniqueDates[currentDateIndex];
    dateDisplay.textContent = `${selectedDate.readable} - Time: ${timePeriods[currentTimeIndex]}:00`;
}

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
    } else if (layerType === 'vegetation') {
        filename = `static/vegetation/vegetation_native.geojson`;
    } else {
        console.error(`Unknown layer type: ${layerType}`);
        return;
    }

    // Fetch the GeoJSON data
    try {
        const res = await fetch(`/data/${filename}`);  
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
                    weight: 1,
                    opacity: 0.5,
                    fillOpacity: 0.5,
                };
            },
            onEachFeature: function (feature, layer) {
                const props = feature.properties;
                const popupContent = `
                    <strong>${layerType.replace('_', ' ')} Data</strong><br>
                    Date: ${selectedDate}<br>
                    Time Period: ${selectedTimePeriod}<br>
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

// Function to initialize the map and set up event listeners
const initializeMap = () => {
    const dateTimeSlider = document.getElementById('DateTimeSlider');
    const totalPeriods = uniqueDates.length * timePeriods.length;

    if (totalPeriods > 0) {
        dateTimeSlider.max = totalPeriods - 1; // Set the slider's max value
        updateDisplayedDate(); // Set the initial displayed date

        // Plot layers based on the default selection
        updateLayersForSelectedDateAndTime(0, 0);
    } else {
        dateDisplay.textContent = 'No Data Available';
    }

    // Initialize Play/Pause button for the combined slider
    initializePlayPauseButtons();

    // Set up layer toggles
    setupLayerToggles();
};

// Add a flag variable to indicate programmatic changes
let isProgrammaticChange = false;

// Add event listeners for the dropdown
const layerDropdownBtn = document.getElementById('layerDropdownBtn');
const layerDropdown = document.getElementById('layerDropdown');

// Toggle the dropdown when the button is clicked
layerDropdownBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent event from bubbling up
    layerDropdown.classList.toggle('show');
});

// Close the dropdown if the user clicks outside of it
window.addEventListener('click', (event) => {
    if (!layerDropdown.contains(event.target)) {
        layerDropdown.classList.remove('show');
    }
});

// Adjusted setupLayerToggles function
const setupLayerToggles = () => {
    const layerButtons = document.querySelectorAll('input[name="layer-toggle"]');

    layerButtons.forEach(button => {
        button.addEventListener('change', async (event) => {
            // Remove all layers from the map
            removeAllLayers();

            const selectedLayerId = event.target.id;

            if (selectedLayerId !== 'none') {
                const layerGroup = getLayerGroupById(selectedLayerId);
                // Layer is selected, plot the data for the current date and time period
                await plotDataLayer(layerGroup, selectedLayerId, currentDateIndex, currentTimeIndex);
                map.addLayer(layerGroup); // Add the layer group to the map
            }
            // If 'none' is selected, no layers are displayed (already removed)
            layerDropdown.classList.remove('show');
        });
    });
};

// Helper function to get the corresponding layer group by checkbox ID
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
        await plotDataLayer(layerGroup, selection.id, dateIndex, timeIndex);
        map.addLayer(layerGroup); // Ensure the layer group is added to the map
    }
};

// Function to initialize Play/Pause button for the combined slider
const initializePlayPauseButtons = () => {
    const dateTimePlayPauseBtn = document.getElementById('DateTimePlayPause');
    const dateTimeSlider = document.getElementById('DateTimeSlider');
    const totalPeriods = uniqueDates.length * timePeriods.length;

    if (dateTimePlayPauseBtn) {
        dateTimePlayPauseBtn.addEventListener('click', () => {
            if (!dateTimeSliderInterval) {
                dateTimePlayPauseBtn.textContent = 'Pause';
                dateTimeSliderInterval = setInterval(() => {
                    const combinedIndex = (parseInt(dateTimeSlider.value) + 1) % totalPeriods;
                    dateTimeSlider.value = combinedIndex;
                    currentDateIndex = Math.floor(combinedIndex / timePeriods.length);
                    currentTimeIndex = combinedIndex % timePeriods.length;

                    updateDisplayedDate();
                    // Update layers for the new combined date and time period
                    updateLayersForSelectedDateAndTime(currentDateIndex, currentTimeIndex);
                }, 1000); // Change every 1 second
            } else {
                dateTimePlayPauseBtn.textContent = 'Play';
                clearInterval(dateTimeSliderInterval);
                dateTimeSliderInterval = null;
            }
        });
    }
};
