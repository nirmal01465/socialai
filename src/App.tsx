import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { store } from './store';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { checkAuthStatus } from './store/slices/authSlice';
import { initializeUI } from './store/slices/uiSlice';

// Components
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import LoginScreen from './components/Auth/LoginScreen';
import SocialConnections from './components/Auth/SocialConnections';
import UnifiedFeed from './components/Feed/UnifiedFeed';
import AdaptiveLayout from './components/Feed/AdaptiveLayout';
import SmartNotifications from './components/Notifications/SmartNotifications';
import CommandBar from './components/AI/CommandBar';

// Hooks
import { useAdaptiveUI } from './hooks/useAdaptiveUI';
import { useBehaviorTracking } from './hooks/useBehaviorTracking';
import { useWebSocket } from './hooks/useWebSocket';

// Services
import { initializeWebSocket } from './services/websocket';

// Styles
import './App.css';

// Loading component
const AppLoader: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Loading AI Social App
      </h2>
      <p className="text-gray-500 dark:text-gray-400">
        Initializing your personalized experience...
      </p>
    </motion.div>
  </div>
);

// Main App component
const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user, loading: authLoading } = useAppSelector(state => state.auth);
  const { theme, adaptiveLayout, commandBarOpen } = useAppSelector(state => state.ui);
  
  const [appInitialized, setAppInitialized] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Custom hooks for advanced features
  const { layoutDecisions, isOptimizing } = useAdaptiveUI();
  useBehaviorTracking();
  const { connected: wsConnected } = useWebSocket();

  // Initialize app on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check authentication status
        await dispatch(checkAuthStatus()).unwrap();
        
        // Initialize UI settings
        dispatch(initializeUI());
        
        // Initialize WebSocket connection
        if (isAuthenticated) {
          await initializeWebSocket();
        }
        
        setAppInitialized(true);
      } catch (error) {
        console.error('App initialization failed:', error);
        setAppInitialized(true); // Still allow app to load
      }
    };

    initializeApp();
  }, [dispatch, isAuthenticated]);

  // Check if user needs onboarding
  useEffect(() => {
    if (isAuthenticated && user && user.connectedPlatforms.length === 0) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated, user]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // Auto theme - check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  // Show loading screen while initializing
  if (!appInitialized || authLoading) {
    return <AppLoader />;
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <LoginScreen />
      </div>
    );
  }

  // Show onboarding for new users
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Welcome to AI Social Super App! 🚀
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Let's connect your social media accounts to create your unified, AI-powered feed
              </p>
            </div>
            
            <SocialConnections 
              onComplete={() => setShowOnboarding(false)}
              showSkip={true}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className={`min-h-screen transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-gray-900 text-white' 
          : 'bg-gray-50 text-gray-900'
      }`}>
        
        {/* Connection status indicator */}
        <AnimatePresence>
          {!wsConnected && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 text-sm font-medium z-50"
            >
              Reconnecting to real-time updates...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <Header />

        {/* Main layout */}
        <div className="flex">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content area */}
          <main className="flex-1 transition-all duration-300 ease-in-out">
            {adaptiveLayout && (
              <AdaptiveLayout layoutDecisions={layoutDecisions}>
                <Routes>
                  <Route path="/" element={<UnifiedFeed />} />
                  <Route path="/feed" element={<UnifiedFeed />} />
                  <Route path="/connections" element={<SocialConnections />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AdaptiveLayout>
            )}

            {!adaptiveLayout && (
              <div className="container mx-auto px-4 py-6 max-w-6xl">
                <Routes>
                  <Route path="/" element={<UnifiedFeed />} />
                  <Route path="/feed" element={<UnifiedFeed />} />
                  <Route path="/connections" element={<SocialConnections />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            )}
          </main>
        </div>

        {/* Smart Notifications */}
        <SmartNotifications />

        {/* AI Command Bar */}
        <AnimatePresence>
          {commandBarOpen && <CommandBar />}
        </AnimatePresence>

        {/* Optimization indicator */}
        <AnimatePresence>
          {isOptimizing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed bottom-4 right-4 bg-indigo-600 text-white rounded-full p-3 shadow-lg z-40"
            >
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Optimizing UI...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Performance monitoring - Development only */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 left-4 bg-black bg-opacity-80 text-white rounded-lg p-2 text-xs font-mono z-40">
            <div>WS: {wsConnected ? '🟢' : '🔴'}</div>
            <div>Theme: {theme}</div>
            <div>Adaptive: {adaptiveLayout ? '🟢' : '🔴'}</div>
            <div>User: {user?.name || 'Unknown'}</div>
          </div>
        )}
      </div>
    </Router>
  );
};

// Root App component with Redux Provider
const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;
