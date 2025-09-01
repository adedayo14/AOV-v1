import { useEffect, useState } from "react";

interface SessionStatusProps {
  onSessionExpired?: () => void;
}

export function SessionStatus({ onSessionExpired }: SessionStatusProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const checkAndRefreshSession = async () => {
      if (isRefreshing) return; // Prevent multiple simultaneous checks
      
      try {
        const response = await fetch('/app/api/session-check');
        
        if (response.status === 401) {
          // Session expired - auto refresh the page silently
          console.log('Session expired, refreshing page...');
          window.location.reload();
        }
      } catch (error) {
        console.warn('Session check failed, likely network issue');
        // Don't refresh on network errors, just retry later
      }
    };

    const refreshSession = async () => {
      if (isRefreshing) return;
      
      setIsRefreshing(true);
      try {
        await fetch('/app/api/session-refresh', { method: 'POST' });
        console.log('Session refreshed automatically');
      } catch (error) {
        console.warn('Session refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    // Check session when user returns to tab (most important)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAndRefreshSession();
      }
    };

    // Auto-refresh session every 30 minutes to keep it alive
    const refreshInterval = setInterval(refreshSession, 30 * 60 * 1000);
    
    // Check for expired sessions every 2 minutes
    const checkInterval = setInterval(checkAndRefreshSession, 2 * 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial check
    checkAndRefreshSession();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(refreshInterval);
      clearInterval(checkInterval);
    };
  }, [isRefreshing, onSessionExpired]);

  // This component is invisible - it just works in the background
  return null;
}
