import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { connectSocialPlatform, disconnectSocialPlatform } from '../../store/slices/authSlice';
import { api } from '../../services/api';

const InstagramIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="2"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke="currentColor" strokeWidth="2"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

interface Platform {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  features: string[];
}

interface SocialConnectionsProps {
  onComplete?: () => void;
  showSkip?: boolean;
}

const SocialConnections: React.FC<SocialConnectionsProps> = ({ onComplete, showSkip = false }) => {
  const dispatch = useAppDispatch();
  const { user, loading } = useAppSelector(state => state.auth);
  
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, 'checking' | 'connected' | 'disconnected' | 'error'>>({});

  const platforms: Platform[] = [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: <InstagramIcon />,
      color: 'from-purple-600 to-pink-600',
      description: 'Connect your Instagram account to unify your visual content',
      features: ['Photos & Stories', 'Reels', 'IGTV', 'Direct Messages']
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: <YouTubeIcon />,
      color: 'from-red-600 to-red-700',
      description: 'Integrate your YouTube channel for video content management',
      features: ['Videos & Shorts', 'Comments', 'Analytics', 'Live Streams']
    },
    {
      id: 'twitter',
      name: 'Twitter/X',
      icon: <TwitterIcon />,
      color: 'from-blue-500 to-blue-600',
      description: 'Connect Twitter/X for real-time social engagement',
      features: ['Tweets & Threads', 'Direct Messages', 'Trends', 'Spaces']
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: <FacebookIcon />,
      color: 'from-blue-600 to-blue-700',
      description: 'Link your Facebook account for comprehensive social integration',
      features: ['Posts & Pages', 'Groups', 'Events', 'Messenger']
    }
  ];

  // Check connection status on mount
  useEffect(() => {
    const checkConnections = async () => {
      try {
        const response = await api.get('/social/platforms');
        const platformStatuses = response.data.platforms.reduce((acc: any, platform: any) => {
          acc[platform.platform] = platform.isActive ? 'connected' : 'disconnected';
          return acc;
        }, {});
        
        platforms.forEach(platform => {
          if (!platformStatuses[platform.id]) {
            platformStatuses[platform.id] = 'disconnected';
          }
        });
        
        setConnectionStatuses(platformStatuses);
      } catch (error) {
        console.error('Failed to check platform connections:', error);
        // Set all to disconnected on error
        const defaultStatuses = platforms.reduce((acc, platform) => {
          acc[platform.id] = 'disconnected';
          return acc;
        }, {} as Record<string, any>);
        setConnectionStatuses(defaultStatuses);
      }
    };

    checkConnections();
  }, []);

  const handleConnect = async (platformId: string) => {
    if (connectionStatuses[platformId] === 'connected') {
      // Disconnect if already connected
      try {
        setConnecting(platformId);
        await dispatch(disconnectSocialPlatform(platformId)).unwrap();
        setConnectionStatuses(prev => ({ ...prev, [platformId]: 'disconnected' }));
      } catch (error) {
        console.error(`Failed to disconnect ${platformId}:`, error);
        setConnectionStatuses(prev => ({ ...prev, [platformId]: 'error' }));
      } finally {
        setConnecting(null);
      }
      return;
    }

    try {
      setConnecting(platformId);
      setConnectionStatuses(prev => ({ ...prev, [platformId]: 'checking' }));

      // In a real implementation, this would open OAuth flow
      // For now, we'll simulate the OAuth process
      const authUrl = await getOAuthUrl(platformId);
      
      // Open OAuth popup
      const popup = window.open(
        authUrl,
        `${platformId}_oauth`,
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for OAuth callback
      const handleOAuthCallback = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'oauth_success' && event.data.platform === platformId) {
          popup?.close();
          window.removeEventListener('message', handleOAuthCallback);
          
          // Complete the connection
          completeConnection(platformId, event.data.code);
        } else if (event.data.type === 'oauth_error') {
          popup?.close();
          window.removeEventListener('message', handleOAuthCallback);
          setConnectionStatuses(prev => ({ ...prev, [platformId]: 'error' }));
          setConnecting(null);
        }
      };

      window.addEventListener('message', handleOAuthCallback);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (popup && !popup.closed) {
          popup.close();
          window.removeEventListener('message', handleOAuthCallback);
          setConnectionStatuses(prev => ({ ...prev, [platformId]: 'disconnected' }));
          setConnecting(null);
        }
      }, 300000);

    } catch (error) {
      console.error(`Failed to connect ${platformId}:`, error);
      setConnectionStatuses(prev => ({ ...prev, [platformId]: 'error' }));
      setConnecting(null);
    }
  };

  const getOAuthUrl = async (platform: string): Promise<string> => {
    // In a real implementation, this would call your backend to get the OAuth URL
    const baseUrls = {
      instagram: 'https://api.instagram.com/oauth/authorize',
      youtube: 'https://accounts.google.com/oauth/authorize',
      twitter: 'https://twitter.com/i/oauth2/authorize',
      facebook: 'https://www.facebook.com/v18.0/dialog/oauth'
    };

    const clientIds = {
      instagram: process.env.REACT_APP_INSTAGRAM_CLIENT_ID || 'demo_client_id',
      youtube: process.env.REACT_APP_GOOGLE_CLIENT_ID || 'demo_client_id',
      twitter: process.env.REACT_APP_TWITTER_CLIENT_ID || 'demo_client_id',
      facebook: process.env.REACT_APP_FACEBOOK_CLIENT_ID || 'demo_client_id'
    };

    const redirectUri = `${window.location.origin}/auth/callback/${platform}`;
    
    return `${baseUrls[platform as keyof typeof baseUrls]}?client_id=${clientIds[platform as keyof typeof clientIds]}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read`;
  };

  const completeConnection = async (platform: string, authCode: string) => {
    try {
      // This would normally send the auth code to your backend
      await dispatch(connectSocialPlatform({
        platform,
        authCode,
        // Mock profile data - in real app this would come from the OAuth response
        profile: {
          id: `${platform}_user_123`,
          username: `user_${platform}`,
          displayName: `${platform.charAt(0).toUpperCase() + platform.slice(1)} User`,
          profilePicture: `https://via.placeholder.com/150?text=${platform.charAt(0).toUpperCase()}`
        }
      })).unwrap();

      setConnectionStatuses(prev => ({ ...prev, [platform]: 'connected' }));
    } catch (error) {
      console.error(`Failed to complete ${platform} connection:`, error);
      setConnectionStatuses(prev => ({ ...prev, [platform]: 'error' }));
    } finally {
      setConnecting(null);
    }
  };

  const getConnectionStatus = (platformId: string) => {
    return connectionStatuses[platformId] || 'disconnected';
  };

  const connectedCount = Object.values(connectionStatuses).filter(status => status === 'connected').length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </motion.div>
        
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Connect Your Social Media
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Link your social media accounts to create a unified, AI-powered feed. 
          Your data stays private and secure while enabling personalized insights.
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Connected Platforms
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {connectedCount} / {platforms.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(connectedCount / platforms.length) * 100}%` }}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-500"
          />
        </div>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {platforms.map((platform, index) => {
          const status = getConnectionStatus(platform.id);
          const isConnecting = connecting === platform.id;
          const isConnected = status === 'connected';
          const hasError = status === 'error';

          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                isConnected
                  ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/10'
                  : hasError
                  ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {/* Background Gradient */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${platform.color} opacity-10 rounded-full transform translate-x-16 -translate-y-16`} />
              
              <div className="relative p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${platform.color} text-white`}>
                      {platform.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {platform.name}
                      </h3>
                      {isConnected && (
                        <div className="flex items-center space-x-1 text-sm text-green-600 dark:text-green-400">
                          <CheckIcon />
                          <span>Connected</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isConnected && (
                    <div className="flex items-center text-green-500">
                      <CheckIcon />
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {platform.description}
                </p>

                {/* Features */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {platform.features.map((feature, featureIndex) => (
                      <span
                        key={featureIndex}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleConnect(platform.id)}
                  disabled={isConnecting || loading}
                  className={`w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                    isConnected
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      : hasError
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isConnecting ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting...</span>
                    </div>
                  ) : isConnected ? (
                    <div className="flex items-center space-x-2">
                      <span>Disconnect</span>
                    </div>
                  ) : hasError ? (
                    <span>Retry Connection</span>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <ExternalLinkIcon />
                      <span>Connect</span>
                    </div>
                  )}
                </motion.button>

                {hasError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    Connection failed. Please try again.
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        {showSkip && (
          <button
            onClick={onComplete}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Skip for now
          </button>
        )}
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onComplete}
          disabled={connectedCount === 0}
          className={`ml-auto px-6 py-3 rounded-lg font-medium text-white transition-all ${
            connectedCount > 0
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {connectedCount > 0 ? 'Continue to App' : 'Connect at least one platform'}
        </motion.button>
      </div>

      {/* Benefits */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 text-center"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          What happens after connecting?
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z" />
              </svg>
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Unified Analytics</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get comprehensive insights across all your connected platforms in one place.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">AI Recommendations</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Receive personalized content suggestions and optimal posting strategies.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Secure & Private</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your data is encrypted and processed securely. You control what's shared.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SocialConnections;
