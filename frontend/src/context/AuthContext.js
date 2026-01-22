import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wcSession, setWcSession] = useState(null);

  // Check if opened from WooCommerce
  const isCustomerMode = !!wcSession;
  const isAdminMode = !!user && !wcSession;
  const isAuthenticated = !!user;

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include'
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Check for WooCommerce session token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionToken = params.get('session');
    
    if (sessionToken) {
      loadWcSession(sessionToken);
    }
  }, []);

  const loadWcSession = async (sessionToken) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/woocommerce/session/${sessionToken}`);
      if (response.ok) {
        const session = await response.json();
        setWcSession({ ...session, token: sessionToken });
      } else {
        console.error('Invalid or expired session');
      }
    } catch (error) {
      console.error('Failed to load WC session:', error);
    }
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const initiateGoogleLogin = useCallback(() => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  }, []);

  const processSessionId = async (sessionId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to process session');
      }

      const data = await response.json();
      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error('Session processing failed:', error);
      throw error;
    }
  };

  const logout = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
  }, []);

  const clearWcSession = useCallback(() => {
    setWcSession(null);
    // Remove session param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url);
  }, []);

  const value = {
    user,
    loading,
    wcSession,
    isCustomerMode,
    isAdminMode,
    isAuthenticated,
    initiateGoogleLogin,
    processSessionId,
    logout,
    clearWcSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
