import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Post } from '../../types';
import { formatNumber, extractDominantColor } from '../../utils/helpers';

const HeartIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg className={`w-5 h-5 ${filled ? 'fill-red-500 text-red-500' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const CommentIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const ShareIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
  </svg>
);

const BookmarkIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg className={`w-5 h-5 ${filled ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

const MoreIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
  </svg>
);

const AIIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const PlayIcon = () => (
  <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

interface FeedCardProps {
  post: Post;
  onPostClick: (post: Post) => void;
  onEngagement: (postId: string, type: string, metadata?: any) => void;
  onWhyThisPost?: (postId: string) => void;
  showAIFeatures?: boolean;
  adaptiveLayout?: boolean;
}

const FeedCard: React.FC<FeedCardProps> = ({
  post,
  onPostClick,
  onEngagement,
  onWhyThisPost,
  showAIFeatures = true,
  adaptiveLayout = false
}) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [dominantColor, setDominantColor] = useState<string>('#f3f4f6');
  const [isVisible, setIsVisible] = useState(false);
  const [dwellTime, setDwellTime] = useState(0);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const viewStartTime = useRef<number>(0);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for view tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          viewStartTime.current = Date.now();
          onEngagement(post.id, 'view', { source: 'feed_scroll' });
        } else {
          if (isVisible && viewStartTime.current > 0) {
            const viewDuration = Date.now() - viewStartTime.current;
            setDwellTime(viewDuration);
            onEngagement(post.id, 'view_end', { dwellTime: viewDuration });
          }
          setIsVisible(false);
        }
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [post.id, onEngagement, isVisible]);

  // Click outside handler for more actions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target as Node)) {
        setShowMoreActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Extract dominant color from thumbnail
  useEffect(() => {
    if (post.thumbnail && imageLoaded) {
      extractDominantColor(post.thumbnail).then(setDominantColor);
    }
  }, [post.thumbnail, imageLoaded]);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(!liked);
    onEngagement(post.id, liked ? 'unlike' : 'like', { 
      source: 'feed_card',
      newState: !liked 
    });
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEngagement(post.id, 'comment_intent', { source: 'feed_card' });
    onPostClick(post);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEngagement(post.id, 'share_intent', { source: 'feed_card' });
    
    if (navigator.share) {
      navigator.share({
        title: `${post.creator.displayName} on ${post.platform}`,
        text: post.text.substring(0, 100) + '...',
        url: post.url
      });
    } else {
      navigator.clipboard.writeText(post.url);
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved(!saved);
    onEngagement(post.id, saved ? 'unsave' : 'save', { 
      source: 'feed_card',
      newState: !saved 
    });
  };

  const handleCardClick = () => {
    onEngagement(post.id, 'click', { source: 'feed_card' });
    onPostClick(post);
  };

  const handleWhyThis = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWhyThisPost?.(post.id);
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      instagram: 'from-purple-500 to-pink-500',
      youtube: 'from-red-500 to-red-600',
      twitter: 'from-blue-400 to-blue-500',
      facebook: 'from-blue-600 to-blue-700'
    };
    return colors[platform as keyof typeof colors] || 'from-gray-500 to-gray-600';
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'short':
        return '📱';
      case 'longform':
        return '📹';
      case 'image':
        return '📷';
      case 'thread':
        return '🧵';
      case 'live':
        return '🔴';
      default:
        return '📄';
    }
  };

  const isVideo = post.type === 'short' || post.type === 'longform' || post.type === 'live';
  const hasMedia = post.thumbnail || post.mediaUrl;

  return (
    <motion.article
      ref={cardRef}
      layout={adaptiveLayout}
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Post Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {/* Creator Avatar */}
            <div className="relative">
              <img
                src={post.creator.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.creator.handle}`}
                alt={post.creator.displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
              {/* Platform Badge */}
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r ${getPlatformColor(post.platform)} rounded-full flex items-center justify-center text-xs text-white font-bold`}>
                {post.platform.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Creator Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {post.creator.displayName}
                </h3>
                {post.creator.verified && (
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{post.creator.handle}</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(post.timePublished), { addSuffix: true })}</span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <span>{getContentTypeIcon(post.type)}</span>
                  <span className="capitalize">{post.type}</span>
                </span>
              </div>
            </div>
          </div>

          {/* More Actions */}
          <div className="relative" ref={moreActionsRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMoreActions(!showMoreActions);
              }}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <MoreIcon />
            </button>

            <AnimatePresence>
              {showMoreActions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-10"
                >
                  {showAIFeatures && onWhyThisPost && (
                    <button
                      onClick={handleWhyThis}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <AIIcon />
                      <span>Why this post?</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoreActions(false);
                      window.open(post.url, '_blank');
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    View on {post.platform}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoreActions(false);
                      onEngagement(post.id, 'report', { source: 'more_menu' });
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Report content
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        {post.text && (
          <p className="text-gray-900 dark:text-white leading-relaxed">
            {post.text.length > 280 ? (
              <>
                {post.text.substring(0, 280)}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPostClick(post);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline ml-1"
                >
                  ...see more
                </button>
              </>
            ) : (
              post.text
            )}
          </p>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.tags.slice(0, 5).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onEngagement(post.id, 'tag_click', { tag });
                }}
              >
                #{tag}
              </span>
            ))}
            {post.tags.length > 5 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{post.tags.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Media Content */}
      {hasMedia && (
        <div className="relative">
          {!imageLoaded && (
            <div 
              className="w-full h-64 flex items-center justify-center"
              style={{ backgroundColor: dominantColor }}
            >
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          
          <div className="relative group">
            <img
              src={post.thumbnail || post.mediaUrl}
              alt={post.text}
              className={`w-full h-64 sm:h-80 object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />

            {/* Video Play Button */}
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-16 h-16 bg-black bg-opacity-70 rounded-full flex items-center justify-center group-hover:bg-opacity-80 transition-all"
                >
                  <PlayIcon />
                </motion.div>
              </div>
            )}

            {/* Duration Badge */}
            {post.durationS && (
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                {Math.floor(post.durationS / 60)}:{(post.durationS % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {showAIFeatures && post.metadata?.aiAnalysis && (
        <div className="px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
          <div className="flex items-center space-x-2 text-xs">
            <AIIcon />
            <span className="text-indigo-700 dark:text-indigo-300">
              AI detected: {post.metadata.aiAnalysis.topics.slice(0, 3).join(', ')}
            </span>
            <span className="text-indigo-600 dark:text-indigo-400">
              • {post.metadata.aiAnalysis.engagementPotential}/10 engagement potential
            </span>
          </div>
        </div>
      )}

      {/* Engagement Actions */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {/* Main Actions */}
          <div className="flex items-center space-x-6">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleLike}
              className={`flex items-center space-x-2 text-sm font-medium transition-colors ${
                liked 
                  ? 'text-red-500' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-red-500'
              }`}
            >
              <HeartIcon filled={liked} />
              <span>{formatNumber(post.stats.likes + (liked ? 1 : 0))}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleComment}
              className="flex items-center space-x-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors"
            >
              <CommentIcon />
              <span>{formatNumber(post.stats.comments)}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleShare}
              className="flex items-center space-x-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-green-500 transition-colors"
            >
              <ShareIcon />
              <span>{formatNumber(post.stats.shares)}</span>
            </motion.button>
          </div>

          {/* Secondary Actions */}
          <div className="flex items-center space-x-2">
            {post.stats.views > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatNumber(post.stats.views)} views
              </span>
            )}
            
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              className={`p-2 rounded-full transition-colors ${
                saved 
                  ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <BookmarkIcon filled={saved} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export default FeedCard;
