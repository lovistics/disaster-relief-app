const NodeGeocoder = require('node-geocoder');
const config = require('config');

const options = {
  provider: process.env.GEOCODER_PROVIDER || config.get('geocoder.provider'),
  httpAdapter: config.get('geocoder.httpAdapter'),
  apiKey: process.env.OPENCAGE_API_KEY,
  formatter: null
};

const geocoder = NodeGeocoder(options);

module.exports = geocoder;