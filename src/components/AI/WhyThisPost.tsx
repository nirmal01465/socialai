import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const BrainIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ThumbUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
  </svg>
);

const ThumbDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2M17 4h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
  </svg>
);

interface ExplanationData {
  reasoning: string;
  factors: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
  }>;
  personalization: {
    basedOnYourInterests: string[];
    similarToLikedContent: boolean;
    optimalForYourSchedule: boolean;
    matchesYourBehavior: string[];
  };
  alternatives: {
    show_less: string;
    hide_similar: string;
    adjust_preferences: string;
  };
}

interface WhyThisPostProps {
  postId: string;
  onClose: () => void;
}

const WhyThisPost: React.FC<WhyThisPostProps> = ({ postId, onClose }) => {
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);

  useEffect(() => {
    const fetchExplanation = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.post('/ai/explain', {
          postId,
          action: 'recommended'
        });

        // Transform the response into our expected format
        const explanationData: ExplanationData = {
          reasoning: response.data.explanation.reasoning || 'This post was recommended based on your activity patterns and interests.',
          factors: response.data.explanation.factors?.map((factor: string) => ({
            factor: factor,
            impact: 'medium' as const,
            description: getFactorDescription(factor)
          })) || [],
          personalization: {
            basedOnYourInterests: response.data.explanation.personalization?.basedOnYourInterests || [],
            similarToLikedContent: response.data.explanation.personalization?.similarToLikedContent ?? true,
            optimalForYourSchedule: response.data.explanation.personalization?.optimalForYourSchedule ?? true,
            matchesYourBehavior: getMatchingBehaviors()
          },
          alternatives: {
            show_less: 'See fewer posts like this',
            hide_similar: 'Hide similar content',
            adjust_preferences: 'Adjust your content preferences'
          }
        };

        setExplanation(explanationData);
      } catch (err) {
        console.error('Failed to fetch explanation:', err);
        setError('Failed to load explanation. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchExplanation();
  }, [postId]);

  const getFactorDescription = (factor: string): string => {
    const descriptions: { [key: string]: string } = {
      'relevance': 'Content matches your interests and past interactions',
      'timing': 'Posted at a time when you\'re typically active',
      'popularity': 'High engagement from users with similar interests',
      'topic_match': 'Related to topics you frequently engage with',
      'creator_affinity': 'You\'ve interacted with this creator before',
      'freshness': 'Recently posted content',
      'engagement_potential': 'Likely to generate meaningful discussions'
    };
    return descriptions[factor] || 'Contributes to the overall recommendation score';
  };

  const getMatchingBehaviors = (): string[] => {
    // This would come from the API in a real implementation
    return [
      'You typically engage with similar content',
      'Posted during your active hours',
      'Matches your reading preferences'
    ];
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'low':
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const handleFeedback = async (type: 'helpful' | 'not_helpful') => {
    setFeedback(type);
    
    try {
      await api.post('/ai/feedback', {
        postId,
        explanationFeedback: type,
        context: 'why_this_post'
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleAlternativeAction = async (action: string) => {
    try {
      await api.post('/ai/adjust-preferences', {
        postId,
        action,
        context: 'why_this_post'
      });
      
      // Show success message and close
      onClose();
    } catch (error) {
      console.error('Failed to adjust preferences:', error);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
            <BrainIcon />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Why you're seeing this post
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AI explanation of recommendation factors
            </p>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-400">Analyzing recommendation...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.19 2.5 1.732 2.5z" />
            </svg>
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Explanation Content */}
      {explanation && (
        <div className="space-y-6">
          {/* Main Reasoning */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              Main Reason
            </h3>
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-700">
              <p className="text-gray-700 dark:text-gray-300">
                {explanation.reasoning}
              </p>
            </div>
          </div>

          {/* Contributing Factors */}
          {explanation.factors.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                Contributing Factors
              </h3>
              <div className="space-y-2">
                {explanation.factors.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <CheckIcon />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white capitalize">
                          {item.factor.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(item.impact)}`}>
                      {item.impact} impact
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Personalization Details */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              Personal Relevance
            </h3>
            <div className="space-y-3">
              
              {/* Based on Interests */}
              {explanation.personalization.basedOnYourInterests.length > 0 && (
                <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <CheckIcon />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Matches your interests
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Related to: {explanation.personalization.basedOnYourInterests.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Similar Content */}
              <div className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                {explanation.personalization.similarToLikedContent ? <CheckIcon /> : <XIcon />}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Similar to content you've liked
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {explanation.personalization.similarToLikedContent 
                      ? 'This type of content has received positive feedback from you'
                      : 'This is different from your usual preferences - exploring new content'
                    }
                  </p>
                </div>
              </div>

              {/* Optimal Timing */}
              <div className="flex items-start space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                {explanation.personalization.optimalForYourSchedule ? <CheckIcon /> : <XIcon />}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Posted at your active time
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {explanation.personalization.optimalForYourSchedule
                      ? 'Shared when you typically browse social media'
                      : 'Posted outside your usual active hours'
                    }
                  </p>
                </div>
              </div>

              {/* Behavior Matching */}
              {explanation.personalization.matchesYourBehavior.length > 0 && (
                <div className="space-y-2">
                  {explanation.personalization.matchesYourBehavior.map((behavior, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <CheckIcon />
                      <p className="text-sm text-gray-700 dark:text-gray-300">{behavior}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alternative Actions */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              Don't want to see this?
            </h3>
            <div className="space-y-2">
              {Object.entries(explanation.alternatives).map(([key, action]) => (
                <button
                  key={key}
                  onClick={() => handleAlternativeAction(key)}
                  className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {action}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Was this explanation helpful?
            </p>
            <div className="flex space-x-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleFeedback('helpful')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                  feedback === 'helpful'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600 text-green-700 dark:text-green-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <ThumbUpIcon />
                <span className="text-sm">Helpful</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleFeedback('not_helpful')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                  feedback === 'not_helpful'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600 text-red-700 dark:text-red-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <ThumbDownIcon />
                <span className="text-sm">Not helpful</span>
              </motion.button>
            </div>

            {feedback && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-gray-500 dark:text-gray-400 mt-2"
              >
                Thank you for your feedback! This helps improve our recommendations.
              </motion.p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhyThisPost;
