import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  actionable: boolean;
  actions?: Array<{
    label: string;
    action: string;
    type: 'primary' | 'secondary';
  }>;
  metadata?: any;
  timestamp: string;
  read: boolean;
}

interface UIState {
  theme: 'light' | 'dark' | 'auto';
  sidebarOpen: boolean;
  commandBarOpen: boolean;
  notifications: Notification[];
  adaptiveLayout: boolean;
  isConnected: boolean;
  loading: boolean;
}

const initialState: UIState = {
  theme: 'auto',
  sidebarOpen: true,
  commandBarOpen: false,
  notifications: [],
  adaptiveLayout: true,
  isConnected: false,
  loading: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    toggleCommandBar: (state) => {
      state.commandBarOpen = !state.commandBarOpen;
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        read: false,
      };
      state.notifications.unshift(notification);
    },
    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    dismissNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearAllNotifications: (state) => {
      state.notifications = [];
    },
    updateConnectedStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    initializeUI: (state) => {
      // Initialize UI settings from localStorage or defaults
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'auto';
      if (savedTheme) {
        state.theme = savedTheme;
      }
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  toggleCommandBar,
  addNotification,
  markNotificationAsRead,
  dismissNotification,
  clearAllNotifications,
  updateConnectedStatus,
  setLoading,
  initializeUI,
} = uiSlice.actions;

export default uiSlice.reducer;