import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { markNotificationAsRead, dismissNotification } from '../../store/slices/uiSlice';
import { formatDistanceToNow } from 'date-fns';

const BellIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 3a7.016 7.016 0 00-7 7v4l-2 2v1h7m2-8a7.016 7.016 0 017 7v4l2 2v1h-7" />
  </svg>
);

const AIIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const TrendingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const MessageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

interface Notification {
  id: string;
  type: 'ai_insight' | 'engagement' | 'trending' | 'suggestion' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  actions?: Array<{
    label: string;
    action: string;
    type: 'primary' | 'secondary';
  }>;
  metadata?: any;
}

const SmartNotifications: React.FC = () => {
  const dispatch = useAppDispatch();
  const { notifications } = useAppSelector(state => state.ui);
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);
  const [bundledNotifications, setBundledNotifications] = useState<Notification[]>([]);

  // Bundle and prioritize notifications
  useEffect(() => {
    const unreadNotifications = notifications.filter(n => !n.read);
    
    // Sort by priority and timestamp
    const sortedNotifications = unreadNotifications.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Bundle similar notifications
    const bundled = bundleNotifications(sortedNotifications);
    setBundledNotifications(bundled);

    // Show only top 3 notifications
    setVisibleNotifications(bundled.slice(0, 3));
  }, [notifications]);

  const bundleNotifications = (notifications: Notification[]): Notification[] => {
    const bundles: { [key: string]: Notification[] } = {};
    const bundled: Notification[] = [];

    notifications.forEach(notification => {
      const bundleKey = `${notification.type}_${notification.priority}`;
      
      if (!bundles[bundleKey]) {
        bundles[bundleKey] = [];
      }
      bundles[bundleKey].push(notification);
    });

    Object.entries(bundles).forEach(([key, group]) => {
      if (group.length === 1) {
        bundled.push(group[0]);
      } else {
        // Create bundled notification
        const bundledNotification: Notification = {
          id: `bundle_${key}_${Date.now()}`,
          type: group[0].type,
          title: getBundleTitle(group[0].type, group.length),
          message: getBundleMessage(group[0].type, group.length),
          timestamp: group[0].timestamp,
          read: false,
          priority: group[0].priority,
          actionable: group.some(n => n.actionable),
          actions: getBundleActions(group[0].type),
          metadata: {
            bundled: true,
            count: group.length,
            notifications: group.map(n => n.id)
          }
        };
        bundled.push(bundledNotification);
      }
    });

    return bundled;
  };

  const getBundleTitle = (type: string, count: number): string => {
    switch (type) {
      case 'ai_insight':
        return `${count} AI Insights`;
      case 'engagement':
        return `${count} New Interactions`;
      case 'trending':
        return `${count} Trending Updates`;
      default:
        return `${count} Notifications`;
    }
  };

  const getBundleMessage = (type: string, count: number): string => {
    switch (type) {
      case 'ai_insight':
        return `You have ${count} new AI-generated insights about your content and audience.`;
      case 'engagement':
        return `${count} people have interacted with your posts.`;
      case 'trending':
        return `${count} trending topics match your interests.`;
      default:
        return `You have ${count} new notifications.`;
    }
  };

  const getBundleActions = (type: string) => {
    switch (type) {
      case 'ai_insight':
        return [
          { label: 'View Insights', action: 'view_insights', type: 'primary' as const },
          { label: 'Dismiss All', action: 'dismiss_all', type: 'secondary' as const }
        ];
      case 'engagement':
        return [
          { label: 'View Activity', action: 'view_activity', type: 'primary' as const },
          { label: 'Mark Read', action: 'mark_read', type: 'secondary' as const }
        ];
      default:
        return [
          { label: 'View All', action: 'view_all', type: 'primary' as const }
        ];
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ai_insight':
        return <AIIcon />;
      case 'engagement':
        return <HeartIcon />;
      case 'trending':
        return <TrendingIcon />;
      case 'suggestion':
        return <MessageIcon />;
      default:
        return <BellIcon />;
    }
  };

  const getNotificationColor = (type: string, priority: string) => {
    const baseColors = {
      ai_insight: 'from-indigo-500 to-purple-500',
      engagement: 'from-pink-500 to-red-500',
      trending: 'from-orange-500 to-yellow-500',
      suggestion: 'from-green-500 to-blue-500',
      system: 'from-gray-500 to-gray-600'
    };

    return baseColors[type as keyof typeof baseColors] || baseColors.system;
  };

  const handleNotificationClick = (notification: Notification) => {
    dispatch(markNotificationAsRead(notification.id));
    
    if (notification.metadata?.bundled) {
      // Handle bundled notification
      notification.metadata.notifications.forEach((id: string) => {
        dispatch(markNotificationAsRead(id));
      });
    }
  };

  const handleDismiss = (notification: Notification, event: React.MouseEvent) => {
    event.stopPropagation();
    dispatch(dismissNotification(notification.id));
    
    if (notification.metadata?.bundled) {
      notification.metadata.notifications.forEach((id: string) => {
        dispatch(dismissNotification(id));
      });
    }
  };

  const handleAction = (notification: Notification, action: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    switch (action) {
      case 'view_insights':
        // Navigate to AI insights page
        window.location.href = '/insights';
        break;
      case 'view_activity':
        // Navigate to activity page
        window.location.href = '/activity';
        break;
      case 'dismiss_all':
        handleDismiss(notification, event);
        break;
      case 'mark_read':
        handleNotificationClick(notification);
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  return (
    <div className="fixed top-20 right-4 z-40 space-y-3 max-w-sm w-full">
      <AnimatePresence>
        {visibleNotifications.map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 300, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.9 }}
            transition={{
              type: "spring",
              damping: 20,
              stiffness: 300,
              delay: index * 0.1
            }}
            whileHover={{ scale: 1.02, x: -5 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer"
            onClick={() => handleNotificationClick(notification)}
          >
            {/* Header with gradient */}
            <div className={`h-1 bg-gradient-to-r ${getNotificationColor(notification.type, notification.priority)}`} />
            
            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-lg bg-gradient-to-r ${getNotificationColor(notification.type, notification.priority)} text-white`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                      {notification.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  {notification.priority === 'high' && (
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                  <button
                    onClick={(e) => handleDismiss(notification, e)}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              {/* Content */}
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
                {notification.message}
              </p>

              {/* Bundled notification indicator */}
              {notification.metadata?.bundled && (
                <div className="flex items-center space-x-2 mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex -space-x-1">
                    {[...Array(Math.min(notification.metadata.count, 3))].map((_, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full border border-white dark:border-gray-800"
                      />
                    ))}
                    {notification.metadata.count > 3 && (
                      <div className="w-4 h-4 bg-gray-400 dark:bg-gray-500 rounded-full border border-white dark:border-gray-800 flex items-center justify-center text-xs text-white font-bold">
                        +
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {notification.metadata.count} notifications bundled
                  </span>
                </div>
              )}

              {/* Actions */}
              {notification.actionable && notification.actions && (
                <div className="flex space-x-2">
                  {notification.actions.map((action, actionIndex) => (
                    <motion.button
                      key={actionIndex}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => handleAction(notification, action.action, e)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        action.type === 'primary'
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {action.label}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Show more indicator */}
      {bundledNotifications.length > 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
            +{bundledNotifications.length - 3} more notifications
          </button>
        </div>
      )}

      {/* Toast container styles */}
      <style jsx>{`
        @media (max-width: 640px) {
          .fixed.top-20.right-4 {
            top: 70px;
            right: 1rem;
            left: 1rem;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
};

export default SmartNotifications;
