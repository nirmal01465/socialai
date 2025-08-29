import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request ID for tracking
    config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add timestamp
    config.headers['X-Timestamp'] = new Date().toISOString();

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // Handle different types of errors
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('auth_token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          break;
        case 403:
          // Forbidden
          console.error('Access forbidden:', data.message);
          break;
        case 429:
          // Rate limited
          console.error('Rate limit exceeded:', data.message);
          break;
        case 500:
          // Server error
          console.error('Server error:', data.message);
          break;
        default:
          console.error('API error:', data.message || error.message);
      }
      
      // Return structured error
      return Promise.reject({
        status,
        message: data.message || error.message,
        details: data.details || null,
        requestId: error.config?.headers?.['X-Request-ID']
      });
    } else if (error.request) {
      // Network error
      console.error('Network error:', error.message);
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.',
        details: null
      });
    } else {
      // Request setup error
      console.error('Request error:', error.message);
      return Promise.reject({
        status: -1,
        message: error.message,
        details: null
      });
    }
  }
);

// API Methods
export const api = {
  // Generic methods
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.get(url, config),
  
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.post(url, data, config),
  
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.put(url, data, config),
  
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.patch(url, data, config),
  
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.delete(url, config),

  // Authentication
  auth: {
    login: (credentials: { email: string; password: string }) =>
      api.post('/auth/login', credentials),
    
    register: (userData: { name: string; email: string; password: string }) =>
      api.post('/auth/register', userData),
    
    logout: () =>
      api.post('/auth/logout'),
    
    refreshToken: () =>
      api.post('/auth/refresh'),
    
    getProfile: () =>
      api.get('/auth/profile'),
    
    updatePreferences: (preferences: any) =>
      api.patch('/auth/preferences', preferences),

    connectSocialPlatform: (platform: string, data: any) =>
      api.post(`/auth/oauth/${platform}`, data),
    
    disconnectSocialPlatform: (platform: string) =>
      api.delete(`/auth/oauth/${platform}`)
  },

  // Feed
  feed: {
    getFeed: (params?: { mode?: string; limit?: number; offset?: number; intent?: string; query?: string }) =>
      api.get('/feed', { params }),
    
    refreshFeed: (params?: { mode?: string }) =>
      api.post('/feed/refresh', params),
    
    getTrending: (params?: { timeframe?: string; platform?: string; limit?: number }) =>
      api.get('/feed/trending', { params }),
    
    searchContent: (params: { q: string; platforms?: string; contentType?: string; limit?: number }) =>
      api.get('/feed/search', { params }),
    
    getPostDetails: (postId: string) =>
      api.get(`/feed/post/${postId}`),
    
    recordBehavior: (events: any[]) =>
      api.post('/feed/behavior', { events })
  },

  // AI Services
  ai: {
    processCommand: (command: string, context?: any) =>
      api.post('/ai/command', { command, context }),
    
    generateContentSuggestions: (data: { type: string; input: string; platform?: string; tone?: string }) =>
      api.post('/ai/suggest-content', data),
    
    getUIDecisions: (sessionData?: any, currentLayout?: any) =>
      api.post('/ai/ui-decisions', { sessionData, currentLayout }),
    
    analyzeEngagement: (data: { postContent: string; platform: string; metadata?: any }) =>
      api.post('/ai/analyze-engagement', data),
    
    getNotifications: () =>
      api.get('/ai/notifications'),
    
    explainDecision: (data: { postId: string; action: string }) =>
      api.post('/ai/explain', data),
    
    generateMoodFilter: (data: { currentMood?: string; timeAvailable?: string; contentGoal?: string }) =>
      api.post('/ai/mood-filter', data),
    
    analyzeSentiment: (data: { text: string; includeEmotions?: boolean }) =>
      api.post('/ai/sentiment', data),
    
    summarizeContent: (data: { content: string; summaryType?: string; maxLength?: number }) =>
      api.post('/ai/summarize', data),

    submitFeedback: (data: { postId?: string; explanationFeedback?: string; context?: string }) =>
      api.post('/ai/feedback', data),
    
    adjustPreferences: (data: { postId?: string; action?: string; context?: string }) =>
      api.post('/ai/adjust-preferences', data)
  },

  // Social Platforms
  social: {
    getPlatforms: () =>
      api.get('/social/platforms'),
    
    syncPlatform: (platform: string) =>
      api.post(`/social/sync/${platform}`),
    
    postToPlatform: (platform: string, data: { content: string; mediaUrls?: string[]; hashtags?: string[]; scheduleAt?: string }) =>
      api.post(`/social/post/${platform}`, data),
    
    getAnalytics: (platform: string, params?: { timeframe?: string; metrics?: string }) =>
      api.get(`/social/analytics/${platform}`, { params }),
    
    searchPlatform: (platform: string, params: { q: string; type?: string; limit?: number }) =>
      api.get(`/social/search/${platform}`, { params }),
    
    getTrending: (platform: string, params?: { location?: string; limit?: number }) =>
      api.get(`/social/trending/${platform}`, { params }),
    
    crossPost: (data: { content: string; platforms: string[]; adaptContent?: boolean; mediaUrls?: string[]; hashtags?: string[] }) =>
      api.post('/social/cross-post', data)
  },

  // File Upload
  upload: {
    single: (file: File, type: 'image' | 'video' | 'document' = 'image') => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      return api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 1 minute for uploads
      });
    },
    
    multiple: (files: File[], type: 'image' | 'video' | 'document' = 'image') => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('type', type);
      
      return api.post('/upload/multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minutes for multiple uploads
      });
    }
  },

  // Health Check
  health: () => api.get('/health')
};

// Export individual instance for custom requests
export { apiClient };

// Utility functions
export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

export const removeAuthToken = () => {
  localStorage.removeItem('auth_token');
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Request retry utility
export const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry for certain error types
      if (error.status === 401 || error.status === 403 || error.status === 422) {
        throw error;
      }
      
      // Wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError;
};

// Batch request utility
export const batchRequests = async <T>(
  requests: (() => Promise<T>)[],
  batchSize: number = 5
): Promise<T[]> => {
  const results: T[] = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(req => req()));
    
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error('Batch request failed:', result.reason);
      }
    });
  }
  
  return results;
};

export default api;
