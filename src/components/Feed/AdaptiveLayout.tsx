import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector } from '../../store/hooks';

interface LayoutSection {
  id: string;
  priority: number;
  visible: boolean;
}

interface UIDecisions {
  layout: {
    sections: LayoutSection[];
    featureFlags: { [key: string]: boolean };
  };
  feedRules: {
    blocklist: string[];
    boostTags: string[];
  };
  reasoning?: string;
}

interface AdaptiveLayoutProps {
  children: React.ReactNode;
  layoutDecisions?: UIDecisions;
}

const AdaptiveLayout: React.FC<AdaptiveLayoutProps> = ({ children, layoutDecisions }) => {
  const { behaviorSummary } = useAppSelector(state => state.auth.user || { behaviorSummary: null });
  const { theme } = useAppSelector(state => state.ui);
  
  const [layoutConfig, setLayoutConfig] = useState({
    compactMode: false,
    showInsights: true,
    quickActions: true,
    denseLayout: false,
    sidebarPosition: 'left' as 'left' | 'right',
    columnCount: 1,
    cardSpacing: 'normal' as 'tight' | 'normal' | 'loose'
  });

  // Apply AI-driven layout decisions
  useEffect(() => {
    if (layoutDecisions) {
      const newConfig = { ...layoutConfig };
      
      // Analyze sections to determine layout preferences
      const visibleSections = layoutDecisions.layout.sections.filter(s => s.visible);
      const highPrioritySections = visibleSections.filter(s => s.priority <= 1);
      
      // Compact mode for users with fast scroll behavior
      if (behaviorSummary?.scrollBehavior?.scrollSpeed === 'fast') {
        newConfig.compactMode = true;
        newConfig.cardSpacing = 'tight';
        newConfig.denseLayout = true;
      }
      
      // Dense layout for power users
      if (behaviorSummary?.totalEvents > 500) {
        newConfig.denseLayout = true;
        newConfig.quickActions = true;
      }
      
      // Show insights based on feature flags
      newConfig.showInsights = layoutDecisions.layout.featureFlags.showInsights ?? true;
      
      // Column count based on screen size and content density
      if (window.innerWidth > 1200 && newConfig.denseLayout) {
        newConfig.columnCount = 2;
      }
      
      setLayoutConfig(newConfig);
    }
  }, [layoutDecisions, behaviorSummary]);

  // Responsive adjustments
  useEffect(() => {
    const handleResize = () => {
      const newConfig = { ...layoutConfig };
      
      if (window.innerWidth < 768) {
        newConfig.columnCount = 1;
        newConfig.compactMode = true;
      } else if (window.innerWidth > 1200 && layoutConfig.denseLayout) {
        newConfig.columnCount = 2;
      }
      
      setLayoutConfig(newConfig);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => window.removeEventListener('resize', handleResize);
  }, [layoutConfig.denseLayout]);

  const getLayoutClasses = () => {
    const classes = ['adaptive-layout'];
    
    if (layoutConfig.compactMode) classes.push('compact-mode');
    if (layoutConfig.denseLayout) classes.push('dense-layout');
    if (layoutConfig.columnCount === 2) classes.push('two-column');
    
    classes.push(`spacing-${layoutConfig.cardSpacing}`);
    
    return classes.join(' ');
  };

  const getContainerStyles = () => {
    const baseStyles: React.CSSProperties = {
      transition: 'all 0.3s ease-in-out'
    };

    if (layoutConfig.columnCount === 2) {
      baseStyles.display = 'grid';
      baseStyles.gridTemplateColumns = '1fr 1fr';
      baseStyles.gap = layoutConfig.cardSpacing === 'tight' ? '1rem' : '1.5rem';
    }

    return baseStyles;
  };

  const getSpacingClass = () => {
    switch (layoutConfig.cardSpacing) {
      case 'tight':
        return 'space-y-3';
      case 'loose':
        return 'space-y-8';
      default:
        return 'space-y-6';
    }
  };

  return (
    <div className={getLayoutClasses()}>
      {/* Layout Notification */}
      <AnimatePresence>
        {layoutDecisions?.reasoning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
          >
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  AI Layout Optimization
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {layoutDecisions.reasoning}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Actions Bar */}
      <AnimatePresence>
        {layoutConfig.quickActions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sticky top-16 z-20 mb-4 p-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Quick Actions:
                </span>
                <button className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                  Filter by AI
                </button>
                <button className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                  Show Shorts
                </button>
                <button className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                  Trending Now
                </button>
              </div>
              
              <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{layoutConfig.compactMode ? 'Compact' : 'Standard'}</span>
                <span>•</span>
                <span>{layoutConfig.columnCount} col</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Container */}
      <motion.div
        layout
        className={`adaptive-content ${getSpacingClass()}`}
        style={getContainerStyles()}
        key={`${layoutConfig.columnCount}-${layoutConfig.cardSpacing}`}
      >
        {children}
      </motion.div>

      {/* Layout Controls (Development/Debug) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 p-3 bg-black bg-opacity-80 text-white rounded-lg text-xs font-mono z-50 max-w-sm">
          <div className="font-semibold mb-2">Adaptive Layout Debug</div>
          <div>Compact: {layoutConfig.compactMode ? '✓' : '✗'}</div>
          <div>Dense: {layoutConfig.denseLayout ? '✓' : '✗'}</div>
          <div>Columns: {layoutConfig.columnCount}</div>
          <div>Spacing: {layoutConfig.cardSpacing}</div>
          <div>Quick Actions: {layoutConfig.quickActions ? '✓' : '✗'}</div>
          <div>Insights: {layoutConfig.showInsights ? '✓' : '✗'}</div>
          {behaviorSummary && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div>Scroll Speed: {behaviorSummary.scrollBehavior?.scrollSpeed}</div>
              <div>Events: {behaviorSummary.totalEvents}</div>
              <div>Session: {behaviorSummary.avgSessionDuration}s</div>
            </div>
          )}
        </div>
      )}

      {/* CSS-in-JS Styles */}
      <style jsx>{`
        .adaptive-layout {
          transition: all 0.3s ease-in-out;
        }

        .adaptive-layout.compact-mode .adaptive-content > * {
          transform: scale(0.95);
        }

        .adaptive-layout.dense-layout {
          line-height: 1.4;
        }

        .adaptive-layout.two-column .adaptive-content > * {
          break-inside: avoid;
          margin-bottom: 0;
        }

        .spacing-tight > * + * {
          margin-top: 0.75rem !important;
        }

        .spacing-loose > * + * {
          margin-top: 2rem !important;
        }

        @media (max-width: 768px) {
          .adaptive-layout.compact-mode .adaptive-content > * {
            transform: scale(0.98);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .adaptive-layout,
          .adaptive-content,
          .adaptive-layout.compact-mode .adaptive-content > * {
            transition: none;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
};

export default AdaptiveLayout;
