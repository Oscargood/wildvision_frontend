from flask import Flask, render_template, jsonify, send_from_directory, request
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
import re
from dotenv import load_dotenv
from bson.objectid import ObjectId
from functools import wraps  # Needed for the decorator

# Load environment variables from .env
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# CORS Configuration
# Update the resource path to match your API endpoints (assuming they start with /api/)
CORS(app, resources={r"/api/*": {"origins": "https://www.wildvisionhunt.com/wildmap", "https://wildvision.onrender.com"}})

# MongoDB Configuration
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    raise ValueError("No MONGO_URI found in environment variables.")
client = MongoClient(MONGO_URI)
db = client['wildvision']
observations_collection = db['observations']

# API Key for securing endpoints
API_KEY = os.getenv('API_KEY')  # Ensure 'API_KEY' is set in your environment variables

if not API_KEY:
    raise ValueError("No API_KEY found in environment variables.")

# Directory paths
DIR = '/var/data/'  # Deployed to Render
ANIMAL_DIR = os.path.join(DIR, 'static/animal/')
WEATHER_DIR = os.path.join(DIR, 'static/weather/')
VEGETATION_FILE = os.path.join(DIR, 'static/vegetation/vegetation_native.geojson')
ANIMAL_LOCATION_FILE = os.path.join(DIR, 'static/animal/red_deer_location.geojson')

# Common regex for date and time in filenames
time_pattern = re.compile(r'_(\d{6})_(\d{2})\.geojson')

def get_time_periods(directory, prefix):
    """
    Scans the specified directory for files starting with the given prefix
    and extracts date and time information from their filenames.
    """
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
    # Sort the time periods chronologically
    time_periods.sort(key=lambda x: x['time'])
    return time_periods

def require_api_key(f):
    """
    Decorator to require an API key for accessing certain endpoints.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get('x-api-key')
        if not key or key != API_KEY:
            return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

# ---------------------- Route Definitions ---------------------- #

@app.route('/')
def home():
    """
    Root route that serves the main index.html page.
    """
    return render_template('index.html')

@app.route('/animal_behaviour_times', methods=['GET'])
def animal_behaviour_times():
    """
    Returns a JSON list of animal behavior times.
    """
    return jsonify(get_time_periods(ANIMAL_DIR, 'animal_behaviour'))

@app.route('/weather_times', methods=['GET'])
def weather_times():
    """
    Returns a JSON object containing weather-related time periods.
    """
    weather_data = {
        'cloud_cover': get_time_periods(WEATHER_DIR, 'cloud_cover'),
        'rain': get_time_periods(WEATHER_DIR, 'rain'),
        'temperature': get_time_periods(WEATHER_DIR, 'temperature'),
        'wind_speed': get_time_periods(WEATHER_DIR, 'wind_speed')
    }
    return jsonify(weather_data)

@app.route('/data/<path:filename>', methods=['GET'])
def serve_data(filename):
    """
    Serves GeoJSON files from the specified data directory.
    """
    return send_from_directory(DIR, filename)

@app.route('/vegetation', methods=['GET'])
def vegetation():
    """
    Serves the vegetation GeoJSON file.
    """
    return send_from_directory(os.path.dirname(VEGETATION_FILE), os.path.basename(VEGETATION_FILE))

@app.route('/animal_location', methods=['GET'])
def animal_location():
    """
    Serves the animal location GeoJSON file.
    """
    return send_from_directory(os.path.dirname(ANIMAL_LOCATION_FILE), os.path.basename(ANIMAL_LOCATION_FILE))

# ---------------------- API Endpoints ---------------------- #

@app.route('/api/add_observation', methods=['POST'])
@require_api_key  # Protect this endpoint with API key
def add_observation():
    """
    Adds a new observation to the database.
    """
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
        
        # Further validation
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
@require_api_key  # Protect this endpoint with API key
def get_observations():
    """
    Retrieves all observations from the database.
    """
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
    """
    Retrieves a single observation by its ID.
    """
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
    """
    Deletes an observation by its ID.
    """
    try:
        result = observations_collection.delete_one({'_id': ObjectId(id)})
        if result.deleted_count == 0:
            return jsonify({'status': 'error', 'message': 'Observation not found'}), 404
        return jsonify({'status': 'success', 'message': 'Observation deleted successfully'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': 'Failed to delete observation'}), 500

# ---------------------- Static File Serving ---------------------- #

@app.route('/static/<path:filename>')
def serve_static(filename):
    """
    Serves static files from the 'static' directory.
    """
    return send_from_directory('static', filename)

# ---------------------- Run the App ---------------------- #

if __name__ == '__main__':
    app.run(debug=True)
