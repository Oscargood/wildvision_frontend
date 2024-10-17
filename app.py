from flask import Flask, render_template, jsonify, send_from_directory, make_response
import os
import re
import logging

app = Flask(__name__)

# Setup logging
logging.basicConfig(level=logging.INFO)

# Directory paths
DIR = '/var/data/'  # deployed to render

ANIMAL_DIR = os.path.join(DIR, 'static/animal/')
WEATHER_DIR = os.path.join(DIR, 'static/weather/')
VEGETATION_FILE = os.path.join(DIR, 'static/vegetation/vegetation_native.geojson')
ANIMAL_LOCATION_FILE = os.path.join(DIR, 'static/animal/red_deer_location.geojson')

# Common regex for date and time in filenames
time_pattern = re.compile(r'_(\d{6})_(\d{2})\.geojson')

def get_time_periods(directory, prefix):
    dates = set()
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.startswith(prefix):
                match = time_pattern.search(file)
                if match:
                    date = match.group(1)  # YYMMDD
                    readable_date = f"20{date[:2]}-{date[2:4]}-{date[4:6]}"
                    dates.add(readable_date)
    unique_dates = sorted(list(dates))
    return unique_dates

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/animal_behaviour_times', methods=['GET'])
def animal_behaviour_times():
    dates = get_time_periods(ANIMAL_DIR, 'animal_behaviour')
    return jsonify(dates)

@app.route('/weather_times', methods=['GET'])
def weather_times():
    dates = get_time_periods(WEATHER_DIR, 'cloud_cover')  # Assuming cloud_cover has all dates
    return jsonify(dates)

@app.route('/available_dates', methods=['GET'])
def available_dates():
    logging.info('Fetching available dates and times')
    animal_dates = get_time_periods(ANIMAL_DIR, 'animal_behaviour')
    weather_dates = get_time_periods(WEATHER_DIR, 'cloud_cover')  # Adjust if necessary

    # Find intersection of dates if necessary
    available_dates = sorted(list(set(animal_dates) & set(weather_dates)))

    # Define time periods (ensure this matches your filenames)
    time_periods = ['01', '04', '07', '10', '13', '16', '19', '22']

    return jsonify({
        'dates': available_dates,
        'time_periods': time_periods
    })

# Serve GeoJSON files with cache control
@app.route('/data/<path:filename>', methods=['GET'])
def serve_data(filename):
    logging.info(f'Serving file: {filename}')
    try:
        response = make_response(send_from_directory(DIR, filename))
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    except Exception as e:
        logging.error(f'Error serving file {filename}: {e}')
        return jsonify({'error': 'File not found'}), 404

# Serve vegetation and animal location files (these don't change over time)
@app.route('/vegetation', methods=['GET'])
def vegetation():
    logging.info('Serving vegetation file')
    return serve_data(os.path.relpath(VEGETATION_FILE, DIR))

@app.route('/animal_location', methods=['GET'])
def animal_location():
    logging.info('Serving animal location file')
    return serve_data(os.path.relpath(ANIMAL_LOCATION_FILE, DIR))

if __name__ == '__main__':
    app.run(debug=True)
from flask import Flask, render_template, jsonify, send_from_directory, make_response
import os
import re
import logging

app = Flask(__name__)

# Setup logging
logging.basicConfig(level=logging.INFO)

# Directory paths
DIR = '/var/data/'  # deployed to render

ANIMAL_DIR = os.path.join(DIR, 'static/animal/')
WEATHER_DIR = os.path.join(DIR, 'static/weather/')
VEGETATION_FILE = os.path.join(DIR, 'static/vegetation/vegetation_native.geojson')
ANIMAL_LOCATION_FILE = os.path.join(DIR, 'static/animal/red_deer_location.geojson')

# Common regex for date and time in filenames
time_pattern = re.compile(r'_(\d{6})_(\d{2})\.geojson')

def get_time_periods(directory, prefix):
    dates = set()
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.startswith(prefix):
                match = time_pattern.search(file)
                if match:
                    date = match.group(1)  # YYMMDD
                    readable_date = f"20{date[:2]}-{date[2:4]}-{date[4:6]}"
                    dates.add(readable_date)
    unique_dates = sorted(list(dates))
    return unique_dates

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/animal_behaviour_times', methods=['GET'])
def animal_behaviour_times():
    dates = get_time_periods(ANIMAL_DIR, 'animal_behaviour')
    return jsonify(dates)

@app.route('/weather_times', methods=['GET'])
def weather_times():
    dates = get_time_periods(WEATHER_DIR, 'cloud_cover')  # Assuming cloud_cover has all dates
    return jsonify(dates)

@app.route('/available_dates', methods=['GET'])
def available_dates():
    logging.info('Fetching available dates and times')
    animal_dates = get_time_periods(ANIMAL_DIR, 'animal_behaviour')
    weather_dates = get_time_periods(WEATHER_DIR, 'cloud_cover')  # Adjust if necessary

    # Find intersection of dates if necessary
    available_dates = sorted(list(set(animal_dates) & set(weather_dates)))

    # Define time periods (ensure this matches your filenames)
    time_periods = ['01', '04', '07', '10', '13', '16', '19', '22']

    return jsonify({
        'dates': available_dates,
        'time_periods': time_periods
    })

# Serve GeoJSON files with cache control
@app.route('/data/<path:filename>', methods=['GET'])
def serve_data(filename):
    logging.info(f'Serving file: {filename}')
    try:
        response = make_response(send_from_directory(DIR, filename))
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    except Exception as e:
        logging.error(f'Error serving file {filename}: {e}')
        return jsonify({'error': 'File not found'}), 404

# Serve vegetation and animal location files (these don't change over time)
@app.route('/vegetation', methods=['GET'])
def vegetation():
    logging.info('Serving vegetation file')
    return serve_data(os.path.relpath(VEGETATION_FILE, DIR))

@app.route('/animal_location', methods=['GET'])
def animal_location():
    logging.info('Serving animal location file')
    return serve_data(os.path.relpath(ANIMAL_LOCATION_FILE, DIR))

if __name__ == '__main__':
    app.run(debug=True)
