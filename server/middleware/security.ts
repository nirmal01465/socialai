import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';

// Main security middleware
export const securityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Add security headers
  addSecurityHeaders(res);
  
  // Add request ID for tracking
  req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
  
  // Log security-relevant information
  logSecurityInfo(req);
  
  next();
};

// Add comprehensive security headers
const addSecurityHeaders = (res: Response) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' https://api.openai.com wss: ws:; " +
    "media-src 'self' blob: data:;"
  );
  
  // Strict Transport Security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  
  // Remove powered-by header
  res.removeHeader('X-Powered-By');
};

// Log security-relevant information
const logSecurityInfo = (req: Request) => {
  const securityInfo = {
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'],
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer,
    origin: req.headers.origin
  };
  
  // Only log in development or if specifically enabled
  if (process.env.NODE_ENV === 'development' || process.env.LOG_SECURITY === 'true') {
    console.log('Security Info:', securityInfo);
  }
};

// Input sanitization middleware
export const sanitizeInputMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

// Recursive object sanitization
const sanitizeObject = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key);
    sanitized[sanitizedKey] = sanitizeObject(value);
  }
  
  return sanitized;
};

// String sanitization
const sanitizeString = (str: any): any => {
  if (typeof str !== 'string') {
    return str;
  }
  
  return str
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove potential script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: protocols
    .replace(/javascript:/gi, '')
    // Remove on* event handlers
    .replace(/\son\w+\s*=/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

// SQL injection prevention middleware
export const sqlInjectionProtectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const suspicious = checkForSQLInjection(req);
  
  if (suspicious.detected) {
    console.warn('Potential SQL injection attempt:', {
      ip: req.ip,
      url: req.url,
      suspicious: suspicious.patterns,
      requestId: req.headers['x-request-id']
    });
    
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Request contains potentially malicious content',
      requestId: req.headers['x-request-id']
    });
  }
  
  next();
};

// Check for SQL injection patterns
const checkForSQLInjection = (req: Request): { detected: boolean; patterns: string[] } => {
  const sqlPatterns = [
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bSELECT\b.*\bFROM\b)/i,
    /(\bINSERT\b.*\bINTO\b)/i,
    /(\bUPDATE\b.*\bSET\b)/i,
    /(\bDELETE\b.*\bFROM\b)/i,
    /(\bDROP\b.*\bTABLE\b)/i,
    /(\bOR\b.*1\s*=\s*1)/i,
    /(\bAND\b.*1\s*=\s*1)/i,
    /(--\s*$)/,
    /(\bhaving\b.*\bcount\b.*\()/i,
    /(\bexec\b.*\()/i
  ];
  
  const detected: string[] = [];
  const checkString = JSON.stringify(req.body) + JSON.stringify(req.query) + req.url;
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(checkString)) {
      detected.push(pattern.source);
    }
  }
  
  return { detected: detected.length > 0, patterns: detected };
};

// XSS protection middleware
export const xssProtectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const suspicious = checkForXSS(req);
  
  if (suspicious.detected) {
    console.warn('Potential XSS attempt:', {
      ip: req.ip,
      url: req.url,
      suspicious: suspicious.patterns,
      requestId: req.headers['x-request-id']
    });
    
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Request contains potentially malicious scripts',
      requestId: req.headers['x-request-id']
    });
  }
  
  next();
};

// Check for XSS patterns
const checkForXSS = (req: Request): { detected: boolean; patterns: string[] } => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[^>]*javascript:/gi,
    /<svg[^>]*>.*<script/gi
  ];
  
  const detected: string[] = [];
  const checkString = JSON.stringify(req.body) + JSON.stringify(req.query) + req.url;
  
  for (const pattern of xssPatterns) {
    if (pattern.test(checkString)) {
      detected.push(pattern.source);
    }
  }
  
  return { detected: detected.length > 0, patterns: detected };
};

// NoSQL injection protection
export const noSQLInjectionProtectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const suspicious = checkForNoSQLInjection(req);
  
  if (suspicious.detected) {
    console.warn('Potential NoSQL injection attempt:', {
      ip: req.ip,
      url: req.url,
      suspicious: suspicious.patterns,
      requestId: req.headers['x-request-id']
    });
    
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Request contains potentially malicious NoSQL operators',
      requestId: req.headers['x-request-id']
    });
  }
  
  next();
};

