import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { fetchFeed, loadMorePosts, refreshFeed, setFeedMode } from '../../store/slices/feedSlice';
import { useBehaviorTracking } from '../../hooks/useBehaviorTracking';
import FeedCard from './FeedCard';
import SummaryOverlay from '../AI/SummaryOverlay';
import WhyThisPost from '../AI/WhyThisPost';
import { FeedMode, Post } from '../../types';

const FilterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const TrendingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const BulbIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const feedModes: { id: FeedMode; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'default',
    label: 'For You',
    icon: <BulbIcon />,
    description: 'AI-curated content based on your interests'
  },
  {
    id: 'trending',
    label: 'Trending',
    icon: <TrendingIcon />,
    description: 'What\'s popular right now'
  },
  {
    id: 'quick_hits',
    label: 'Quick Hits',
    icon: <FilterIcon />,
    description: 'Short, engaging content for busy moments'
  },
  {
    id: 'deep_dive',
    label: 'Deep Dive',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>,
    description: 'Long-form content for focused reading'
  }
];

const UnifiedFeed: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    posts,
    loading,
    error,
    hasMore,
    lastFetch,
    mode: currentMode,
    uiDecisions,
    sessionInsights
  } = useAppSelector(state => state.feed);
  
  const { user } = useAppSelector(state => state.auth);
  const { searchQuery, adaptiveLayout } = useAppSelector(state => state.ui);
  
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showWhyThis, setShowWhyThis] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { trackBehavior, trackPostView, trackPostEngagement } = useBehaviorTracking();

  // Initial feed load
  useEffect(() => {
    if (user && user.connectedPlatforms.length > 0) {
      dispatch(fetchFeed({ mode: currentMode, intent: searchQuery || 'default_scroll' }));
    }
  }, [dispatch, user, currentMode]);

  // Search query effect
  useEffect(() => {
    if (searchQuery && searchQuery.trim().length > 2) {
      const delaySearch = setTimeout(() => {
        dispatch(fetchFeed({ 
          mode: currentMode, 
          intent: `search: ${searchQuery}`,
          query: searchQuery 
        }));
      }, 500);

      return () => clearTimeout(delaySearch);
    }
  }, [searchQuery, dispatch, currentMode]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loading) {
          dispatch(loadMorePosts({ mode: currentMode }));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [dispatch, hasMore, loading, currentMode]);

  const handleModeChange = (mode: FeedMode) => {
    dispatch(setFeedMode(mode));
    trackBehavior({
      type: 'ui_interaction',
      metadata: { action: 'feed_mode_change', mode }
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await dispatch(refreshFeed({ mode: currentMode })).unwrap();
      trackBehavior({
        type: 'ui_interaction',
        metadata: { action: 'feed_refresh' }
      });
    } catch (error) {
      console.error('Failed to refresh feed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePostClick = useCallback((post: Post) => {
    setSelectedPost(post);
    trackPostView(post.id, { source: 'feed_detail_view' });
  }, [trackPostView]);

  const handlePostEngagement = useCallback((postId: string, type: string, metadata?: any) => {
    trackPostEngagement(postId, type, metadata);
  }, [trackPostEngagement]);

  const handleWhyThisPost = (postId: string) => {
    setShowWhyThis(postId);
    trackBehavior({
      type: 'ui_interaction',
      metadata: { action: 'why_this_post', postId }
    });
  };

  const connectedPlatforms = user?.connectedPlatforms?.filter(p => p.isActive) || [];

  // Show onboarding if no connected platforms
  if (connectedPlatforms.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8"
        >
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Connect Your Social Media
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Connect your social media accounts to start experiencing your unified, AI-powered feed.
          </p>
          
          <button
            onClick={() => window.location.href = '/connections'}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            Connect Accounts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Feed Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between py-4">
          {/* Feed Mode Selector */}
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {feedModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  currentMode === mode.id
                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title={mode.description}
              >
                {mode.icon}
                <span className="hidden sm:block">{mode.label}</span>
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className={isRefreshing ? 'animate-spin' : ''}>
                <RefreshIcon />
              </div>
              <span className="hidden sm:block">Refresh</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Session Insights */}
      {sessionInsights && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-700"
        >
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BulbIcon />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-indigo-900 dark:text-indigo-200 mb-1">
                AI Insights for this session
              </h4>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {sessionInsights.mode === 'quick_hits' && "Showing bite-sized content perfect for quick browsing."}
                {sessionInsights.mode === 'deep_dive' && "Curated long-form content for focused reading."}
                {sessionInsights.mode === 'trending' && "Latest trending content across your platforms."}
                {sessionInsights.mode === 'default' && "Personalized mix based on your interests and behavior."}
              </p>
              {sessionInsights.suggestedDuration && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                  Suggested session: {sessionInsights.suggestedDuration}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.19 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">
                Failed to load feed
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Feed Content */}
      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
                layout: { duration: 0.3 }
              }}
            >
              <FeedCard
                post={post}
                onPostClick={handlePostClick}
                onEngagement={handlePostEngagement}
                onWhyThisPost={handleWhyThisPost}
                showAIFeatures={uiDecisions?.layout?.featureFlags?.showInsights}
                adaptiveLayout={adaptiveLayout}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading More */}
        {loading && posts.length > 0 && (
          <div className="flex justify-center py-8">
            <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
              <span>Loading more posts...</span>
            </div>
          </div>
        )}

        {/* Initial Loading */}
        {loading && posts.length === 0 && (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 animate-pulse">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                </div>
                <div className="h-48 bg-gray-300 dark:bg-gray-600 rounded-lg mt-4"></div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Trigger */}
        <div ref={loadMoreRef} className="h-10" />

        {/* End of Feed */}
        {!hasMore && posts.length > 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              You've reached the end of your feed
            </p>
            <button
              onClick={handleRefresh}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              Refresh for new content
            </button>
          </div>
        )}
      </div>

      {/* Post Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPost(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <SummaryOverlay
                post={selectedPost}
                onClose={() => setSelectedPost(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Why This Post Modal */}
      <AnimatePresence>
        {showWhyThis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowWhyThis(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full"
              onClick={e => e.stopPropagation()}
            >
              <WhyThisPost
                postId={showWhyThis}
                onClose={() => setShowWhyThis(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UnifiedFeed;
