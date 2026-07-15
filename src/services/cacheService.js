const NodeCache = require('node-cache');
const env = require('../config/env');

const cache = new NodeCache({
  stdTTL: parseInt(env.CACHE_TTL, 10) || 60,
  checkperiod: parseInt(env.CACHE_CHECK_PERIOD, 10) || 120
});

let redisClient = null;

async function getRedisClient() {
  if (!env.REDIS_URL) return null;
  if (redisClient) return redisClient;
  try {
    const Redis = require('ioredis');
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000)
    });
    redisClient.on('error', (err) => {
      console.error('[Cache] Redis connection error:', err.message);
    });
    await redisClient.connect().catch(() => {
      console.warn('[Cache] Redis no disponible, usando caché en memoria');
      redisClient = null;
    });
    if (redisClient) console.log('[Cache] Redis conectado');
  } catch (e) {
    console.warn('[Cache] Redis no disponible, usando caché en memoria');
    redisClient = null;
  }
  return redisClient;
}

async function get(key) {
  if (redisClient) {
    try {
      const val = await redisClient.get(key);
      return val ? JSON.parse(val) : undefined;
    } catch { /* fallback */ }
  }
  return cache.get(key);
}

async function set(key, value, ttl) {
  if (redisClient) {
    try {
      const ttlSeconds = ttl || parseInt(env.CACHE_TTL, 10) || 60;
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch { /* fallback */ }
  }
  cache.set(key, value);
}

async function del(key) {
  if (redisClient) {
    try { await redisClient.del(key); } catch { /* fallback */ }
  }
  cache.del(key);
}

function getKeys() {
  return cache.keys();
}

module.exports = { get, set, del, getKeys, getRedisClient, redisClient };
