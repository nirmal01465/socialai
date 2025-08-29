import { useState, useCallback } from 'react';
import { useAppSelector } from '../store/hooks';
import axios from 'axios';

interface AICommand {
  command: string;
  context?: any;
}

interface CommandResult {
  success: boolean;
  action: string;
  parameters: any;
  explanation: string;
  suggestions: string[];
  confidence: number;
  executionPlan?: any;
  type?: string;
  message?: string;
  data?: any;
}

interface CommandSuggestion {
  id: string;
  text: string;
  description: string;
  category: 'search' | 'filter' | 'action' | 'ai' | 'mood' | 'session';
  icon: React.ReactNode;
  confidence: number;
  executionTime?: string;
}

export const useAICommands = () => {
  const { user } = useAppSelector(state => state.auth);
  const { behaviorSummary } = useAppSelector(state => state.behavior || {});
  const { currentSession } = useAppSelector(state => state.ui);
  
  const [processing, setProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);

  // Revolutionary AI Command Execution
  const executeCommand = useCallback(async (command: string, context: any = {}): Promise<CommandResult> => {
    if (!user) {
      throw new Error('Please sign in to use AI commands');
    }

    setProcessing(true);
    
    try {
      const response = await axios.post('/api/ai/commands', {
        command,
        context: {
          ...context,
          userId: user.id,
          behaviorSummary: behaviorSummary || {},
          sessionContext: {
            currentView: context.currentView || 'unified_feed',
            sessionDuration: currentSession?.duration || 0,
            deviceType: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay()
          }
        }
      });

      const result: CommandResult = {
        success: response.data.success,
        action: response.data.action,
        parameters: response.data.parameters,
        explanation: response.data.explanation,
        suggestions: response.data.suggestions || [],
        confidence: response.data.confidence,
        executionPlan: response.data.executionPlan,
        type: response.data.type || 'command',
        message: response.data.message || response.data.explanation
      };

      setLastResult(result);

      // Execute the command action based on AI decision
      await executeCommandAction(result);

      return result;
    } catch (error) {
      console.error('AI Command execution error:', error);
      
      const errorResult: CommandResult = {
        success: false,
        action: 'error',
        parameters: {},
        explanation: 'I encountered an error processing your command. Please try rephrasing it.',
        suggestions: [
          'Try "show me trending posts"',
          'Ask "filter by AI content"',
          'Say "switch to focus mode"',
          'Request "suggest what to post"'
        ],
        confidence: 0,
        type: 'error',
        message: 'Command processing failed'
      };

      setLastResult(errorResult);
      return errorResult;
    } finally {
      setProcessing(false);
    }
  }, [user, behaviorSummary, currentSession]);

  // Execute the determined action
  const executeCommandAction = async (result: CommandResult) => {
    switch (result.action) {
      case 'filter_content':
        await handleContentFiltering(result.parameters);
        break;
      case 'search_posts':
        await handleSearchPosts(result.parameters);
        break;
      case 'ui_control':
        await handleUIControl(result.parameters);
        break;
      case 'session_mode':
        await handleSessionMode(result.parameters);
        break;
      case 'create_content':
        await handleContentCreation(result.parameters);
        break;
      case 'analytics':
        await handleAnalytics(result.parameters);
        break;
      default:
        console.log('Command action executed:', result.action, result.parameters);
    }
  };

  // Content filtering handler
  const handleContentFiltering = async (parameters: any) => {
    try {
      await axios.post('/api/feed/filters', {
        filters: parameters.filters,
        duration: parameters.duration || '1hour'
      });
    } catch (error) {
      console.error('Filter application failed:', error);
    }
  };

  // Search posts handler
  const handleSearchPosts = async (parameters: any) => {
    try {
      await axios.post('/api/posts/search', {
        query: parameters.query,
        filters: parameters.filters,
        sortBy: parameters.sortBy || 'relevance'
      });
    } catch (error) {
      console.error('Search execution failed:', error);
    }
  };

  // UI control handler
  const handleUIControl = async (parameters: any) => {
    try {
      // Dispatch UI changes directly to store
      const { setLayout, setFeatureFlags } = await import('../store/slices/uiSlice');
      // Implementation would depend on your Redux store structure
      console.log('UI control executed:', parameters);
    } catch (error) {
      console.error('UI control failed:', error);
    }
  };

  // Session mode handler
  const handleSessionMode = async (parameters: any) => {
    try {
      await axios.post('/api/user/session-mode', {
        mode: parameters.mode,
        duration: parameters.duration
      });
    } catch (error) {
      console.error('Session mode change failed:', error);
    }
  };

  // Content creation handler
  const handleContentCreation = async (parameters: any) => {
    try {
      await axios.post('/api/content/suggestions', {
        type: parameters.type,
        input: parameters.input,
        platform: parameters.platform,
        tone: parameters.tone
      });
    } catch (error) {
      console.error('Content creation failed:', error);
    }
  };

  // Analytics handler
  const handleAnalytics = async (parameters: any) => {
    try {
      await axios.get('/api/analytics/insights', {
        params: parameters
      });
    } catch (error) {
      console.error('Analytics request failed:', error);
    }
  };

  // Revolutionary AI Suggestions
  const getSuggestions = useCallback(async (input: string): Promise<CommandSuggestion[]> => {
    if (input.length < 2) return [];

    setIsLoading(true);

    try {
      const response = await axios.post('/api/ai/suggestions', {
        input,
        context: {
          userId: user?.id,
          behaviorSummary: behaviorSummary || {},
          currentMood: inferMoodFromBehavior(),
          sessionContext: {
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            sessionDuration: currentSession?.duration || 0
          }
        }
      });

      return response.data.suggestions || [];
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
      return getIntelligentFallbackSuggestions(input);
    } finally {
      setIsLoading(false);
    }
  }, [user, behaviorSummary, currentSession]);

  // Intelligent fallback suggestions based on input patterns
  const getIntelligentFallbackSuggestions = (input: string): CommandSuggestion[] => {
    const lowerInput = input.toLowerCase();
    const suggestions: CommandSuggestion[] = [];

    // Search patterns
    if (lowerInput.includes('show') || lowerInput.includes('find') || lowerInput.includes('search')) {
      suggestions.push({
        id: 'search-' + Date.now(),
        text: `Search for "${input.replace(/show|find|search/i, '').trim()}"`,
        description: 'Find posts matching your query',
        category: 'search',
        icon: '🔍',
        confidence: 0.8,
        executionTime: '2s'
      });
    }

    // Filter patterns
    if (lowerInput.includes('filter') || lowerInput.includes('only') || lowerInput.includes('hide')) {
      suggestions.push({
        id: 'filter-' + Date.now(),
        text: `Apply smart filter: ${input}`,
        description: 'Filter your feed based on this criteria',
        category: 'filter',
        icon: '🎛️',
        confidence: 0.7
      });
    }

    // Mode patterns
    if (lowerInput.includes('mode') || lowerInput.includes('focus') || lowerInput.includes('deep')) {
      suggestions.push({
        id: 'mode-' + Date.now(),
        text: `Switch to ${lowerInput.includes('focus') ? 'focus' : 'discovery'} mode`,
        description: 'Change your browsing experience',
        category: 'session',
        icon: '🎯',
        confidence: 0.9
      });
    }

    // AI patterns
    if (lowerInput.includes('suggest') || lowerInput.includes('recommend') || lowerInput.includes('ai')) {
      suggestions.push({
        id: 'ai-' + Date.now(),
        text: `Get AI suggestions for: ${input}`,
        description: 'Let AI help you with personalized recommendations',
        category: 'ai',
        icon: '✨',
        confidence: 0.8
      });
    }

    // Create patterns
    if (lowerInput.includes('create') || lowerInput.includes('post') || lowerInput.includes('draft')) {
      suggestions.push({
        id: 'create-' + Date.now(),
        text: `Create content: ${input}`,
        description: 'Generate AI-powered content suggestions',
        category: 'action',
        icon: '📝',
        confidence: 0.7
      });
    }

    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  };

  // Infer user mood from behavior patterns
  const inferMoodFromBehavior = (): string => {
    if (!behaviorSummary) return 'neutral';

    const engagement = behaviorSummary.engagementPatterns?.engagementRate || 0;
    const scrollSpeed = behaviorSummary.scrollBehavior?.scrollSpeed || 'medium';
    const skipRate = behaviorSummary.engagementPatterns?.skipRate || 0;

    if (engagement > 0.3 && scrollSpeed === 'slow') return 'engaged';
    if (skipRate > 0.7 && scrollSpeed === 'fast') return 'restless';
    if (engagement < 0.1 && scrollSpeed === 'slow') return 'browsing';
    if (new Date().getHours() < 9) return 'morning_energy';
    if (new Date().getHours() > 20) return 'evening_relaxed';
    
    return 'neutral';
  };

  // Get contextual command suggestions based on current state
  const getContextualSuggestions = useCallback((): CommandSuggestion[] => {
    const hour = new Date().getHours();
    const mood = inferMoodFromBehavior();
    const suggestions: CommandSuggestion[] = [];

    // Time-based suggestions
    if (hour >= 6 && hour <= 9) {
      suggestions.push({
        id: 'morning-news',
        text: 'Show me morning news and trending topics',
        description: 'Get caught up with overnight developments',
        category: 'search',
        icon: '📰',
        confidence: 0.9
      });
    }

    if (hour >= 12 && hour <= 14) {
      suggestions.push({
        id: 'lunch-break',
        text: 'Quick hits mode for lunch break',
        description: 'Short, entertaining content for your break',
        category: 'session',
        icon: '⚡',
        confidence: 0.8
      });
    }

    if (hour >= 18 && hour <= 22) {
      suggestions.push({
        id: 'evening-deep',
        text: 'Switch to deep dive mode',
        description: 'Longer, more engaging content for the evening',
        category: 'session',
        icon: '🌅',
        confidence: 0.8
      });
    }

    // Mood-based suggestions
    if (mood === 'restless') {
      suggestions.push({
        id: 'variety-boost',
        text: 'Increase content variety',
        description: 'Mix up your feed with diverse topics',
        category: 'filter',
        icon: '🎨',
        confidence: 0.7
      });
    }

    if (mood === 'engaged') {
      suggestions.push({
        id: 'related-content',
        text: 'Show me more like this',
        description: 'Find similar content to what you\'re enjoying',
        category: 'search',
        icon: '🎯',
        confidence: 0.9
      });
    }

    return suggestions;
  }, [behaviorSummary, currentSession]);

  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  // Legacy compatibility
  const processCommand = executeCommand;

  return {
    executeCommand,
    processCommand, // Legacy compatibility
    getSuggestions,
    getContextualSuggestions,
    processing,
    isLoading,
    lastResult,
    clearResult,
  };
};