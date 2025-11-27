const Redis = require("ioredis");
const ApiError = require("@utils/ApiError");

/**
 * Redis-based Rate Limiter
 * Persistent, work với multiple servers (load balancer)
 */
class RateLimiter {
  constructor() {
    // Khởi tạo Redis client
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on("error", (err) => {
      console.error("[REDIS] Connection error:", err.message);
    });

    this.redis.on("connect", () => {
      console.log("✅ Redis connected for rate limiting");
    });
  }

  /**
   * Check rate limit
   * @param {string} key - Unique key (user ID, IP, etc.)
   * @param {number} maxRequests - Max requests allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Promise<boolean>} - true nếu OK, false nếu exceed limit
   */
  async checkLimit(key, maxRequests = 10, windowMs = 60000) {
    try {
      const redisKey = `ratelimit:${key}`;
      const windowSeconds = Math.ceil(windowMs / 1000);

      // Increment counter
      const count = await this.redis.incr(redisKey);

      // Set expiry nếu là lần đầu tiên
      if (count === 1) {
        await this.redis.expire(redisKey, windowSeconds);
      }

      // Check nếu exceed limit
      if (count > maxRequests) {
        return false;
      }

      return true;
    } catch (error) {
      // Nếu Redis lỗi, fallback cho phép request (fail open)
      console.error("[RATE_LIMITER] Redis error:", error.message);
      return true;
    }
  }

  /**
   * Get remaining requests
   */
  async getRemaining(key, maxRequests = 10) {
    try {
      const redisKey = `ratelimit:${key}`;
      const count = await this.redis.get(redisKey);
      const current = parseInt(count) || 0;
      return Math.max(0, maxRequests - current);
    } catch (error) {
      console.error("[RATE_LIMITER] Get remaining error:", error.message);
      return maxRequests; // Fallback
    }
  }

  /**
   * Get TTL (seconds còn lại)
   */
  async getTTL(key) {
    try {
      const redisKey = `ratelimit:${key}`;
      return await this.redis.ttl(redisKey);
    } catch (error) {
      console.error("[RATE_LIMITER] Get TTL error:", error.message);
      return -1;
    }
  }

  /**
   * Reset rate limit cho key
   */
  async reset(key) {
    try {
      const redisKey = `ratelimit:${key}`;
      await this.redis.del(redisKey);
      return true;
    } catch (error) {
      console.error("[RATE_LIMITER] Reset error:", error.message);
      return false;
    }
  }

  /**
   * Disconnect Redis
   */
  async disconnect() {
    await this.redis.quit();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Express middleware for rate limiting
 */
const rateLimitMiddleware = (maxRequests = 10, windowMs = 60000) => {
  return async (req, res, next) => {
    const userId = req.user?._id;
    const key = userId ? `user_${userId}` : `ip_${req.ip}`;

    const allowed = await rateLimiter.checkLimit(key, maxRequests, windowMs);

    if (!allowed) {
      const ttl = await rateLimiter.getTTL(key);
      const retryAfter = ttl > 0 ? ttl : Math.ceil(windowMs / 1000);

      res.set("Retry-After", retryAfter);
      return next(
        new ApiError(
          429,
          `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfter} giây.`
        )
      );
    }

    // Thêm rate limit info vào header
    const remaining = await rateLimiter.getRemaining(key, maxRequests);
    res.set("X-RateLimit-Limit", maxRequests);
    res.set("X-RateLimit-Remaining", remaining);

    next();
  };
};

module.exports = {
  rateLimiter,
  rateLimitMiddleware,
};
