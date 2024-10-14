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

# Serve index.html
@app.route('/')
def home():
    return send_from_directory('templates', 'index.html')

if __name__ == '__main__':
    app.run(debug=True)
