# AI Social Media Aggregator

## Overview

This is a sophisticated AI-powered social media aggregation platform that unifies multiple social platforms (Instagram, YouTube, Twitter, Facebook) into a single intelligent interface. The application uses OpenAI's GPT-5 model as the core decision engine to provide personalized content ranking, adaptive UI layouts, and smart recommendations based on user behavior analysis.

The platform aggregates content from connected social media accounts via OAuth and normalizes it into a unified format. An AI decision engine continuously analyzes user behavior patterns to dynamically adjust the interface, content ranking, and suggestions, creating a highly personalized social media experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 19.1 with TypeScript for type safety
- **State Management**: Redux Toolkit for predictable state management
- **Styling**: Tailwind CSS 4.1 for utility-first responsive design
- **Animations**: Framer Motion for smooth, performant animations
- **Build Tool**: Vite 7.1 for fast development and optimized production builds
- **Routing**: React Router DOM for client-side navigation

### Backend Architecture
- **Runtime**: Node.js with Express 5.1 framework
- **Language**: TypeScript for full-stack type safety
- **Authentication**: JWT-based authentication with bcryptjs password hashing
- **WebSocket**: Real-time communication using native WebSocket implementation
- **Middleware**: Comprehensive security layers including Helmet, CORS, rate limiting, and input validation

### Data Storage Solutions
- **Primary Database**: MongoDB with Mongoose ODM for flexible document storage
- **Caching Layer**: Redis (IORedis) for session management, API response caching, and real-time data
- **Data Models**: User profiles, posts, behavior events, and AI analysis results

### Authentication and Authorization
- **OAuth Integration**: Multi-platform social media authentication (Instagram, YouTube, Twitter, Facebook)
- **JWT Tokens**: Secure token-based authentication with refresh token support
- **Rate Limiting**: Express-rate-limit for API protection
- **Security Headers**: Comprehensive security middleware with CSP, CORS, and XSS protection

### AI Decision Engine
- **Model**: OpenAI GPT-5 for content analysis, sentiment analysis, and decision making
- **Behavior Analytics**: Real-time user behavior tracking and pattern analysis
- **Content Normalization**: Unified content format across all social platforms
- **Adaptive UI**: Dynamic interface adjustments based on user preferences and behavior

### Data Processing Pipeline
- **Content Ingestion**: Real-time social media API integration with normalized data structure
- **Behavior Tracking**: Client-side event tracking with privacy-focused analytics
- **AI Analysis**: Continuous content sentiment analysis, topic extraction, and engagement prediction
- **Caching Strategy**: Multi-level caching with Redis for performance optimization

## External Dependencies

### AI and Machine Learning
- **OpenAI API**: GPT-5 model for content analysis, decision making, and natural language processing
- **Content Analysis**: Sentiment analysis, topic extraction, and engagement prediction

### Social Media Platforms
- **Instagram Graph API**: Content fetching, user authentication, and basic analytics
- **YouTube Data API**: Video content, channel information, and engagement metrics
- **Twitter API v2**: Tweet fetching, user timelines, and trending topics
- **Facebook Graph API**: Posts, pages, and user content aggregation

### Infrastructure Services
- **MongoDB Atlas**: Cloud database hosting with automatic scaling
- **Redis Cloud**: Managed Redis instances for caching and session storage
- **WebSocket Infrastructure**: Real-time bidirectional communication for live updates

### Development and Monitoring
- **Winston**: Structured logging with multiple transport options
- **Express Validator**: Input validation and sanitization
- **Date-fns**: Date manipulation and formatting utilities
- **Concurrently**: Development workflow automation for running multiple processes

### Security and Performance
- **Helmet**: Security headers and middleware configuration
- **CORS**: Cross-origin resource sharing management
- **Express Rate Limit**: API rate limiting and abuse prevention
- **Bcryptjs**: Password hashing and security utilities