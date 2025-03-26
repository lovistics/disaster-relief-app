const config = require('config');

const defaultConfig = {
  cache: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      enabled: process.env.REDIS_ENABLED !== 'false'
    }
  },
  geocoding: {
    provider: 'mapbox',
    apiKey: process.env.MAPBOX_API_KEY || 'test_key'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'test_secret',
    expire: process.env.JWT_EXPIRE || '1h'
  }
};

// Merge default config with environment-specific config
const mergedConfig = {
  ...defaultConfig,
  ...config
};

module.exports = mergedConfig; 