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
  // Update the text content with the current note
  behaviourTextBox.textContent = behaviourNotes[noteIndex];
  
  // Increment the index and reset if it exceeds the number of notes
  noteIndex = (noteIndex + 1) % behaviourNotes.length;
}, 5000); // Change text every 5 seconds

// Modal Popup Logic
const modal = document.getElementById('popupModal'); // Reference to the modal element
const infoButton = document.getElementById('infoButton'); // Reference to the "Info" button
const closeModal = document.querySelector('.close'); // Reference to the close (X) button

// Show the modal when the page loads
window.addEventListener('load', function() {
    modal.style.display = 'block'; // Show the modal
    initializeMap(); // Initialize the map and display behavior decisions
});

// When the user clicks the "Info" button, show the modal
infoButton.onclick = function() {
    modal.style.display = 'block'; // Show the modal when Info button is clicked
};

// When the user clicks on the close button (x), hide the modal
closeModal.onclick = function() {
    modal.style.display = 'none'; // Hide the modal when the close button is clicked
};

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = 'none'; // Hide the modal if the user clicks outside the modal
    }
};

// Initialize the map and set its view to New Zealand with a zoom level
var map = L.map("map").setView([-43.446754, 171.592242], 7);

// Add a tile layer from OpenStreetMap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

// Create layer groups for each type of data
var animalLayerGroup = L.layerGroup().addTo(map);
var tempLayerGroup = L.layerGroup().addTo(map);
var rainLayerGroup = L.layerGroup().addTo(map);
var windLayerGroup = L.layerGroup().addTo(map);
var cloudLayerGroup = L.layerGroup().addTo(map);

// Variables to store date and time period indices
let currentDateIndex = 0;
let currentTimeIndex = 0;

// Define the time periods
const timePeriods = [1, 4, 7, 10, 13, 16, 19, 22];

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
        dates.push(yymmdd);
    }
    return dates;
}

// Get the unique dates
const uniqueDates = getDatesArray(4); // 4 days' worth of files

