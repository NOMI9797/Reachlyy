import Redis from 'ioredis';

// Redis configuration - Support both URL and individual config
const redisConfig = process.env.REDIS_URL 
  ? {
      // Use Redis URL (Upstash format) - ioredis will parse the URL
      url: process.env.REDIS_URL,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      // Upstash requires TLS
      tls: {},
      // Force connection to use the URL
      family: 4,
    }
  : {
      // Individual config (for other providers)
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      // Enable TLS for cloud Redis
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    };

// Create Redis instance
let redis = null;

export function getRedisClient() {
  if (!redis) {
    // Redis config loaded
    
    // For Upstash, use the URL directly
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        tls: {},
      });
    } else {
      redis = new Redis(redisConfig);
    }
    
    // Connection event handlers
    redis.on('connect', () => {
      console.log('✅ Redis connected');
    });
    
    redis.on('error', (error) => {
      console.error('❌ Redis error:', error);
    });
  }
  
  return redis;
}

// Test Redis connection
export async function testRedisConnection() {
  try {
    const client = getRedisClient();
    await client.ping();
    console.log('✅ Redis ping successful');
    return true;
  } catch (error) {
    console.error('❌ Redis ping failed:', error);
    return false;
  }
}

// Close Redis connection
export async function closeRedisConnection() {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('🔌 Redis connection closed');
  }
}

// Redis Stream helpers
export class RedisStreamManager {
  constructor() {
    this.redis = getRedisClient();
  }

  // Add lead to stream
  async addLeadToStream(streamName, leadData) {
    try {
      const messageId = await this.redis.xadd(
        streamName,
        '*', // Auto-generate message ID
        ...Object.entries(leadData).flat()
      );
      // Lead added to stream
      return messageId;
    } catch (error) {
      console.error('❌ Error adding lead to stream:', error);
      throw error;
    }
  }

  // Create consumer group
  async createConsumerGroup(streamName, groupName) {
    try {
      await this.redis.xgroup('CREATE', streamName, groupName, '0', 'MKSTREAM');
    } catch (error) {
      if (error.message.includes('BUSYGROUP')) {
        // Consumer group already exists
      } else {
        console.error('❌ Error creating consumer group:', error);
        throw error;
      }
    }
  }

  // Read from stream
  async readFromStream(streamName, groupName, consumerName, count = 10) {
    try {
      const result = await this.redis.xreadgroup(
        'GROUP', groupName, consumerName,
        'COUNT', count,
        'STREAMS', streamName, '>'
      );
      return result;
    } catch (error) {
      console.error('❌ Error reading from stream:', error);
      throw error;
    }
  }

  // Acknowledge message
  async acknowledgeMessage(streamName, groupName, messageId) {
    try {
      await this.redis.xack(streamName, groupName, messageId);
      // Message acknowledged
    } catch (error) {
      console.error('❌ Error acknowledging message:', error);
      throw error;
    }
  }

  // Get stream info
  async getStreamInfo(streamName) {
    try {
      const info = await this.redis.xinfo('STREAM', streamName);
      return info;
    } catch (error) {
      console.error('❌ Error getting stream info:', error);
      throw error;
    }
  }

  // Get pending count (unacknowledged messages)
  async getPendingCount(streamName, groupName) {
    try {
      const pendingInfo = await this.redis.xpending(streamName, groupName);
      return pendingInfo ? pendingInfo[0] : 0; // First element is pending count
    } catch (error) {
      console.error('❌ Error getting pending count:', error);
      return 0; // Return 0 if error (stream might not exist)
    }
  }
}

export default getRedisClient;
