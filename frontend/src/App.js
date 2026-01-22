import React, { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { EditorProvider } from "./context/EditorContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TemplateEditor } from "./components/editor/TemplateEditor";
import { LoginPage } from "./components/LoginPage";
import { AuthCallback } from "./components/AuthCallback";
import { AdminDashboard } from "./components/AdminDashboard";
import { Toaster } from "./components/ui/sonner";

// Protected route wrapper with server-side session verification
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isVerified, setIsVerified] = useState(location.state?.user ? true : null);

  useEffect(() => {
    // If user data passed from AuthCallback, skip verification
    if (location.state?.user) {
      setIsVerified(true);
      return;
    }

    // Verify with server
    if (!loading && !isAuthenticated) {
      setIsVerified(false);
      navigate('/login', { replace: true });
    } else if (!loading && isAuthenticated) {
      setIsVerified(true);
    }
  }, [loading, isAuthenticated, location.state, navigate]);

  // Show loading while checking
  if (isVerified === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not authenticated
  if (isVerified === false) {
    return null;
  }

  return children;
};

// Main router component
function AppRouter() {
  const location = useLocation();

  // CRITICAL: Check URL fragment for session_id synchronously during render
  // This prevents race conditions by processing session_id FIRST
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardWithEditor />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/editor" 
        element={
          <ProtectedRoute>
            <TemplateEditor />
          </ProtectedRoute>
        } 
      />
      {/* Default route - shows editor if WooCommerce session, otherwise redirects */}
      <Route 
        path="/" 
        element={<RootRedirect />} 
      />
    </Routes>
  );
}

// Dashboard with editor opening capability
const DashboardWithEditor = () => {
  const [showEditor, setShowEditor] = useState(false);
  const [editorData, setEditorData] = useState(null);
  const { user } = useAuth();

  const handleOpenEditor = (template, dataSource, format, designId) => {
    if (template) {
      setEditorData({ template, dataSource, format, designId });
    }
    setShowEditor(true);
  };

  if (showEditor) {
    return (
      <EditorProvider initialData={editorData}>
        <TemplateEditor onBack={() => setShowEditor(false)} />
      </EditorProvider>
    );
  }

  return <AdminDashboard onOpenEditor={handleOpenEditor} />;
};

// Root redirect logic
const RootRedirect = () => {
  const { isAuthenticated, loading, wcSession } = useAuth();
  
  // Check for WooCommerce session token in URL
  const params = new URLSearchParams(window.location.search);
  const hasWcSession = params.has('session');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // WooCommerce customer mode - go directly to editor
  if (hasWcSession || wcSession) {
    return (
      <EditorProvider>
        <TemplateEditor />
      </EditorProvider>
    );
  }

  // Authenticated admin - go to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Not authenticated - go to login
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <AuthProvider>
        <div className="App">
          <BrowserRouter>
            <EditorProvider>
              <AppRouter />
            </EditorProvider>
          </BrowserRouter>
          <Toaster position="bottom-right" />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
