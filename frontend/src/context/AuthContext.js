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
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [loading, setLoading] = useState(true);
  const [wcSession, setWcSession] = useState(null);

  // Check if opened from WooCommerce
  const isCustomerMode = !!wcSession;
  const isAdminMode = !!user && !wcSession;

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            localStorage.removeItem('admin_token');
            setToken(null);
          }
        } catch (error) {
          console.error('Auth check failed:', error);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [token]);

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

  const login = async (username, password) => {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    localStorage.setItem('admin_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (username, email, password) => {
    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    const data = await response.json();
    localStorage.setItem('admin_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    setToken(null);
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
    token,
    loading,
    wcSession,
    isCustomerMode,
    isAdminMode,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    clearWcSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
