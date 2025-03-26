const Redis = require('ioredis');
const config = require('config');

let redis;

// Initialize Redis connection
if (process.env.NODE_ENV !== 'test') {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'disaster-relief:'
  });

  redis.on('error', (err) => {
    console.error('Redis error:', err);
  });

  redis.on('connect', () => {
    console.log('Connected to Redis');
  });
}

module.exports = {
  get: async (key) => {
    if (!redis) return null;
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      console.error('Redis get error:', err);
      return null;
    }
  },

  set: async (key, value, ttl = 3600) => {
    if (!redis) return false;
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
      return true;
    } catch (err) {
      console.error('Redis set error:', err);
      return false;
    }
  },

  del: async (key) => {
    if (!redis) return false;
    try {
      await redis.del(key);
      return true;
    } catch (err) {
      console.error('Redis del error:', err);
      return false;
    }
  },

  keys: async (pattern) => {
    if (!redis) return [];
    try {
      return await redis.keys(pattern);
    } catch (err) {
      console.error('Redis keys error:', err);
      return [];
    }
  },

  quit: async () => {
    if (redis) {
      try {
        await redis.quit();
      } catch (err) {
        console.error('Redis quit error:', err);
      }
    }
  }
}; 