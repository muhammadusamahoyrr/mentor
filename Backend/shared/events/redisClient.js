const redis = require('redis');

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379)
  },
  password: process.env.REDIS_PASSWORD || undefined
});

const memoryStore = {
  sessions: new Map(),
  tempTokens: new Map(),
  attempts: new Map()
};

let connectPromise = null;
let redisAvailable = false;

client.on('connect', () => {
  redisAvailable = true;
  console.log('✓ Redis connected');
});

client.on('error', (err) => {
  if (err.message && err.message.includes("unknown command 'HELLO'")) {
    return;
  }
  redisAvailable = false;
  console.error('Redis error:', err.message);
});

let lastRetry = 0;
const RETRY_COOLDOWN = 60000; // 1 minute cooldown

async function ensureRedisConnection() {
  if (redisAvailable && client.isOpen) {
    return true;
  }

  // If we already tried recently and failed, don't try again immediately
  if (!redisAvailable && Date.now() - lastRetry < RETRY_COOLDOWN) {
    return false;
  }

  if (!connectPromise) {
    lastRetry = Date.now();
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 2000)
    );

    connectPromise = Promise.race([
      client.connect(),
      timeoutPromise
    ])
      .then(() => {
        redisAvailable = true;
        console.log('✓ Redis connected');
        return true;
      })
      .catch((err) => {
        redisAvailable = false;
        console.warn('Redis unavailable, using in-memory fallback:', err.message);
        return false;
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  return connectPromise;
}

function getMemoryEntry(map, key) {
  const entry = map.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    map.delete(key);
    return null;
  }

  return entry.value;
}

function setMemoryEntry(map, key, value, ttl) {
  map.set(key, {
    value,
    expiresAt: ttl ? Date.now() + (ttl * 1000) : null
  });
}

// Utility functions
const redisCache = {
  // Session Management
  setSession: async (userId, sessionData, ttl = 86400) => {
    const key = `session:${userId}`;
    const payload = JSON.stringify(sessionData);

    if (await ensureRedisConnection()) {
      await client.set(key, payload, { EX: ttl });
      return;
    }

    setMemoryEntry(memoryStore.sessions, key, payload, ttl);
  },

  getSession: async (userId) => {
    const key = `session:${userId}`;

    if (await ensureRedisConnection()) {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    }

    const data = getMemoryEntry(memoryStore.sessions, key);
    return data ? JSON.parse(data) : null;
  },

  deleteSession: async (userId) => {
    const key = `session:${userId}`;

    if (await ensureRedisConnection()) {
      await client.del(key);
      return;
    }

    memoryStore.sessions.delete(key);
  },

  // Temporary Token Storage (OTP, password reset, email verification)
  setTempToken: async (tokenType, identifier, token, ttl = 600) => {
    const key = `temp:${tokenType}:${identifier}`;

    if (await ensureRedisConnection()) {
      await client.set(key, token, { EX: ttl });
      return;
    }

    setMemoryEntry(memoryStore.tempTokens, key, token, ttl);
  },

  getTempToken: async (tokenType, identifier) => {
    const key = `temp:${tokenType}:${identifier}`;

    if (await ensureRedisConnection()) {
      return await client.get(key);
    }

    return getMemoryEntry(memoryStore.tempTokens, key);
  },

  verifyTempToken: async (tokenType, identifier, token) => {
    const storedToken = await redisCache.getTempToken(tokenType, identifier);

    if (storedToken === token) {
      await redisCache.deleteTempToken(tokenType, identifier);
      return true;
    }

    return false;
  },

  deleteTempToken: async (tokenType, identifier) => {
    const key = `temp:${tokenType}:${identifier}`;

    if (await ensureRedisConnection()) {
      await client.del(key);
      return;
    }

    memoryStore.tempTokens.delete(key);
  },

  // Rate Limiting
  incrementAttempts: async (key, ttl = 900) => {
    if (await ensureRedisConnection()) {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttl);
      }
      return count;
    }

    const entry = memoryStore.attempts.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      memoryStore.attempts.set(key, {
        count: 1,
        expiresAt: Date.now() + (ttl * 1000)
      });
      return 1;
    }

    entry.count += 1;
    return entry.count;
  },

  resetAttempts: async (key) => {
    if (await ensureRedisConnection()) {
      await client.del(key);
      return;
    }

    memoryStore.attempts.delete(key);
  }
};

module.exports = redisCache;
module.exports.client = client;
