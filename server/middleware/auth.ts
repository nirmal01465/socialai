import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
    
    if (!decoded.userId || !decoded.email) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token does not contain required user information'
      });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please log in again'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Authentication token is malformed'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Unable to verify authentication'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
      if (decoded.userId && decoded.email) {
        req.user = {
          userId: decoded.userId,
          email: decoded.email
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

// Admin authentication middleware
export const adminAuthMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // First run normal auth
    authMiddleware(req, res, (err) => {
      if (err) return;
      
      // Check if user is admin (implement your admin logic here)
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
      
      if (!adminEmails.includes(req.user!.email)) {
        return res.status(403).json({ 
          error: 'Admin access required',
          message: 'You do not have administrator privileges'
        });
      }
      
      next();
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ 
      error: 'Authorization error',
      message: 'Unable to verify admin privileges'
    });
  }
};

// API key authentication for service-to-service calls
export const apiKeyAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const validApiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required',
        message: 'X-API-Key header is missing'
      });
    }
    
    if (!validApiKey) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'API key validation is not configured'
      });
    }
    
    if (apiKey !== validApiKey) {
      return res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }
    
    next();
  } catch (error) {
    console.error('API key auth error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Unable to verify API key'
    });
  }
};

// Generate JWT token
export const generateToken = (payload: { userId: string; email: string }, expiresIn: string = '7d'): string => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn });
};

// Verify JWT token
export const verifyToken = (token: string): { userId: string; email: string } | null => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
    if (decoded.userId && decoded.email) {
      return {
        userId: decoded.userId,
        email: decoded.email
      };
    }
    return null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
};

// Refresh token validation
export const refreshTokenMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
    
    if (!refreshToken) {
      return res.status(401).json({ 
        error: 'Refresh token required',
        message: 'No refresh token provided'
      });
    }

    // In a production app, you'd validate the refresh token against a database
    // For now, we'll just verify it's a valid JWT
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback_secret') as any;
    
    if (!decoded.userId) {
      return res.status(401).json({ 
        error: 'Invalid refresh token',
        message: 'Refresh token is malformed'
      });
    }

    req.body.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        error: 'Refresh token expired',
        message: 'Please log in again'
      });
    }
    
    console.error('Refresh token error:', error);
    return res.status(401).json({ 
      error: 'Invalid refresh token',
      message: 'Unable to verify refresh token'
    });
  }
};

// Rate limiting per user
export const userRateLimitMiddleware = (requestsPerMinute: number = 60) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.userId) {
      return next(); // Skip rate limiting if no user
    }
    
    const userId = req.user.userId;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    
    const userRequestData = userRequests.get(userId);
    
    if (!userRequestData || now > userRequestData.resetTime) {
      // Reset or initialize user request count
      userRequests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (userRequestData.count >= requestsPerMinute) {
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Maximum ${requestsPerMinute} requests per minute.`,
        retryAfter: Math.ceil((userRequestData.resetTime - now) / 1000)
      });
    }
    
    userRequestData.count++;
    userRequests.set(userId, userRequestData);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [key, value] of userRequests.entries()) {
        if (now > value.resetTime) {
          userRequests.delete(key);
        }
      }
    }
    
    next();
  };
};

// CORS preflight handling for authenticated routes
export const authCorsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
};

export default authMiddleware;
