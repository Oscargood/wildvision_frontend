from flask import Flask, render_template, jsonify, send_from_directory
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
import re
from dotenv import load_dotenv
from bson.objectid import ObjectId

# Directory paths
DIR = '/var/data/'  # deployed to render

ANIMAL_DIR = os.path.join(DIR, 'static/animal/')
WEATHER_DIR = os .path.join(DIR, 'static/weather/')
VEGETATION_FILE = os.path.join(DIR, 'static/vegetation/vegetation_native.geojson')
ANIMAL_LOCATION_FILE = os.path.join(DIR, 'static/animal/red_deer_location.geojson')

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

@app.route('/')
def home():
    return render_template('index.html')

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

# Serve GeoJSON files
@app.route('/data/<path:filename>', methods=['GET'])
def serve_data(filename):
    # Serve files from the static directory
    return send_from_directory(DIR, filename)

# Serve vegetation and animal location files (these don't change over time)
@app.route('/vegetation', methods=['GET'])
def vegetation():
    return send_from_directory(os.path.dirname(VEGETATION_FILE), os.path.basename(VEGETATION_FILE))

@app.route('/animal_location', methods=['GET'])
def animal_location():
    return send_from_directory(os.path.dirname(ANIMAL_LOCATION_FILE), os.path.basename(ANIMAL_LOCATION_FILE))
    
# Load environment variables from .env
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api_key/*": {"origins": "https://www.wildvisionhunt.com/wildmap"}})


# MongoDB Configuration
MONGO_URI = os.getenv('MONGO_URI')
client = MongoClient(MONGO_URI)
db = client['wildvision']
observations_collection = db['observations']

# Optional: API Key for securing endpoints
API_KEY = os.getenv('592a7f2d37881d292b6da3dacf16508628afc77dcf08c2deb196497e39f24bb6')

def require_api_key(f):
    """
    Decorator to require API key for certain endpoints.
    """
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get('x-api-key')
        if not key or key != API_KEY:
            return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated
    
@app.route('/api/add_observation', methods=['POST'])
@require_api_key  # Protect this endpoint
def add_observation():
    data = request.get_json()
    required_fields = ['species', 'gender', 'quantity', 'latitude', 'longitude', 'userId']
    
    # Validate required fields
    if not data:
        return jsonify({'status': 'error', 'message': 'No data provided'}), 400
    
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return jsonify({'status': 'error', 'message': f'Missing fields: {", ".join(missing_fields)}'}), 400
    
    # Extract and validate data
    try:
        species = str(data['species']).strip()
        gender = str(data['gender']).strip()
        quantity = int(data['quantity'])
        latitude = float(data['latitude'])
        longitude = float(data['longitude'])
        user_id = str(data['userId']).strip()
        
        # Optional: Further validation (e.g., check species against allowed list)
        if gender not in ['Male', 'Female', 'Unknown']:
            return jsonify({'status': 'error', 'message': 'Invalid gender value'}), 400
        if quantity < 1:
            return jsonify({'status': 'error', 'message': 'Quantity must be at least 1'}), 400
    except (ValueError, TypeError) as e:
        return jsonify({'status': 'error', 'message': 'Invalid data types provided'}), 400
    
    # Create observation document
    observation = {
        'species': species,
        'gender': gender,
        'quantity': quantity,
        'latitude': latitude,
        'longitude': longitude,
        'userId': user_id,
        'timestamp': datetime.utcnow()
    }
    
    try:
        result = observations_collection.insert_one(observation)
        return jsonify({'status': 'success', 'message': 'Observation added successfully', 'id': str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({'status': 'error', 'message': 'Failed to add observation'}), 500

@app.route('/api/get_observations', methods=['GET'])
@require_api_key  # Protect this endpoint
def get_observations():
    try:
        observations = list(observations_collection.find())
        for obs in observations:
            obs['_id'] = str(obs['_id'])
            obs['timestamp'] = obs['timestamp'].isoformat() + 'Z'  # ISO format with UTC timezone
        return jsonify({'status': 'success', 'observations': observations}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': 'Failed to fetch observations'}), 500

@app.route('/api/get_observation/<id>', methods=['GET'])
@require_api_key
def get_observation(id):
    try:
        observation = observations_collection.find_one({'_id': ObjectId(id)})
        if not observation:
            return jsonify({'status': 'error', 'message': 'Observation not found'}), 404
        observation['_id'] = str(observation['_id'])
        observation['timestamp'] = observation['timestamp'].isoformat() + 'Z'
        return jsonify({'status': 'success', 'observation': observation}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': 'Failed to fetch observation'}), 500

@app.route('/api/delete_observation/<id>', methods=['DELETE'])
@require_api_key
def delete_observation(id):
    try:
        result = observations_collection.delete_one({'_id': ObjectId(id)})
        if result.deleted_count == 0:
            return jsonify({'status': 'error', 'message': 'Observation not found'}), 404
        return jsonify({'status': 'success', 'message': 'Observation deleted successfully'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': 'Failed to delete observation'}), 500

if __name__ == '__main__':
    app.run(debug=True)
