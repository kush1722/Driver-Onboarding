import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabaseClient';

// Pages
import SignIn from './pages/SignIn';
import OtpVerify from './pages/OtpVerify';
import OnboardingLayout from './pages/onboarding/OnboardingLayout';
import StatusComplete from './pages/StatusComplete';
import StatusPending from './pages/StatusPending';
import DriverDashboard from './pages/DriverDashboard';
import DriverRejected from './pages/DriverRejected';
import AdminLogin from './pages/admin/AdminLogin';
import ApplicationsQueue from './pages/admin/ApplicationsQueue';
import ApplicationDetail from './pages/admin/ApplicationDetail';

// Placeholder components for routing
// Status components are now imported
// Admin components are now imported

// Route Guard component
const ProtectedRoute = ({ children, requireAdmin }) => {
  const { session, loading, isAdmin } = useAuth();
  
  if (loading) return <div className="auth-container">Loading...</div>;
  if (!session) return <Navigate to="/signin" />;
  if (requireAdmin && !isAdmin) return <Navigate to="/" />;
  
  return children;
};

// Driver Router component to handle routing based on application status
const DriverRouter = () => {
  const { user, isAdmin } = useAuth();
  const [appStatus, setAppStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!user) return;
      try {
        const { data: driver } = await supabase
          .from('drivers')
          .select('id')
          .eq('auth_id', user.id)
          .single();

        if (driver) {
          const { data: app } = await supabase
            .from('applications')
            .select('status')
            .eq('driver_id', driver.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
          setAppStatus(app?.status || 'none');
        } else {
          setAppStatus('none');
        }
      } catch (err) {
        console.error(err);
        setAppStatus('none');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [user]);

  if (loading) return <div className="auth-container">Loading...</div>;

  // If they are an admin, always redirect to admin dashboard
  if (isAdmin) return <Navigate to="/admin" />;

  // Route based on application status
  switch (appStatus) {
    case 'submitted':
    case 'under_review':
      return <Navigate to="/status/pending" />;
    case 'approved':
      return <Navigate to="/dashboard" />;
    case 'rejected':
      return <Navigate to="/rejected" />;
    case 'draft':
    case 'none':
    default:
      return <Navigate to="/onboarding" />;
  }
};


function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/verify-otp" element={<OtpVerify />} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={
          <ProtectedRoute requireAdmin={true}>
            <ApplicationsQueue />
          </ProtectedRoute>
        } />
        <Route path="/admin/applications/:id" element={
          <ProtectedRoute requireAdmin={true}>
            <ApplicationDetail />
          </ProtectedRoute>
        } />

        {/* Driver Routes */}
        <Route path="/onboarding/*" element={
          <ProtectedRoute>
            <OnboardingLayout />
          </ProtectedRoute>
        } />
        
        <Route path="/status/complete" element={
          <ProtectedRoute>
            <StatusComplete />
          </ProtectedRoute>
        } />
        
        <Route path="/status/pending" element={
          <ProtectedRoute>
            <StatusPending />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DriverDashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/rejected" element={
          <ProtectedRoute>
            <DriverRejected />
          </ProtectedRoute>
        } />

        {/* Root Redirector */}
        <Route path="/" element={
          <ProtectedRoute>
            <DriverRouter />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
