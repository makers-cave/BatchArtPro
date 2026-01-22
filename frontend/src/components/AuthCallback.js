import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { processSessionId } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment (hash)
        const hash = location.hash;
        const params = new URLSearchParams(hash.replace('#', ''));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          toast.error('No session ID found');
          navigate('/login');
          return;
        }

        // Process session_id with backend
        const user = await processSessionId(sessionId);
        
        // Navigate to dashboard with user data (skip re-auth check)
        navigate('/dashboard', { state: { user }, replace: true });
        toast.success(`Welcome, ${user.name}!`);
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error('Authentication failed');
        navigate('/login');
      }
    };

    processAuth();
  }, [location.hash, navigate, processSessionId]);

  // Show nothing while processing (silent)
  return null;
};