// Check for NoSQL injection patterns
const checkForNoSQLInjection = (req: Request): { detected: boolean; patterns: string[] } => {
  const dangerous = ['$where', '$ne', '$gt', '$lt', '$regex', '$exists', '$in', '$nin'];
  const detected: string[] = [];
  
  const checkObject = (obj: any, path = ''): void => {
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (dangerous.includes(key)) {
          detected.push(`${currentPath}: ${key}`);
        }
        
        if (typeof value === 'object') {
          checkObject(value, currentPath);
        }
      }
    }
  };
  
  if (req.body) checkObject(req.body, 'body');
  if (req.query) checkObject(req.query, 'query');
  
  return { detected: detected.length > 0, patterns: detected };
};

// File upload security middleware
export const fileUploadSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.files || req.file) {
    const files = Array.isArray(req.files) ? req.files : [req.file].filter(Boolean);
    
    for (const file of files) {
      if (file && !isFileSecure(file)) {
        return res.status(400).json({
          error: 'Invalid file',
          message: 'File type not allowed or file appears to be malicious',
          filename: file.originalname
        });
      }
    }
  }
  
  next();
};

// Check if uploaded file is secure
const isFileSecure = (file: any): boolean => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/json'
  ];
  
  const dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.php', '.asp', '.jsp'
  ];
  
  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return false;
  }
  
  // Check file extension
  const extension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  if (dangerousExtensions.includes(extension)) {
    return false;
  }
  
  // Check file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    return false;
  }
  
  return true;
};

// Request size limiting middleware
export const requestSizeLimitMiddleware = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Request too large',
        message: `Request size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`,
        maxSize
      });
    }
    
    next();
  };
};

// Suspicious behavior detection
export const suspiciousBehaviorMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    // Directory traversal
    /\.\.[\/\\]/,
    // Command injection
    /[;&|`$]/,
    // Path traversal
    /\/(etc\/|proc\/|sys\/)/,
    // Null bytes
    /%00/,
    // Unicode bypass attempts
    /%[0-9a-f]{2}/gi
  ];
  
  const fullUrl = req.url + JSON.stringify(req.body);
  const suspicious = suspiciousPatterns.some(pattern => pattern.test(fullUrl));
  
  if (suspicious) {
    console.warn('Suspicious behavior detected:', {
      ip: req.ip,
      url: req.url,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id']
    });
    
    // Don't block immediately, but log for analysis
    // return res.status(400).json({ error: 'Suspicious request pattern detected' });
  }
  
  next();
};

// CSRF protection for state-changing operations
export const csrfProtectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip for API calls with proper authentication
  if (req.headers.authorization) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._token;
  const expectedToken = req.session?.csrfToken;
  
  if (!token || !expectedToken || token !== expectedToken) {
    return res.status(403).json({
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token'
    });
  }
  
  next();
};

// Content type validation
export const contentTypeValidationMiddleware = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for GET requests
    if (req.method === 'GET') {
      return next();
    }
    
    const contentType = req.headers['content-type']?.split(';')[0];
    
    if (!contentType || !allowedTypes.includes(contentType)) {
      return res.status(415).json({
        error: 'Unsupported media type',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
        received: contentType
      });
    }
    
    next();
  };
};

// IP blocking middleware
export const ipBlockingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const blockedIPs = (process.env.BLOCKED_IPS || '').split(',').filter(Boolean);
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (blockedIPs.includes(clientIP || '')) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been blocked'
    });
  }
  
  next();
};

// Comprehensive security validation for sensitive operations
export const sensitiveOperationSecurityMiddleware = [
  ipBlockingMiddleware,
  requestSizeLimitMiddleware(1024 * 1024), // 1MB limit for sensitive ops
  sanitizeInputMiddleware,
  sqlInjectionProtectionMiddleware,
  xssProtectionMiddleware,
  noSQLInjectionProtectionMiddleware,
  suspiciousBehaviorMiddleware
];

export default securityMiddleware;