const plotDataLayer = async (layerGroup, layerType, dateIndex, timeIndex) => {
    layerGroup.clearLayers(); // Clear existing layers

    const selectedDate = uniqueDates[dateIndex];
    const selectedTimePeriod = timePeriods[timeIndex];
    console.log(`Plotting ${layerType} data for date: ${selectedDate} and time period: ${selectedTimePeriod}`);

    // Update the filename to point to the render disk
    const filename = `https://wildvision.onrender.com//var/data/${layerType}_${selectedDate}_0${selectedTimePeriod}.geojson`;

    try {
        const res = await fetch(filename);
        if (!res.ok) {
            console.warn(`File not found: ${filename}`);
            return;
        }
        const data = await res.json();

        // Create a GeoJSON layer
        const geoJsonLayer = L.geoJSON(data, {
            style: function(feature) {
                return {
                    color: feature.properties.color || '#ff0000',
                    fillColor: feature.properties.color || '#ff0000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.5,
                };
            },
            onEachFeature: function(feature, layer) {
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

        // Add the GeoJSON layer to the respective layer group
        layerGroup.addLayer(geoJsonLayer);

    } catch (err) {
        console.error(`Error fetching ${layerType} data for ${filename}:`, err);
    }
};


// Initialize the map and set up event listeners
const initializeMap = () => {
    const dateTimeSlider = document.getElementById('DateTimeSlider');
    const dateTimeLabel = document.getElementById('DateTimeSliderLabel');
    const totalPeriods = uniqueDates.length * timePeriods.length;

    if (totalPeriods > 0) {
        // Set the slider's max value based on the total periods
        dateTimeSlider.max = totalPeriods - 1;

        // Initialize the label with the first date and time period
        dateTimeLabel.textContent = `${uniqueDates[0]} - Time Period: ${timePeriods[0]}`;

        // Plot all layers for the first date and time period
        plotDataLayer(animalLayerGroup, 'animal_behaviour', 0, 0);
        plotDataLayer(tempLayerGroup, 'temperature', 0, 0);
        plotDataLayer(rainLayerGroup, 'rain', 0, 0);
        plotDataLayer(windLayerGroup, 'wind_speed', 0, 0);
        plotDataLayer(cloudLayerGroup, 'cloud_cover', 0, 0);
    } else {
        dateTimeLabel.textContent = 'No Data Available';
    }

    // Add event listener to the combined slider
    dateTimeSlider.addEventListener('input', () => {
        const combinedIndex = parseInt(dateTimeSlider.value);
        currentDateIndex = Math.floor(combinedIndex / timePeriods.length);
        currentTimeIndex = combinedIndex % timePeriods.length;

        dateTimeLabel.textContent = `${uniqueDates[currentDateIndex]} - Time Period: ${timePeriods[currentTimeIndex]}`;
        
        // Update all layers for the new combined date and time period
        plotDataLayer(animalLayerGroup, 'animal_behaviour', currentDateIndex, currentTimeIndex);
        plotDataLayer(tempLayerGroup, 'temperature', currentDateIndex, currentTimeIndex);
        plotDataLayer(rainLayerGroup, 'rain', currentDateIndex, currentTimeIndex);
        plotDataLayer(windLayerGroup, 'wind_speed', currentDateIndex, currentTimeIndex);
        plotDataLayer(cloudLayerGroup, 'cloud_cover', currentDateIndex, currentTimeIndex);
    });

    // Initialize Play/Pause button for the combined slider
    initializePlayPauseButtons();
    console.log("Map initialized with data layers.");
};

// Function to initialize Play/Pause button for the combined slider
const initializePlayPauseButtons = () => {
    const dateTimePlayPauseBtn = document.getElementById('DateTimePlayPause');
    if (dateTimePlayPauseBtn) {
        dateTimePlayPauseBtn.addEventListener('click', () => {
            if (dateTimeSliderInterval === null) {
                dateTimePlayPauseBtn.textContent = 'Pause';
                dateTimeSliderInterval = setInterval(() => {
                    const combinedIndex = (currentDateIndex * timePeriods.length + currentTimeIndex + 1) % totalPeriods;
                    dateTimeSlider.value = combinedIndex;
                    currentDateIndex = Math.floor(combinedIndex / timePeriods.length);
                    currentTimeIndex = combinedIndex % timePeriods.length;

                    dateTimeLabel.textContent = `${uniqueDates[currentDateIndex]} - Time Period: ${timePeriods[currentTimeIndex]}`;

                    // Update all layers for the new combined date and time period
                    plotDataLayer(animalLayerGroup, 'animal_behaviour', currentDateIndex, currentTimeIndex);
                    plotDataLayer(tempLayerGroup, 'temperature', currentDateIndex, currentTimeIndex);
                    plotDataLayer(rainLayerGroup, 'rain', currentDateIndex, currentTimeIndex);
                    plotDataLayer(windLayerGroup, 'wind_speed', currentDateIndex, currentTimeIndex);
                    plotDataLayer(cloudLayerGroup, 'cloud_cover', currentDateIndex, currentTimeIndex);
                }, 1000); // Change every 1 second
            } else {
                dateTimePlayPauseBtn.textContent = 'Play';
                clearInterval(dateTimeSliderInterval);
                dateTimeSliderInterval = null;
            }
        });
    }
};

// Function to toggle layers based on radio button states
const toggleLayer = (radioName, layerGroup) => {
    const radioButtons = document.getElementsByName(radioName);
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (event.target.checked) {
                map.removeLayer(animalLayerGroup);
                map.removeLayer(tempLayerGroup);
                map.removeLayer(rainLayerGroup);
                map.removeLayer(windLayerGroup);
                map.removeLayer(cloudLayerGroup); // Clear existing layers
                map.addLayer(layerGroup); // Add selected layer to the map
            }
        });
    });
};

// Initialize toggles for layers
toggleLayer('layer-toggle', animalLayerGroup);
toggleLayer('layer-toggle', tempLayerGroup);
toggleLayer('layer-toggle', rainLayerGroup);
toggleLayer('layer-toggle', windLayerGroup);
toggleLayer('layer-toggle', cloudLayerGroup);

// Call initializeMap when the script loads
initializeMap();
