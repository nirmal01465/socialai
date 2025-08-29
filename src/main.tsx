import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize app
const initializeApp = async () => {
  // Performance monitoring
  if ('performance' in window) {
    window.performance.mark('app-start');
  }

  // Service Worker registration for PWA functionality
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  // Initialize error reporting
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Here you could send to error tracking service
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Here you could send to error tracking service
  });

  // Initialize performance observer
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'navigation') {
          console.log('Navigation timing:', entry);
        }
      });
    });
    
    observer.observe({ type: 'navigation', buffered: true });
  }

  // Render the app
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Mark app as loaded
  if ('performance' in window) {
    window.performance.mark('app-loaded');
    window.performance.measure('app-boot-time', 'app-start', 'app-loaded');
  }
};

// Initialize the application
initializeApp().catch((error) => {
  console.error('Failed to initialize app:', error);
  
  // Render a basic error fallback
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  
  root.render(
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-red-600 mb-2">
          App Failed to Load
        </h1>
        <p className="text-gray-600 mb-4">
          Something went wrong while initializing the application.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
});
