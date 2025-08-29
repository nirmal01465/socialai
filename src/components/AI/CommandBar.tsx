import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleCommandBar } from '../../store/slices/uiSlice';
import { useAICommands } from '../../hooks/useAICommands';

const CommandIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
  </svg>
);

const BulbIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

interface CommandSuggestion {
  id: string;
  text: string;
  description: string;
  category: 'search' | 'filter' | 'action' | 'ai';
  icon: React.ReactNode;
}

const CommandBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const { commandBarOpen } = useAppSelector(state => state.ui);
  const { user } = useAppSelector(state => state.auth);
  
  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { executeCommand, getSuggestions, isLoading } = useAICommands();

  const defaultSuggestions: CommandSuggestion[] = [
    {
      id: 'trending-ai',
      text: 'Show trending AI posts',
      description: 'Find popular AI and technology content',
      category: 'search',
      icon: <SearchIcon />
    },
    {
      id: 'filter-short',
      text: 'Show only short videos',
      description: 'Filter feed to show videos under 60 seconds',
      category: 'filter',
      icon: <CommandIcon />
    },
    {
      id: 'summarize-feed',
      text: 'Summarize my feed',
      description: 'Get AI-generated summary of recent posts',
      category: 'ai',
      icon: <SparklesIcon />
    },
    {
      id: 'suggest-post',
      text: 'Suggest what to post',
      description: 'Get AI recommendations for your next post',
      category: 'ai',
      icon: <BulbIcon />
    },
    {
      id: 'cross-post',
      text: 'Cross-post to all platforms',
      description: 'Share content across all connected accounts',
      category: 'action',
      icon: <CommandIcon />
    }
  ];

  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>(defaultSuggestions);

  // Focus input when command bar opens
  useEffect(() => {
    if (commandBarOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [commandBarOpen]);

  // Handle input changes and get AI suggestions
  useEffect(() => {
    const getSuggestionsForInput = async () => {
      if (input.length > 2) {
        try {
          const aiSuggestions = await getSuggestions(input);
          setSuggestions([...defaultSuggestions, ...aiSuggestions]);
        } catch (error) {
          console.error('Failed to get AI suggestions:', error);
          setSuggestions(defaultSuggestions);
        }
      } else {
        setSuggestions(defaultSuggestions);
      }
    };

    const timeoutId = setTimeout(getSuggestionsForInput, 300);
    return () => clearTimeout(timeoutId);
  }, [input, getSuggestions]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!commandBarOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            handleExecuteCommand(suggestions[selectedIndex].text);
          } else if (input.trim()) {
            handleExecuteCommand(input);
          }
          break;
        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandBarOpen, suggestions, selectedIndex, input]);

  const handleClose = () => {
    dispatch(toggleCommandBar());
    setInput('');
    setSelectedIndex(0);
    setResults([]);
  };

  const handleExecuteCommand = async (command: string) => {
    setIsExecuting(true);
    try {
      const result = await executeCommand(command, {
        currentUser: user,
        timestamp: new Date().toISOString()
      });
      
      setResults([result]);
      
      // Auto-close for certain command types
      if (result.type === 'navigation' || result.type === 'filter') {
        setTimeout(handleClose, 1000);
      }
    } catch (error) {
      console.error('Command execution failed:', error);
      setResults([{
        type: 'error',
        message: 'Failed to execute command. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSuggestionClick = (suggestion: CommandSuggestion) => {
    setInput(suggestion.text);
    handleExecuteCommand(suggestion.text);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'search':
        return 'text-blue-600 dark:text-blue-400';
      case 'filter':
        return 'text-green-600 dark:text-green-400';
      case 'action':
        return 'text-purple-600 dark:text-purple-400';
      case 'ai':
        return 'text-indigo-600 dark:text-indigo-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.text.toLowerCase().includes(input.toLowerCase()) ||
    suggestion.description.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <AnimatePresence>
      {commandBarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-32"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <CommandIcon />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">AI Command Bar</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Type a command or ask AI to help you
                  </p>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="p-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a command like 'show me trending AI posts' or 'filter by photography'..."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                
                {isLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="px-4 pb-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  {results.map((result, index) => (
                    <div key={index} className="space-y-2">
                      {result.type === 'error' ? (
                        <div className="flex items-start space-x-2 text-red-600 dark:text-red-400">
                          <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.19 2.5 1.732 2.5z" />
                          </svg>
                          <div>
                            <p className="font-medium">{result.message}</p>
                            <p className="text-sm opacity-75">{result.error}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-900 dark:text-white">
                          <p className="font-medium">{result.message || 'Command executed successfully'}</p>
                          {result.data && (
                            <pre className="text-sm mt-2 p-2 bg-gray-100 dark:bg-gray-600 rounded overflow-auto">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {results.length === 0 && (
              <div className="max-h-96 overflow-y-auto">
                {filteredSuggestions.length > 0 ? (
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 py-2">
                      Suggestions
                    </p>
                    {filteredSuggestions.map((suggestion, index) => (
                      <motion.button
                        key={suggestion.id}
                        whileHover={{ backgroundColor: 'rgba(99, 102, 241, 0.1)' }}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          index === selectedIndex
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-l-2 border-indigo-600'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`p-1.5 rounded ${getCategoryColor(suggestion.category)}`}>
                            {suggestion.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {suggestion.text}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {suggestion.description}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(suggestion.category)} bg-opacity-20`}>
                            {suggestion.category}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : input.length > 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <SparklesIcon />
                    <p className="mt-2">No suggestions found for "{input}"</p>
                    <p className="text-sm mt-1">Try pressing Enter to execute as a custom command</p>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <CommandIcon />
                    <p className="mt-2">Start typing to see AI-powered suggestions</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-4">
                  <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">↑↓</kbd> Navigate</span>
                  <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">Enter</kbd> Execute</span>
                  <span><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">Esc</kbd> Close</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>Powered by</span>
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">AI</span>
                </div>
              </div>
            </div>

            {/* Execution Loading */}
            {isExecuting && (
              <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-90 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Executing command...</p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandBar;
