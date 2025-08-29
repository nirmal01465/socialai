import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { getRedisClient } from '../database/redis.js';

// Basic rate limiting configuration
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Custom key generator to use IP + User ID if available
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = (req as any).user?.userId;
    return userId ? `${ip}:${userId}` : ip;
  },

  // Custom handler for rate limit exceeded
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(req.rateLimit?.resetTime || Date.now() + 15 * 60 * 1000)
    });
  },

  // Skip successful requests in certain conditions
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

// Strict rate limiting for authentication endpoints
export const authRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: {
    error: 'Authentication rate limit exceeded',
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const email = req.body?.email || 'no-email';
    return `auth:${ip}:${email}`;
  },

  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Authentication rate limit exceeded',
      message: 'Too many login attempts. Please try again later.',
      retryAfter: Math.round(req.rateLimit?.resetTime || Date.now() + 15 * 60 * 1000),
      suggestion: 'Consider using password reset if you\'re having trouble logging in.'
    });
  }
});

// Rate limiting for AI endpoints (more restrictive due to cost)
export const aiRateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each user to 30 AI requests per minute
  message: {
    error: 'AI service rate limit exceeded',
    message: 'Too many AI requests. Please wait a moment before trying again.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.userId || 'anonymous';
    return `ai:${userId}`;
  },

  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'AI rate limit exceeded',
      message: 'AI processing limit reached. Please wait before making more requests.',
      retryAfter: 60,
      suggestion: 'Try batching your requests or waiting a moment between them.'
    });
  }
});

// Rate limiting for social platform API calls
export const socialApiRateLimitMiddleware = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Limit each user to 100 social API requests per 5 minutes
  message: {
    error: 'Social API rate limit exceeded',
    message: 'Too many social media API requests. Please slow down.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.userId || 'anonymous';
    const platform = req.params?.platform || 'general';
    return `social:${userId}:${platform}`;
  },

  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Social API rate limit exceeded',
      message: 'You\'ve made too many requests to social media platforms. Please wait.',
      retryAfter: 300,
      suggestion: 'Consider reducing the frequency of sync operations.'
    });
  }
});

// Advanced Redis-based rate limiter for more complex scenarios
class RedisRateLimiter {
  private redis = getRedisClient();

  async checkRateLimit(
    key: string, 
    maxRequests: number, 
    windowMs: number,
    req: Request,
    res: Response
  ): Promise<boolean> {
    try {
      const now = Date.now();
      const window = Math.floor(now / windowMs);
      const redisKey = `rate_limit:${key}:${window}`;

      // Use Redis transaction for atomic operations
      const multi = this.redis.multi();
      multi.incr(redisKey);
      multi.expire(redisKey, Math.ceil(windowMs / 1000));
      
      const results = await multi.exec();
      const currentCount = results?.[0]?.[1] as number;

      if (currentCount > maxRequests) {
        const resetTime = (window + 1) * windowMs;
        const retryAfter = Math.ceil((resetTime - now) / 1000);

        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(resetTime).toISOString(),
          'Retry-After': retryAfter.toString()
        });

        return false; // Rate limit exceeded
      }

      // Set rate limit headers
      const remaining = Math.max(0, maxRequests - currentCount);
      const resetTime = (window + 1) * windowMs;

      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString()
      });

      return true; // Request allowed

    } catch (error) {
      console.error('Redis rate limiter error:', error);
      // Allow request if Redis is down (fail open)
      return true;
    }
  }

  // Create middleware using Redis rate limiter
  createMiddleware(maxRequests: number, windowMs: number, keyGenerator: (req: Request) => string) {
    return async (req: Request, res: Response, next: Function) => {
      const key = keyGenerator(req);
      const allowed = await this.checkRateLimit(key, maxRequests, windowMs, req, res);

      if (!allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: res.get('Retry-After')
        });
      }

      next();
    };
  }
}

export const redisRateLimiter = new RedisRateLimiter();

// Premium user rate limits (higher limits for premium users)
export const premiumRateLimitMiddleware = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;
  const isPremium = user?.plan === 'premium' || user?.plan === 'pro';

  if (isPremium) {
    // Skip rate limiting for premium users or apply higher limits
    return next();
  }

  // Apply standard rate limiting for free users
  return rateLimitMiddleware(req, res, next);
};

// Dynamic rate limiting based on server load
export const adaptiveRateLimitMiddleware = () => {
  let currentLoad = 1.0; // 1.0 = normal load
  
  // Update load periodically (you could integrate with actual server metrics)
  setInterval(() => {
    // This is a simplified load calculation
    // In production, you'd use actual metrics like CPU, memory, response times
    const memUsage = process.memoryUsage();
    const memLoad = memUsage.heapUsed / memUsage.heapTotal;
    currentLoad = Math.max(0.5, Math.min(2.0, memLoad * 2));
  }, 30000); // Update every 30 seconds

  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: (req: Request) => {
      const baseLimit = 1000;
      // Reduce limits when load is high
      return Math.floor(baseLimit / currentLoad);
    },
    message: (req: Request) => ({
      error: 'Rate limit exceeded',
      message: `Server is experiencing high load. Rate limit: ${Math.floor(1000 / currentLoad)} requests per 15 minutes.`,
      serverLoad: currentLoad.toFixed(2)
    }),
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Burst protection - allows short bursts but enforces long-term limits
export const burstProtectionMiddleware = redisRateLimiter.createMiddleware(
  100, // 100 requests
  60 * 1000, // per minute (burst window)
  (req: Request) => {
    const userId = (req as any).user?.userId || req.ip;
    return `burst:${userId}`;
  }
);

// Long-term rate limiting
export const longTermRateLimitMiddleware = redisRateLimiter.createMiddleware(
  5000, // 5000 requests
  24 * 60 * 60 * 1000, // per day
  (req: Request) => {
    const userId = (req as any).user?.userId || req.ip;
    return `daily:${userId}`;
  }
);

// Endpoint-specific rate limits
export const endpointRateLimitMiddleware = (endpoint: string, maxRequests: number, windowMs: number) => {
  return redisRateLimiter.createMiddleware(
    maxRequests,
    windowMs,
    (req: Request) => {
      const userId = (req as any).user?.userId || req.ip;
      return `endpoint:${endpoint}:${userId}`;
    }
  );
};

// Rate limit bypass for specific IPs (whitelist)
export const whitelistMiddleware = (req: Request, res: Response, next: Function) => {
  const whitelistedIPs = (process.env.WHITELISTED_IPS || '').split(',').filter(Boolean);
  const clientIP = req.ip || req.connection.remoteAddress;

  if (whitelistedIPs.includes(clientIP || '')) {
    // Skip rate limiting for whitelisted IPs
    return next();
  }

  // Continue with normal rate limiting
  next();
};

// Export all rate limiting middlewares
export default {
  general: rateLimitMiddleware,
  auth: authRateLimitMiddleware,
  ai: aiRateLimitMiddleware,
  socialApi: socialApiRateLimitMiddleware,
  premium: premiumRateLimitMiddleware,
  adaptive: adaptiveRateLimitMiddleware,
  burst: burstProtectionMiddleware,
  longTerm: longTermRateLimitMiddleware,
  whitelist: whitelistMiddleware,
  redis: redisRateLimiter,
  endpoint: endpointRateLimitMiddleware
};
