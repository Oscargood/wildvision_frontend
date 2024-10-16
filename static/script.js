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

// Declare layerDropdown and layerDropdownBtn in a higher scope
let layerDropdown;
let layerDropdownBtn;

// Initialize the map on window load
window.addEventListener('load', function() {
    console.log('Window loaded and script running');

    // Initialize the map
    initializeMap();

    // Add event listeners for the dropdown
    layerDropdownBtn = document.getElementById('layerDropdownBtn');
    layerDropdown = document.getElementById('layerDropdown');

    // Check if the elements exist
    if (layerDropdownBtn && layerDropdown) {
        console.log('Attaching click event listener to layerDropdownBtn');
        // Toggle the dropdown when the button is clicked
        layerDropdownBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent the event from bubbling up
            console.log('Dropdown button clicked');
            console.log('Before toggle:', layerDropdown.className);
            layerDropdown.classList.toggle('show');
            console.log('After toggle:', layerDropdown.className);
        });

        // Close the dropdown if the user clicks outside of it
        window.addEventListener('click', (event) => {
            if (
                event.target !== layerDropdownBtn && // If the click is not on the button
                !layerDropdown.contains(event.target) // And not inside the dropdown
            ) {
                layerDropdown.classList.remove('show');
            }
        });
    } else {
        console.error('Dropdown elements not found.');
    }
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

const initializeMap = () => {
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
};

// Add the getClosestTimeIndex function outside of initializeMap
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

            // Close the dropdown menu
            // layerDropdown.classList.remove('show');
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
