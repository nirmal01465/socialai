import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setActiveView, toggleSidebar } from '../../store/slices/uiSlice';

// Icons
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const FeedIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const TrendingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const AIIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const ConnectIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
  isCollapsed: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ 
  icon, 
  label, 
  isActive, 
  onClick, 
  badge,
  isCollapsed 
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-r-2 border-indigo-600 dark:border-indigo-400'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
      title={isCollapsed ? label : undefined}
    >
      <div className="flex-shrink-0">
        {icon}
      </div>
      
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="truncate"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      
      {badge && badge > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex-shrink-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium"
        >
          {badge > 9 ? '9+' : badge}
        </motion.span>
      )}
    </motion.button>
  );
};

const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const { activeView, sidebarCollapsed, notifications } = useAppSelector(state => state.ui);
  const { user } = useAppSelector(state => state.auth);
  
  const [hovering, setHovering] = useState(false);

  const navigationItems = [
    {
      id: 'home',
      icon: <HomeIcon />,
      label: 'Home',
      badge: 0
    },
    {
      id: 'feed',
      icon: <FeedIcon />,
      label: 'Unified Feed',
      badge: 0
    },
    {
      id: 'trending',
      icon: <TrendingIcon />,
      label: 'Trending',
      badge: 0
    },
    {
      id: 'search',
      icon: <SearchIcon />,
      label: 'Discover',
      badge: 0
    },
    {
      id: 'analytics',
      icon: <AnalyticsIcon />,
      label: 'Analytics',
      badge: 0
    },
    {
      id: 'ai-insights',
      icon: <AIIcon />,
      label: 'AI Insights',
      badge: notifications.filter(n => !n.read && n.type === 'ai_insight').length
    }
  ];

  const settingsItems = [
    {
      id: 'connections',
      icon: <ConnectIcon />,
      label: 'Social Connections',
      badge: 0
    },
    {
      id: 'settings',
      icon: <SettingsIcon />,
      label: 'Settings',
      badge: 0
    }
  ];

  const handleNavClick = (viewId: string) => {
    dispatch(setActiveView(viewId));
  };

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const isCollapsed = sidebarCollapsed && !hovering;
  const connectedPlatforms = user?.connectedPlatforms?.filter(p => p.isActive) || [];

  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(toggleSidebar())}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? 72 : 280,
          x: sidebarCollapsed ? -280 : 0
        }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="fixed left-0 top-16 bottom-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-50 lg:z-30 lg:translate-x-0 flex flex-col"
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center space-x-2"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <AIIcon />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                      AI Social
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {connectedPlatforms.length} platform{connectedPlatforms.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleToggleSidebar}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
            >
              {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </motion.button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Main navigation */}
          <div>
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3"
                >
                  Navigation
                </motion.h3>
              )}
            </AnimatePresence>
            
            <div className="space-y-1">
              {navigationItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={activeView === item.id}
                  onClick={() => handleNavClick(item.id)}
                  badge={item.badge}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>
          </div>

          {/* Connected platforms */}
          {connectedPlatforms.length > 0 && (
            <div>
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.h3
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3"
                  >
                    Connected Platforms
                  </motion.h3>
                )}
              </AnimatePresence>
              
              <div className="space-y-1">
                {connectedPlatforms.map((platform, index) => (
                  <div
                    key={platform.platform + index}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg ${
                      isCollapsed ? 'justify-center' : ''
                    }`}
                    title={isCollapsed ? platform.platform : undefined}
                  >
                    <div className={`w-4 h-4 rounded-sm ${
                      platform.platform === 'instagram' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                      platform.platform === 'youtube' ? 'bg-red-600' :
                      platform.platform === 'twitter' ? 'bg-blue-500' :
                      platform.platform === 'facebook' ? 'bg-blue-600' :
                      'bg-gray-500'
                    }`} />
                    
                    <AnimatePresence mode="wait">
                      {!isCollapsed && (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="flex-1"
                        >
                          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {platform.platform}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            @{platform.profile.username}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3"
                >
                  Settings
                </motion.h3>
              )}
            </AnimatePresence>
            
            <div className="space-y-1">
              {settingsItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={activeView === item.id}
                  onClick={() => handleNavClick(item.id)}
                  badge={item.badge}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>
          </div>
        </div>

        {/* User status indicator */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-xs text-gray-500 dark:text-gray-400"
                >
                  AI Assistant Active
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
