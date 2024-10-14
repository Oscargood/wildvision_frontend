from flask import Flask, jsonify, send_from_directory
import os
import re

app = Flask(__name__)

# Directory paths

# DIR = '~/Documents/Software/Python/wildvision_backend/'     # local mac
DIR = '~/var/data/'     # deplyed to render

ANIMAL_DIR = os.path.join(DIR,'static/animal/')
WEATHER_DIR = os.path.join(DIR,'static/weather/')
VEGETATION_FILE = os.path.join(DIR,'static/vegetation/vegetation_native.geojson')
ANIMAL_LOCATION_FILE = os.path.join(DIR,'static/animal/red_deer_location.geojson')

# Common regex for date and time in filenames
time_pattern = re.compile(r'_(\d{6})_(\d{2})\.geojson')

def get_time_periods(directory, prefix):
    time_periods = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.startswith(prefix):
                match = time_pattern.search(file)
                if match:
                    date = match.group(1)  # YYMMDD
                    hour = match.group(2)  # HH
                    readable_time = f"20{date[:2]}-{date[2:4]}-{date[4:6]} {hour}:00"
                    time_periods.append({
                        'filename': file,
                        'time': readable_time
                    })
    time_periods.sort(key=lambda x: x['time'])
    return time_periods

@app.route('/animal_behaviour_times', methods=['GET'])
def animal_behaviour_times():
    return jsonify(get_time_periods(ANIMAL_DIR, 'animal_behaviour'))

@app.route('/weather_times', methods=['GET'])
def weather_times():
    weather_data = {
        'cloud_cover': get_time_periods(WEATHER_DIR, 'cloud_cover'),
        'rain': get_time_periods(WEATHER_DIR, 'rain'),
        'temperature': get_time_periods(WEATHER_DIR, 'temperature'),
        'wind_speed': get_time_periods(WEATHER_DIR, 'wind_speed')
    }
    return jsonify(weather_data)

# Serve index.html
@app.route('/')
def home():
    return send_from_directory('templates', 'index.html')

# Serve static files (GeoJSON, CSS, JS)
@app.route('/static/<path:path>', methods=['GET'])
def static_files(path):
    return send_from_directory('static', path)

# Serve vegetation and animal location files (these don't change over time)
@app.route('/vegetation', methods=['GET'])
def vegetation():
    return send_from_directory(os.path.dirname(VEGETATION_FILE), os.path.basename(VEGETATION_FILE))

@app.route('/animal_location', methods=['GET'])
def animal_location():
    return send_from_directory(os.path.dirname(ANIMAL_LOCATION_FILE), os.path.basename(ANIMAL_LOCATION_FILE))

if __name__ == '__main__':
    app.run(debug=True)
