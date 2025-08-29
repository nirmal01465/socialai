import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { useAdaptiveUI } from '../../hooks/useAdaptiveUI';
import { useBehaviorTracking } from '../../hooks/useBehaviorTracking';

interface SessionMode {
  id: 'quick_hits' | 'deep_dive' | 'discovery' | 'focus' | 'social' | 'learning';
  label: string;
  description: string;
  icon: string;
  adaptations: string[];
  duration?: number;
  color: string;
  bgGradient: string;
}

const SessionModeSelector: React.FC = () => {
  const { user } = useAppSelector(state => state.auth);
  const { currentSessionMode, switchSessionMode, sessionModes } = useAdaptiveUI();
  const { trackSessionMode, currentSession } = useBehaviorTracking();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMode, setSelectedMode] = useState<SessionMode['id']>('discovery');
  const [modeTimer, setModeTimer] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Revolutionary Session Modes with enhanced definitions
  const revolutionaryModes: SessionMode[] = [
    {
      id: 'quick_hits',
      label: 'Quick Hits',
      description: 'Bite-sized content for busy moments',
      icon: '⚡',
      adaptations: [
        'Short-form content prioritized',
        'Minimal card style with fast scanning',
        'Reduced cognitive load',
        'Optimized for 2-5 minute sessions'
      ],
      duration: 900000, // 15 minutes
      color: 'text-yellow-600',
      bgGradient: 'from-yellow-400 to-orange-500'
    },
    {
      id: 'deep_dive',
      label: 'Deep Dive',
      description: 'Immersive content exploration',
      icon: '🌊',
      adaptations: [
        'Long-form content prioritized',
        'Detailed card style with rich context',
        'Related content clustering',
        'Distraction-free reading experience'
      ],
      color: 'text-blue-600',
      bgGradient: 'from-blue-400 to-indigo-600'
    },
    {
      id: 'discovery',
      label: 'Discovery',
      description: 'Explore new interests and creators',
      icon: '🔍',
      adaptations: [
        '40% content outside comfort zone',
        'New creator introductions',
        'Trending topic integration',
        'Serendipity-optimized algorithm'
      ],
      color: 'text-purple-600',
      bgGradient: 'from-purple-400 to-pink-500'
    },
    {
      id: 'focus',
      label: 'Focus',
      description: 'Single topic deep exploration',
      icon: '🎯',
      adaptations: [
        'Topic-specific content only',
        'Expert sources prioritized',
        'Learning progression tracking',
        'Minimal UI distractions'
      ],
      color: 'text-green-600',
      bgGradient: 'from-green-400 to-teal-500'
    },
    {
      id: 'social',
      label: 'Social',
      description: 'Connect and engage with friends',
      icon: '👥',
      adaptations: [
        'Friends and family prioritized',
        'Social interaction opportunities',
        'Conversation starter content',
        'Community engagement focus'
      ],
      color: 'text-pink-600',
      bgGradient: 'from-pink-400 to-rose-500'
    },
    {
      id: 'learning',
      label: 'Learning',
      description: 'Educational and skill-building content',
      icon: '📚',
      adaptations: [
        'Educational content prioritized',
        'Progressive difficulty levels',
        'Knowledge retention optimized',
        'Learning path construction'
      ],
      color: 'text-indigo-600',
      bgGradient: 'from-indigo-400 to-purple-600'
    }
  ];

  // Auto-recommend mode based on context
  const getRecommendedMode = (): SessionMode['id'] => {
    const hour = new Date().getHours();
    const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
    const sessionDuration = currentSession?.duration || 0;

    // Morning intelligence (6-10 AM)
    if (hour >= 6 && hour <= 10) {
      return sessionDuration < 600000 ? 'quick_hits' : 'learning'; // < 10 minutes
    }

    // Work hours intelligence (10 AM - 5 PM)
    if (hour >= 10 && hour <= 17 && !isWeekend) {
      return 'quick_hits'; // Professional focus
    }

    // Evening intelligence (5 PM - 10 PM)
    if (hour >= 17 && hour <= 22) {
      return isWeekend ? 'discovery' : 'deep_dive';
    }

    // Late night (10 PM - 6 AM)
    return 'social';
  };

  // Handle mode selection
  const handleModeSelect = async (mode: SessionMode['id'], duration?: number) => {
    const selectedModeData = revolutionaryModes.find(m => m.id === mode);
    if (!selectedModeData) return;

    setSelectedMode(mode);
    trackSessionMode(mode, 'user_selection');
    
    // Switch mode with AI optimization
    await switchSessionMode(mode, duration);
    
    // Set up timer if duration is specified
    if (duration && duration > 0) {
      setModeTimer(duration);
      setTimeRemaining(duration);
      
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1000) {
            clearInterval(interval);
            setModeTimer(null);
            // Auto-revert to recommended mode
            const recommended = getRecommendedMode();
            handleModeSelect(recommended);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
    
    setIsExpanded(false);
  };

  // Initialize with recommended mode
  useEffect(() => {
    if (user && !selectedMode) {
      const recommended = getRecommendedMode();
      setSelectedMode(recommended);
      handleModeSelect(recommended);
    }
  }, [user]);

  // Format time remaining
  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const currentModeData = revolutionaryModes.find(m => m.id === selectedMode);

  return (
    <div className="relative">
      {/* Current Mode Button */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center space-x-3 px-4 py-3 rounded-2xl bg-gradient-to-r ${
          currentModeData?.bgGradient || 'from-purple-400 to-pink-500'
        } text-white shadow-lg hover:shadow-xl transition-all duration-300`}
        style={{
          background: currentModeData?.bgGradient 
            ? `linear-gradient(to right, var(--tw-gradient-from), var(--tw-gradient-to))` 
            : 'linear-gradient(to right, #a855f7, #ec4899)'
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="text-2xl">{currentModeData?.icon || '🔍'}</span>
        <div className="text-left">
          <div className="font-semibold text-sm">{currentModeData?.label || 'Discovery'}</div>
          {modeTimer && timeRemaining > 0 && (
            <div className="text-xs opacity-90">
              {formatTimeRemaining(timeRemaining)} remaining
            </div>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </motion.button>

      {/* Mode Selection Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
          >
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Choose Your Session Mode
              </h3>
              
              <div className="space-y-2">
                {revolutionaryModes.map((mode) => (
                  <motion.button
                    key={mode.id}
                    onClick={() => handleModeSelect(mode.id, mode.duration)}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
                      selectedMode === mode.id
                        ? 'bg-gradient-to-r ' + mode.bgGradient + ' text-white'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">{mode.icon}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{mode.label}</div>
                        <div className={`text-xs ${
                          selectedMode === mode.id ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {mode.description}
                        </div>
                        {mode.duration && (
                          <div className={`text-xs mt-1 ${
                            selectedMode === mode.id ? 'text-white/80' : 'text-gray-400'
                          }`}>
                            Auto-expires in {Math.floor(mode.duration / 60000)} minutes
                          </div>
                        )}
                      </div>
                      {selectedMode === mode.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Quick Duration Options */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick Sessions</div>
                <div className="flex space-x-2">
                  {[
                    { label: '5m', duration: 300000, mode: 'quick_hits' },
                    { label: '15m', duration: 900000, mode: 'quick_hits' },
                    { label: '30m', duration: 1800000, mode: 'deep_dive' },
                    { label: '1h', duration: 3600000, mode: 'focus' }
                  ].map((option) => (
                    <motion.button
                      key={option.label}
                      onClick={() => handleModeSelect(option.mode as SessionMode['id'], option.duration)}
                      className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Mode Adaptations Tooltip */}
      {currentModeData && !isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-full mt-2 left-0 right-0 bg-black/90 text-white text-xs rounded-lg p-3 pointer-events-none z-40"
        >
          <div className="font-medium mb-1">Current Adaptations:</div>
          <ul className="space-y-1">
            {currentModeData.adaptations.slice(0, 2).map((adaptation, index) => (
              <li key={index} className="flex items-start space-x-1">
                <span className="text-green-400">•</span>
                <span>{adaptation}</span>
              </li>
            ))}
          </ul>
          {currentModeData.adaptations.length > 2 && (
            <div className="text-gray-400 mt-1">
              +{currentModeData.adaptations.length - 2} more adaptations
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default SessionModeSelector;