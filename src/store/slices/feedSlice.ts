import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export interface Post {
  id: string;
  platform: string;
  author: {
    name: string;
    username: string;
    avatar: string;
    verified: boolean;
  };
  content: {
    text: string;
    media?: Array<{
      type: 'image' | 'video';
      url: string;
      thumbnail?: string;
    }>;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  metadata: {
    createdAt: string;
    url: string;
    tags: string[];
    sentiment: number;
    aiScore: number;
    whyShown?: string;
  };
}

interface FeedState {
  posts: Post[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  currentMode: string;
  refreshing: boolean;
  lastUpdated: string | null;
}

const initialState: FeedState = {
  posts: [],
  loading: false,
  error: null,
  hasMore: true,
  currentMode: 'default',
  refreshing: false,
  lastUpdated: null,
};

export const fetchFeed = createAsyncThunk(
  'feed/fetchFeed',
  async (params: { mode?: string; limit?: number; offset?: number } = {}) => {
    const response = await api.get('/feed', { params });
    return response.data;
  }
);

export const loadMorePosts = createAsyncThunk(
  'feed/loadMore',
  async (params: { offset: number; mode: string }) => {
    const response = await api.get('/feed', { params });
    return response.data;
  }
);

export const refreshFeed = createAsyncThunk(
  'feed/refresh',
  async (mode: string) => {
    const response = await api.get('/feed', { 
      params: { mode, limit: 25, offset: 0 } 
    });
    return response.data;
  }
);

const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    setFeedMode: (state, action: PayloadAction<string>) => {
      state.currentMode = action.payload;
      state.posts = [];
      state.hasMore = true;
    },
    clearFeed: (state) => {
      state.posts = [];
      state.hasMore = true;
    },
    updatePost: (state, action: PayloadAction<{ id: string; updates: Partial<Post> }>) => {
      const index = state.posts.findIndex(post => post.id === action.payload.id);
      if (index !== -1) {
        state.posts[index] = { ...state.posts[index], ...action.payload.updates };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFeed.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFeed.fulfilled, (state, action) => {
        state.loading = false;
        state.posts = action.payload.posts || [];
        state.hasMore = action.payload.hasMore !== false;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchFeed.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load feed';
      })
      .addCase(loadMorePosts.fulfilled, (state, action) => {
        state.posts = [...state.posts, ...(action.payload.posts || [])];
        state.hasMore = action.payload.hasMore !== false;
      })
      .addCase(refreshFeed.pending, (state) => {
        state.refreshing = true;
      })
      .addCase(refreshFeed.fulfilled, (state, action) => {
        state.refreshing = false;
        state.posts = action.payload.posts || [];
        state.hasMore = action.payload.hasMore !== false;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(refreshFeed.rejected, (state) => {
        state.refreshing = false;
      });
  },
});

export const { setFeedMode, clearFeed, updatePost } = feedSlice.actions;
export default feedSlice.reducer;