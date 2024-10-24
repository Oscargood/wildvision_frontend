from flask import Flask, render_template, jsonify, send_from_directory, request
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
import re
from dotenv import load_dotenv
from bson.objectid import ObjectId
from bson.errors import InvalidId
from functools import wraps
import logging
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
import uuid

# ---------------------- Setup and Configuration ---------------------- #

# Load environment variables from .env
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CORS Configuration
CORS(app, resources={
    r"/api/*": {
        "origins": "*",  # Adjust this as per your frontend domain
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    },
    r"/wildvision/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')  # Set this in your .env
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)  # Token expires in 1 hour
jwt = JWTManager(app)

# MongoDB Configuration
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    logger.error("MONGO_URI not found in environment variables.")
    raise ValueError("MONGO_URI not found in environment variables.")
client = MongoClient(MONGO_URI)
db = client['wildvision']
observations_collection = db['observations']
users_collection = db['users']
spots_collection = db['spots']  # Added collection for spots

# Directory paths
DIR = '/var/data/static'  # Ensure this path exists and is correctly configured
ANIMAL_DIR = os.path.join(DIR, 'animal')
WEATHER_DIR = os.path.join(DIR, 'weather')
VEGETATION_FILE = os.path.join(DIR, 'vegetation/vegetation_native.geojson')
ANIMAL_LOCATION_FILE = os.path.join(DIR, 'animal/red_deer_location.geojson')

logger.info(f"Filename received: {filename}")
logger.info(f"Constructed file path: {file_path}")

# Common regex for date and time in filenames
time_pattern = re.compile(r'_(\d{6})_(\d{2})\.geojson')

# ---------------------- Helper Functions ---------------------- #

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

def serialize_observation(obs):
    return {
        "id": str(obs["_id"]),
        "species": obs.get("species", "N/A"),
        "gender": obs.get("gender", "N/A"),
        "quantity": obs.get("quantity", "N/A"),
        "latitude": obs.get("latitude"),
        "longitude": obs.get("longitude"),
        "userId": obs.get("userId", "N/A"),
        "timestamp": obs.get("timestamp").isoformat() + 'Z' if obs.get("timestamp") else "N/A"
    }

def serialize_spot(spot):
    return {
        "id": str(spot["_id"]),
        "name": spot.get("name", "N/A"),
        "coordinates": spot.get("coordinates", []),
        "userId": spot.get("userId", "N/A"),
        "timestamp": spot.get("timestamp").isoformat() + 'Z' if spot.get("timestamp") else "N/A"
    }

# ---------------------- Route Definitions ---------------------- #

@app.route('/')
def home():
    """
    Root route that serves the main index.html page.
    """
    return render_template('index.html')

# User Signup
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if not data:
        logging.error("No JSON data received in the signup request.")
        return jsonify({'status': 'error', 'message': 'No data provided.'}), 400
    
    username = data.get('username', '').strip().lower()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not username or not email or not password:
        logging.error("Missing fields in signup request.")
        return jsonify({'status': 'error', 'message': 'All fields are required.'}), 400
    
    # Check if user already exists
    if users_collection.find_one({'$or': [{'username': username}, {'email': email}]}):
        logging.error(f"User already exists: {username} or {email}")
        return jsonify({'status': 'error', 'message': 'User already exists.'}), 409
    
    # Hash the password
    hashed_password = generate_password_hash(password)
    
    # Create a unique userId (e.g., UUID)
    user_id = str(uuid.uuid4())
    
    # Insert the new user into the database
    user_data = {
        'userId': user_id,
        'username': username,
        'email': email,
        'password': hashed_password,
        'created_at': datetime.utcnow()
    }
    
    users_collection.insert_one(user_data)
    logging.info(f"User registered successfully: {username}")
    
    return jsonify({'status': 'success', 'message': 'User registered successfully.'}), 201

# User Login
@app.route('/api/login', methods=['POST'])
def login():
    """
    Authenticates a user and returns a JWT access token.
    """
    data = request.get_json()
    required_fields = ['username', 'password']

    # Validate required fields
    if not data:
        logger.error("No data provided in login request.")
        return jsonify({'status': 'error', 'message': 'No data provided'}), 400

    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        logger.error(f"Missing fields: {', '.join(missing_fields)}")
        return jsonify({'status': 'error', 'message': f"Missing fields: {', '.join(missing_fields)}"}), 400

    username = data['username'].strip()
    password = data['password']

    # Fetch user from the database
    user = users_collection.find_one({'username': username})
    if not user:
        logger.warning(f"Login failed for username: {username}")
        return jsonify({'status': 'error', 'message': 'Invalid username or password'}), 401

    # Verify password
    if not check_password_hash(user['password'], password):
        logger.warning(f"Login failed for username: {username} due to incorrect password.")
        return jsonify({'status': 'error', 'message': 'Invalid username or password'}), 401

    # Create JWT access token
    access_token = create_access_token(identity=user['userId'])
    logger.info(f"User {username} logged in successfully with userId: {user['userId']}")

    return jsonify({'status': 'success', 'access_token': access_token}), 200

# Get All Observations
@app.route('/api/get_observations', methods=['GET'])
@jwt_required()
def get_observations():
    """
    Retrieves all observations from the database.
    """
    current_user_id = get_jwt_identity()
    try:
        observations = list(observations_collection.find())
        serialized_observations = [serialize_observation(obs) for obs in observations]
        logger.info(f"User {current_user_id} retrieved {len(serialized_observations)} observations.")
        return jsonify({'status': 'success', 'observations': serialized_observations}), 200
    except Exception as e:
        logger.exception("Exception occurred while fetching observations.")
        return jsonify({'status': 'error', 'message': 'Failed to fetch observations'}), 500

# Add Observation
@app.route('/api/add_observation', methods=['POST'])
@jwt_required()
def add_observation():
    """
    Adds a new observation to the database.
    """
    current_user_id = get_jwt_identity()
    data = request.get_json()
    required_fields = ['species', 'gender', 'quantity', 'latitude', 'longitude']
    
    # Validate required fields
    if not data:
        logger.error("No data provided in add_observation request.")
        return jsonify({'status': 'error', 'message': 'No data provided'}), 400
    
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        logger.error(f"Missing fields: {', '.join(missing_fields)}")
        return jsonify({'status': 'error', 'message': f"Missing fields: {', '.join(missing_fields)}"}), 400
    
    # Extract and validate data
    try:
        species = str(data['species']).strip()
        gender = str(data['gender']).strip()
        quantity = int(data['quantity'])
        latitude = float(data['latitude'])
        longitude = float(data['longitude'])
        
        # Further validation
        if gender not in ['Male', 'Female', 'Unknown']:
            logger.error("Invalid gender value provided.")
            return jsonify({'status': 'error', 'message': 'Invalid gender value'}), 400
        if quantity < 1:
            logger.error("Quantity less than 1 provided.")
            return jsonify({'status': 'error', 'message': 'Quantity must be at least 1'}), 400
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid data types provided: {e}")
        return jsonify({'status': 'error', 'message': 'Invalid data types provided'}), 400
    
    # Create observation document
    observation = {
        'species': species,
        'gender': gender,
        'quantity': quantity,
        'latitude': latitude,
        'longitude': longitude,
        'userId': current_user_id,
        'timestamp': datetime.utcnow()
    }
    
    try:
        result = observations_collection.insert_one(observation)
        logger.info(f"User {current_user_id} added observation with ID: {result.inserted_id}")
        # Fetch the inserted document
        inserted_observation = observations_collection.find_one({"_id": result.inserted_id})
        serialized_observation = serialize_observation(inserted_observation)
        return jsonify({'status': 'success', 'message': 'Observation added successfully', 'observation': serialized_observation}), 201
    except Exception as e:
        logger.exception(f"Failed to add observation: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to add observation'}), 500

# Edit Observation
@app.route('/api/edit_observation', methods=['PUT'])
@jwt_required()
def edit_observation():
    user_id = get_jwt_identity()
    data = request.get_json()
    obs_id = data.get('observation_id')
    species = data.get('species')
    gender = data.get('gender')
    quantity = data.get('quantity')
    
    if not all([obs_id, species, gender, quantity]):
        logger.error("Missing data in edit_observation request.")
        return jsonify({"status": "error", "message": "Missing data."}), 400
    
    try:
        object_id = ObjectId(obs_id)
    except InvalidId:
        logger.error(f"Invalid observation_id provided: {obs_id}")
        return jsonify({"status": "error", "message": "Invalid observation ID."}), 400
    
    observation = observations_collection.find_one({"_id": object_id})
    if not observation:
        logger.error(f"Observation not found: {obs_id}")
        return jsonify({"status": "error", "message": "Observation not found."}), 404
    
    if not observation.get('userId'):
        logger.error(f"Observation {obs_id} has no 'userId' field.")
        return jsonify({"status": "error", "message": "Observation data corrupted."}), 500
    
    if observation.get('userId') != user_id:
        logger.warning(f"Unauthorized edit attempt by user {user_id} on observation {obs_id}.")
        return jsonify({"status": "error", "message": "Unauthorized."}), 403
    
    try:
        updated = observations_collection.update_one(
            {"_id": object_id},
            {"$set": {
                "species": species,
                "gender": gender,
                "quantity": quantity
            }}
        )
        
        if updated.modified_count > 0:
            logger.info(f"Observation {obs_id} updated successfully by user {user_id}.")
            return jsonify({"status": "success", "message": "Observation updated successfully."}), 200
        else:
            logger.info(f"No changes made to observation {obs_id} by user {user_id}.")
            return jsonify({"status": "error", "message": "No changes made."}), 400
    except Exception as e:
        logger.exception(f"Failed to update observation {obs_id}: {e}")
        return jsonify({"status": "error", "message": "Failed to update observation."}), 500

# Delete Observation
@app.route('/api/delete_observation', methods=['DELETE'])
@jwt_required()
def delete_observation():
    user_id = get_jwt_identity()
    data = request.get_json()
    obs_id = data.get('observation_id')
    
    if not obs_id:
        logger.error("Missing observation_id in delete_observation request.")
        return jsonify({"status": "error", "message": "Missing observation ID."}), 400
    
    try:
        object_id = ObjectId(obs_id)
    except InvalidId:
        logger.error(f"Invalid observation_id provided: {obs_id}")
        return jsonify({"status": "error", "message": "Invalid observation ID."}), 400
    
    observation = observations_collection.find_one({"_id": object_id})
    if not observation:
        logger.error(f"Observation not found: {obs_id}")
        return jsonify({"status": "error", "message": "Observation not found."}), 404
    
    if not observation.get('userId'):
        logger.error(f"Observation {obs_id} has no 'userId' field.")
        return jsonify({"status": "error", "message": "Observation data corrupted."}), 500
    
    if observation.get('userId') != user_id:
        logger.warning(f"Unauthorized delete attempt by user {user_id} on observation {obs_id}.")
        return jsonify({"status": "error", "message": "Unauthorized."}), 403
    
    try:
        deleted = observations_collection.delete_one({"_id": object_id})
        
        if deleted.deleted_count > 0:
            logger.info(f"Observation {obs_id} deleted successfully by user {user_id}.")
            return jsonify({"status": "success", "message": "Observation deleted successfully."}), 200
        else:
            logger.error(f"Failed to delete observation {obs_id} by user {user_id}.")
            return jsonify({"status": "error", "message": "Failed to delete observation."}), 500
    except Exception as e:
        logger.exception(f"Failed to delete observation {obs_id}: {e}")
        return jsonify({"status": "error", "message": "Failed to delete observation."}), 500

# Serve GeoJSON Files via /data/<filename>
@app.route('/var/data/<path:filename>', methods=['GET'])
@jwt_required()
def serve_data(filename):
    """
    Serves GeoJSON files from the specified data directory.
    """
    # Define allowed extensions
    allowed_extensions = {'geojson'}
    
    # Check for allowed file extensions
    if not ('.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions):
        logger.warning(f"Attempt to access disallowed file type: {filename}")
        return jsonify({'status': 'error', 'message': 'File type not allowed.'}), 403
    
    # Prevent directory traversal
    if '..' in filename or filename.startswith('/'):
        logger.warning(f"Attempt to perform directory traversal: {filename}")
        return jsonify({'status': 'error', 'message': 'Invalid file path.'}), 403
    
    # Ensure the file exists
    file_path = os.path.join(DIR, filename)
    if not os.path.isfile(file_path):
        logger.error(f"Data file not found: {filename}")
        return jsonify({'status': 'error', 'message': 'File not found.'}), 404
    
    logger.info(f"User is requesting data file: {filename}")
    return send_from_directory(DIR, filename)

# Animal Location
@app.route('/animal_location', methods=['GET'])
@jwt_required()
def animal_location():
    """
    Serves the animal location GeoJSON file.
    """
    animal_location_filename = os.path.basename(ANIMAL_LOCATION_FILE)
    animal_location_dir = os.path.dirname(ANIMAL_LOCATION_FILE)
    if not os.path.isfile(ANIMAL_LOCATION_FILE):
        logger.error(f"Animal location GeoJSON file not found: {ANIMAL_LOCATION_FILE}")
        return jsonify({'status': 'error', 'message': 'File not found.'}), 404
    logger.info("Serving animal location GeoJSON.")
    return send_from_directory(animal_location_dir, animal_location_filename)

# ---------------------- New Endpoints for Favorite Spots ---------------------- #

# Add Favorite Spot
@app.route('/wildvision/spots', methods=['POST'])
@jwt_required()
def add_favorite_spot():
    """
    Adds a new favorite spot (polygon) to the database.
    """
    current_user_id = get_jwt_identity()
    data = request.get_json()
    required_fields = ['name', 'coordinates']
    
    if not data:
        logger.error("No data provided in add_favorite_spot request.")
        return jsonify({'status': 'error', 'message': 'No data provided.'}), 400
    
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        logger.error(f"Missing fields in add_favorite_spot: {', '.join(missing_fields)}")
        return jsonify({'status': 'error', 'message': f"Missing fields: {', '.join(missing_fields)}"}), 400
    
    name = data.get('name').strip()
    coordinates = data.get('coordinates')
    
    if not coordinates or not isinstance(coordinates, list):
        logger.error("Invalid coordinates provided in add_favorite_spot.")
        return jsonify({'status': 'error', 'message': 'Invalid coordinates provided.'}), 400
    
    # Create spot document
    spot = {
        'name': name,
        'coordinates': coordinates,  # Expecting list of LatLng arrays
        'userId': current_user_id,
        'timestamp': datetime.utcnow()
    }
    
    try:
        result = spots_collection.insert_one(spot)
        logger.info(f"User {current_user_id} added a favorite spot with ID: {result.inserted_id}")
        return jsonify({'status': 'success', 'message': 'Favorite spot added successfully', 'id': str(result.inserted_id)}), 201
    except Exception as e:
        logger.exception(f"Failed to add favorite spot: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to add favorite spot.'}), 500

# Get Favorite Spots
@app.route('/wildvision/spots', methods=['GET'])
@jwt_required()
def get_favorite_spots():
    """
    Retrieves all favorite spots for the authenticated user.
    """
    current_user_id = get_jwt_identity()
    try:
        spots = list(spots_collection.find({'userId': current_user_id}))
        serialized_spots = [serialize_spot(spot) for spot in spots]
        logger.info(f"User {current_user_id} retrieved {len(serialized_spots)} favorite spots.")
        return jsonify(serialized_spots), 200
    except Exception as e:
        logger.exception("Exception occurred while fetching favorite spots.")
        return jsonify({'status': 'error', 'message': 'Failed to fetch favorite spots.'}), 500

# Edit Favorite Spot
@app.route('/wildvision/spots', methods=['PUT'])
@jwt_required()
def edit_favorite_spot():
    """
    Edits an existing favorite spot.
    """
    current_user_id = get_jwt_identity()
    data = request.get_json()
    spot_id = data.get('spot_id')
    name = data.get('name', '').strip()
    coordinates = data.get('coordinates')  # New line to get coordinates

    if not spot_id:
        logger.error("Missing spot_id in edit_favorite_spot request.")
        return jsonify({'status': 'error', 'message': 'Missing spot ID.'}), 400

    try:
        object_id = ObjectId(spot_id)
    except InvalidId:
        logger.error(f"Invalid spot_id provided: {spot_id}")
        return jsonify({'status': 'error', 'message': 'Invalid spot ID.'}), 400

    spot = spots_collection.find_one({"_id": object_id})
    if not spot:
        logger.error(f"Spot not found: {spot_id}")
        return jsonify({'status': 'error', 'message': 'Favorite spot not found.'}), 404

    if spot.get('userId') != current_user_id:
        logger.warning(f"Unauthorized edit attempt by user {current_user_id} on spot {spot_id}.")
        return jsonify({'status': 'error', 'message': 'Unauthorized.'}), 403

    update_fields = {}
    if name:
        update_fields['name'] = name
    if coordinates:
        update_fields['coordinates'] = coordinates

    if not update_fields:
        logger.error("No update fields provided in edit_favorite_spot request.")
        return jsonify({'status': 'error', 'message': 'No data to update.'}), 400

    try:
        updated = spots_collection.update_one(
            {"_id": object_id},
            {"$set": update_fields}
        )

        if updated.modified_count > 0:
            logger.info(f"Spot {spot_id} updated successfully by user {current_user_id}.")
            return jsonify({'status': 'success', 'message': 'Favorite spot updated successfully.'}), 200
        else:
            logger.info(f"No changes made to spot {spot_id} by user {current_user_id}.")
            return jsonify({'status': 'error', 'message': 'No changes made.'}), 400
    except Exception as e:
        logger.exception(f"Failed to update spot {spot_id}: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to update favorite spot.'}), 500

# Delete Favorite Spot
@app.route('/wildvision/spots', methods=['DELETE'])
@jwt_required()
def delete_favorite_spot():
    """
    Deletes a favorite spot.
    """
    current_user_id = get_jwt_identity()
    data = request.get_json()
    spot_id = data.get('spot_id')
    
    if not spot_id:
        logger.error("Missing spot_id in delete_favorite_spot request.")
        return jsonify({'status': 'error', 'message': 'Missing spot ID.'}), 400
    
    try:
        object_id = ObjectId(spot_id)
    except InvalidId:
        logger.error(f"Invalid spot_id provided: {spot_id}")
        return jsonify({'status': 'error', 'message': 'Invalid spot ID.'}), 400
    
    spot = spots_collection.find_one({"_id": object_id})
    if not spot:
        logger.error(f"Spot not found: {spot_id}")
        return jsonify({'status': 'error', 'message': 'Favorite spot not found.'}), 404
    
    if spot.get('userId') != current_user_id:
        logger.warning(f"Unauthorized delete attempt by user {current_user_id} on spot {spot_id}.")
        return jsonify({'status': 'error', 'message': 'Unauthorized.'}), 403
    
    try:
        deleted = spots_collection.delete_one({"_id": object_id})
        
        if deleted.deleted_count > 0:
            logger.info(f"Spot {spot_id} deleted successfully by user {current_user_id}.")
            return jsonify({'status': 'success', 'message': 'Favorite spot deleted successfully.'}), 200
        else:
            logger.error(f"Failed to delete spot {spot_id} by user {current_user_id}.")
            return jsonify({'status': 'error', 'message': 'Failed to delete favorite spot.'}), 500
    except Exception as e:
        logger.exception(f"Failed to delete spot {spot_id}: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to delete favorite spot.'}), 500
# ---------------------- Run the App ---------------------- #

if __name__ == '__main__':
    # It's recommended to set debug=False in production
    app.run(debug=True)
