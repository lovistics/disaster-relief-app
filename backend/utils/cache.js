const Redis = require('ioredis');
const config = require('config');

class Cache {
  constructor() {
    this.enabled = config.get('cache.enabled');
    
    // Handle test environment differently - more resilient approach
    if (process.env.NODE_ENV === 'test') {
      this.createMockClient();
      return;
    }
    
    if (this.enabled) {
      this.createRealClient();
    } else {
      this.createMockClient();
    }
  }
  
  createRealClient() {
    const redisConfig = config.get('cache.redis');
    try {
      this.client = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        maxRetriesPerRequest: 1,  // Reduce retries
        connectTimeout: 1000,     // Shorter timeout
      });

      this.ttl = config.get('cache.ttl');

      // Handle connection events
      this.client.on('connect', () => {
        console.log('Redis cache connected');
      });

      this.client.on('error', (err) => {
        console.error('Redis cache error:', err);
        // Prevent hanging connection in test environments
        if (process.env.NODE_ENV === 'test') {
          this.client.disconnect();
          this.createMockClient();
        }
      });
    } catch (err) {
      console.error('Failed to create Redis client:', err);
      this.createMockClient();
    }
  }
  
  createMockClient() {
    // Create a mock client for tests or when Redis is disabled
    this.client = {
      get: async () => null,
      set: async () => true,
      setex: async () => true,
      del: async () => true,
      keys: async () => [],
      quit: async () => 'OK',
      disconnect: () => {},
      on: () => {}
    };
    this.ttl = config.get('cache.ttl');
  }

  /**
   * Get cached data
   * @param {string} key Cache key
   * @returns {Promise<any>} Cached data or null
   */
  async get(key) {
    if (!this.enabled) return null;
    
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Cache get error:', err);
      return null;
    }
  }

  /**
   * Set cache data
   * @param {string} key Cache key
   * @param {any} value Data to cache
   * @param {string} type Data type for TTL selection
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, type = 'default') {
    if (!this.enabled) return false;

    try {
      const ttl = this.ttl[type] || this.ttl.default;
      await this.client.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('Cache set error:', err);
      return false;
    }
  }

  /**
   * Delete cached data
   * @param {string} key Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    if (!this.enabled) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      console.error('Cache delete error:', err);
      return false;
    }
  }

  /**
   * Clear cache by pattern
   * @param {string} pattern Key pattern to clear
   * @returns {Promise<boolean>} Success status
   */
  async clearPattern(pattern) {
    if (!this.enabled) return false;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (err) {
      console.error('Cache clear pattern error:', err);
      return false;
    }
  }

  /**
   * Generate cache key
   * @param {string} prefix Key prefix
   * @param {Object} params Parameters to include in key
   * @returns {string} Cache key
   */
  generateKey(prefix, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});

    return `${prefix}:${JSON.stringify(sortedParams)}`;
  }
}

module.exports = new Cache(); 