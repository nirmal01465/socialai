import { useCallback } from 'react';
import { useAppSelector } from '../store/hooks';

interface BehaviorEvent {
  type: string;
  metadata?: any;
}

export const useBehaviorTracking = () => {
  const { user } = useAppSelector(state => state.auth);

  const trackBehavior = useCallback((event: BehaviorEvent) => {
    if (!user) return;

    // In a real app, this would send to your analytics service
    console.log('Behavior tracked:', event);
    
    // Here you could send to your backend
    // api.post('/api/analytics/behavior', { userId: user.id, ...event });
  }, [user]);

  const trackPostView = useCallback((postId: string, metadata?: any) => {
    trackBehavior({
      type: 'post_view',
      metadata: { postId, ...metadata }
    });
  }, [trackBehavior]);

  const trackPostEngagement = useCallback((postId: string, type: string, metadata?: any) => {
    trackBehavior({
      type: 'post_engagement',
      metadata: { postId, engagementType: type, ...metadata }
    });
  }, [trackBehavior]);

  const trackUIInteraction = useCallback((element: string, action: string, metadata?: any) => {
    trackBehavior({
      type: 'ui_interaction',
      metadata: { element, action, ...metadata }
    });
  }, [trackBehavior]);

  return {
    trackBehavior,
    trackPostView,
    trackPostEngagement,
    trackUIInteraction,
  };
};