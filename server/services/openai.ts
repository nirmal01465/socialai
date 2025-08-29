import OpenAI from 'openai';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || 'fallback_key'
});

interface SentimentResult {
  rating: number;
  confidence: number;
  emotions?: string[];
}

interface SummaryOptions {
  content: string;
  type: 'brief' | 'detailed' | 'key_points';
  maxLength: number;
}

interface ContentAnalysis {
  sentiment: SentimentResult;
  topics: string[];
  engagementPotential: number;
  contentType: string;
  complexity: number;
}

export class OpenAIService {
  // Analyze sentiment of text content
  async analyzeSentiment(text: string): Promise<SentimentResult> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: "You are a sentiment analysis expert. Analyze the sentiment of the text and provide a rating from 1 to 5 stars and a confidence score between 0 and 1. Respond with JSON in this format: { 'rating': number, 'confidence': number }"
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        rating: Math.max(1, Math.min(5, Math.round(result.rating))),
        confidence: Math.max(0, Math.min(1, result.confidence))
      };
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      throw new Error('Failed to analyze sentiment');
    }
  }

  // Analyze emotions in text
  async analyzeEmotions(text: string): Promise<string[]> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: "Identify the primary emotions expressed in this text. Return as JSON array of emotion names: ['emotion1', 'emotion2']. Focus on: joy, sadness, anger, fear, surprise, disgust, trust, anticipation."
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{"emotions": []}');
      return result.emotions || [];
    } catch (error) {
      console.error('Emotion analysis error:', error);
      return [];
    }
  }

  // Generate content summary
  async generateSummary(options: SummaryOptions): Promise<string> {
    try {
      const { content, type, maxLength } = options;
      
      let prompt = '';
      switch (type) {
        case 'brief':
          prompt = `Summarize this content in ${maxLength} characters or less, focusing on the main point:`;
          break;
        case 'detailed':
          prompt = `Provide a detailed summary of this content in ${maxLength} characters or less, including key details:`;
          break;
        case 'key_points':
          prompt = `Extract the key points from this content in ${maxLength} characters or less, formatted as bullet points:`;
          break;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: "You are an expert content summarizer. Create concise, accurate summaries that capture the essence of the content."
          },
          {
            role: "user",
            content: `${prompt}\n\nContent: ${content}`
          }
        ],
        max_tokens: Math.ceil(maxLength / 3) // Rough estimate for token limit
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Summary generation error:', error);
      throw new Error('Failed to generate summary');
    }
  }

  // Comprehensive content analysis
  async analyzeContent(content: string): Promise<ContentAnalysis> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: `Analyze this content and return JSON with:
            - sentiment: {rating: 1-5, confidence: 0-1}
            - topics: array of main topics/themes
            - engagementPotential: score 1-10 for likely social media engagement
            - contentType: brief description (e.g., "educational", "entertainment", "news")
            - complexity: reading level 1-10 (1=very simple, 10=very complex)`
          },
          {
            role: "user",
            content: content
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        sentiment: {
          rating: Math.max(1, Math.min(5, result.sentiment?.rating || 3)),
          confidence: Math.max(0, Math.min(1, result.sentiment?.confidence || 0.5))
        },
        topics: result.topics || [],
        engagementPotential: Math.max(1, Math.min(10, result.engagementPotential || 5)),
        contentType: result.contentType || 'general',
        complexity: Math.max(1, Math.min(10, result.complexity || 5))
      };
    } catch (error) {
      console.error('Content analysis error:', error);
      throw new Error('Failed to analyze content');
    }
  }

  // Generate platform-specific content adaptations
  async adaptContentForPlatform(content: string, platform: string, tone: string = 'authentic'): Promise<string[]> {
    try {
      const platformGuidelines = {
        instagram: "Visual-focused, use relevant hashtags, engaging captions, story-driven",
        youtube: "Attention-grabbing titles, descriptive, SEO-friendly, include keywords",
        twitter: "Concise, trending hashtags, conversational, under 280 characters",
        facebook: "Community-focused, longer form OK, conversation starters"
      };

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: `Adapt content for ${platform}. Guidelines: ${platformGuidelines[platform as keyof typeof platformGuidelines]}. 
            Tone: ${tone}. Generate 3 variations. Return as JSON array: ["variation1", "variation2", "variation3"]`
          },
          {
            role: "user",
            content: content
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{"variations": []}');
      return result.variations || [content];
    } catch (error) {
      console.error('Content adaptation error:', error);
      return [content];
    }
  }

  // Generate hashtag suggestions
  async generateHashtags(content: string, platform: string, maxCount: number = 10): Promise<string[]> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: `Generate relevant hashtags for ${platform}. Return as JSON array of hashtag strings (without #). 
            Max ${maxCount} hashtags. Mix popular and niche tags for best reach.`
          },
          {
            role: "user",
            content: content
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{"hashtags": []}');
      return result.hashtags?.slice(0, maxCount) || [];
    } catch (error) {
      console.error('Hashtag generation error:', error);
      return [];
    }
  }

  // Analyze user behavior patterns
  async analyzeBehaviorPatterns(behaviorData: any): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: `Analyze user behavior patterns and provide insights. Return JSON with:
            - patterns: array of observed patterns
            - preferences: inferred content preferences
            - optimalTiming: suggested best times for engagement
            - moodIndicators: detected mood/intent patterns
            - recommendations: actionable suggestions`
          },
          {
            role: "user",
            content: JSON.stringify(behaviorData)
          }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Behavior analysis error:', error);
      throw new Error('Failed to analyze behavior patterns');
    }
  }

  // Generate UI layout recommendations
  async generateUIRecommendations(userContext: any): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: `Based on user behavior and preferences, recommend UI layout changes. Return JSON with:
            - layout: {sections: [{id, priority, visible}], feature_flags: {}}
            - feed_rules: {blocklist: [], boost_tags: []}
            - reasoning: explanation of recommendations
            - adaptations: specific UI element changes`
          },
          {
            role: "user",
            content: JSON.stringify(userContext)
          }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('UI recommendation error:', error);
      throw new Error('Failed to generate UI recommendations');
    }
  }

  // Process natural language commands
  async processCommand(command: string, context: any): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: `Process user commands for social media app. Parse intent and generate actions. Return JSON with:
            - intent: detected command intent
            - action: specific action to take
            - parameters: extracted parameters
            - confidence: confidence in interpretation
            - response: user-friendly response message`
          },
          {
            role: "user",
            content: `Command: "${command}"\nContext: ${JSON.stringify(context)}`
          }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Command processing error:', error);
      throw new Error('Failed to process command');
    }
  }
}

export const openaiService = new OpenAIService();
