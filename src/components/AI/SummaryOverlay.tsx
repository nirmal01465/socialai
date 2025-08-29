import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Post } from '../../types';
import { api } from '../../services/api';
import { formatNumber, extractDominantColor } from '../../utils/helpers';
import { formatDistanceToNow } from 'date-fns';

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
  </svg>
);

const BrainIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const TrendingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const TagIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

interface AIAnalysis {
  summary: string;
  keyPoints: string[];
  sentiment: {
    score: number;
    label: string;
    confidence: number;
  };
  topics: string[];
  engagementPrediction: {
    score: number;
    factors: string[];
  };
  similarContent: Array<{
    id: string;
    title: string;
    similarity: number;
  }>;
}

interface SummaryOverlayProps {
  post: Post;
  onClose: () => void;
}

const SummaryOverlay: React.FC<SummaryOverlayProps> = ({ post, onClose }) => {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'analysis' | 'similar'>('summary');

  useEffect(() => {
    const generateAnalysis = async () => {
      setLoading(true);
      setError(null);

      try {
        // Generate AI summary and analysis
        const [summaryResponse, analysisResponse] = await Promise.all([
          api.post('/ai/summarize', {
            content: post.text,
            summaryType: 'detailed',
            maxLength: 300
          }),
          api.post('/ai/sentiment', {
            text: post.text,
            includeEmotions: true
          })
        ]);

        // Get similar content
        const similarResponse = await api.get(`/feed/post/${post.id}`);

        const aiAnalysis: AIAnalysis = {
          summary: summaryResponse.data.summary,
          keyPoints: extractKeyPoints(post.text),
          sentiment: {
            score: analysisResponse.data.sentiment.rating,
            label: getSentimentLabel(analysisResponse.data.sentiment.rating),
            confidence: analysisResponse.data.sentiment.confidence
          },
          topics: post.metadata?.aiAnalysis?.topics || extractTopics(post.text),
          engagementPrediction: {
            score: post.metadata?.aiAnalysis?.engagementPotential || 7,
            factors: generateEngagementFactors(post)
          },
          similarContent: similarResponse.data.analysis?.similarPosts || []
        };

        setAnalysis(aiAnalysis);
      } catch (err) {
        console.error('Failed to generate AI analysis:', err);
        setError('Failed to generate AI analysis. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    generateAnalysis();
  }, [post]);

  const extractKeyPoints = (text: string): string[] => {
    // Simple key point extraction - in real app, this would use AI
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 3).map(s => s.trim());
  };

  const extractTopics = (text: string): string[] => {
    // Simple topic extraction - in real app, this would use AI
    const words = text.toLowerCase().split(/\W+/);
    const topics = words.filter(word => 
      word.length > 5 && 
      !['this', 'that', 'with', 'from', 'they', 'have', 'been'].includes(word)
    );
    return [...new Set(topics)].slice(0, 5);
  };

  const getSentimentLabel = (score: number): string => {
    if (score >= 4) return 'Very Positive';
    if (score >= 3.5) return 'Positive';
    if (score >= 2.5) return 'Neutral';
    if (score >= 2) return 'Negative';
    return 'Very Negative';
  };

  const generateEngagementFactors = (post: Post): string[] => {
    const factors = [];
    
    if (post.stats.likes > 100) factors.push('High like count');
    if (post.stats.comments > 10) factors.push('Active discussion');
    if (post.tags.length > 3) factors.push('Well-tagged content');
    if (post.text.length > 200) factors.push('Detailed content');
    if (post.creator.verified) factors.push('Verified creator');
    
    return factors;
  };

  const getSentimentColor = (score: number) => {
    if (score >= 4) return 'text-green-600 dark:text-green-400';
    if (score >= 3.5) return 'text-blue-600 dark:text-blue-400';
    if (score >= 2.5) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 2) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getEngagementColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 6) return 'text-blue-600 dark:text-blue-400';
    if (score >= 4) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <BrainIcon />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                AI Content Analysis
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Powered by advanced AI insights
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

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {[
            { id: 'summary', label: 'Summary', icon: <SparklesIcon /> },
            { id: 'analysis', label: 'Analysis', icon: <BrainIcon /> },
            { id: 'similar', label: 'Similar', icon: <TrendingIcon /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Generating AI analysis...</p>
          </div>
        )}

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

        {analysis && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  {/* Original Post Preview */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <img
                        src={post.creator.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.creator.handle}`}
                        alt={post.creator.displayName}
                        className="w-8 h-8 rounded-full"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {post.creator.displayName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(post.timePublished), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      {post.text.length > 200 ? `${post.text.substring(0, 200)}...` : post.text}
                    </p>
                  </div>

                  {/* AI Summary */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      AI Summary
                    </h3>
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-700">
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {analysis.summary}
                      </p>
                    </div>
                  </div>

                  {/* Key Points */}
                  {analysis.keyPoints.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Key Points
                      </h3>
                      <div className="space-y-2">
                        {analysis.keyPoints.map((point, index) => (
                          <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 flex-1">
                              {point}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="space-y-6">
                  {/* Sentiment Analysis */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Sentiment Analysis
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Overall Sentiment
                        </span>
                        <span className={`text-sm font-bold ${getSentimentColor(analysis.sentiment.score)}`}>
                          {analysis.sentiment.label}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                        <div
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(analysis.sentiment.score / 5) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Confidence: {Math.round(analysis.sentiment.confidence * 100)}%
                      </p>
                    </div>
                  </div>

                  {/* Topics */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Detected Topics
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analysis.topics.map((topic, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium"
                        >
                          <TagIcon />
                          <span>{topic}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Engagement Prediction */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Engagement Prediction
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Predicted Engagement Score
                        </span>
                        <span className={`text-lg font-bold ${getEngagementColor(analysis.engagementPrediction.score)}`}>
                          {analysis.engagementPrediction.score}/10
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Contributing Factors:
                        </p>
                        {analysis.engagementPrediction.factors.map((factor, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{factor}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'similar' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Similar Content
                  </h3>
                  
                  {analysis.similarContent.length > 0 ? (
                    <div className="space-y-3">
                      {analysis.similarContent.map((similar, index) => (
                        <div key={similar.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {similar.title}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {Math.round(similar.similarity * 100)}% similarity
                            </p>
                          </div>
                          <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                            <div
                              className="h-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full"
                              style={{ width: `${similar.similarity * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <TrendingIcon />
                      <p className="mt-2">No similar content found</p>
                      <p className="text-sm">This appears to be unique content</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default SummaryOverlay;
