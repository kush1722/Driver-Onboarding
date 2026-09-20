import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import ProgressBar from '../../components/ProgressBar';

import StepPersonalDetails from './StepPersonalDetails';
import StepIdentityVerification from './StepIdentityVerification';
import StepVehicleDetails from './StepVehicleDetails';
import StepDocuments from './StepDocuments';
import StepReviewSubmit from './StepReviewSubmit';

const STEPS = [
  { path: 'personal', label: 'Personal' },
  { path: 'identity', label: 'Identity' },
  { path: 'vehicle', label: 'Vehicle' },
  { path: 'documents', label: 'Documents' },
  { path: 'review', label: 'Review' },
];

export default function OnboardingLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [applicationId, setApplicationId] = useState(null);
  
  const currentPath = location.pathname.split('/').pop();
  const currentStepIndex = STEPS.findIndex(s => s.path === currentPath) + 1;
  const currentStep = currentStepIndex > 0 ? currentStepIndex : 1;

  useEffect(() => {
    if (!user) return;

    const loadOrCreateApplication = async () => {
      try {
        // 1. Get driver ID
        let { data: driver, error: driverErr } = await supabase
          .from('drivers')
          .select('id')
          .eq('auth_id', user.id)
          .limit(1)
          .single();

        if (driverErr && driverErr.code === 'PGRST116') {
          // Driver doesn't exist, create it (e.g. if they logged in via magic link)
          const { data: newDriver, error: insertErr } = await supabase
            .from('drivers')
            .insert([{ auth_id: user.id, email: user.email }])
            .select('id')
            .single();
            
          if (insertErr) throw insertErr;
          driver = newDriver;
        } else if (driverErr) {
          throw driverErr;
        }

        if (!driver) throw new Error("Driver profile not found and could not be created.");

        // 2. Look for existing application
        let { data: app, error: appErr } = await supabase
          .from('applications')
          .select('id, status')
          .eq('driver_id', driver.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // 3. Create one if none exists
        if (appErr && appErr.code === 'PGRST116') {
          const { data: newApp, error: createErr } = await supabase
            .from('applications')
            .insert([{ driver_id: driver.id, status: 'draft' }])
            .select()
            .single();
            
          if (createErr) throw createErr;
          app = newApp;
        }

        if (app) {
          if (app.status !== 'draft') {
            navigate('/', { replace: true });
            return;
          }
          setApplicationId(app.id);
          // Only redirect if they hit the base /onboarding path
          if (location.pathname === '/onboarding' || location.pathname === '/onboarding/') {
            navigate('/onboarding/personal', { replace: true });
          }
        }
      } catch (err) {
        console.error("Error loading application:", err);
      } finally {
        setLoading(false);
      }
    };

    loadOrCreateApplication();
  }, [user, navigate, location.pathname]);

  if (loading) {
    return <div className="auth-container" style={{ padding: '2rem', textAlign: 'center' }}>Loading application... (AppID: {applicationId || 'null'})</div>;
  }
  if (!applicationId) {
    return <div className="auth-container" style={{color:'red'}}>Error: Could not load your application ID. Please contact support.</div>;
  }

  return (
    <div className="container">
      <div style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: 0 }}>Driver Application</h1>
          <button 
            onClick={async () => {
              await signOut();
              navigate('/signin');
            }} 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            Sign Out
          </button>
        </div>
        
        <ProgressBar currentStep={currentStep} steps={STEPS} />
        
        <div className="glass-panel" style={{ padding: '2rem', minHeight: '400px' }}>
          {/* We pass the applicationId to steps via React context or just let them fetch it, 
              but passing it as a prop using cloneElement or similar might be complex with Routes.
              We'll use a Context for onboarding state if needed, but for now we can just let 
              steps query it, or pass it via props if we render them directly instead of Routes.
              Actually, React Router Outlet with Context is best. Let's use React Context. */}
          <Routes>
            <Route path="personal" element={<StepPersonalDetails applicationId={applicationId} />} />
            <Route path="identity" element={<StepIdentityVerification applicationId={applicationId} />} />
            <Route path="vehicle" element={<StepVehicleDetails applicationId={applicationId} />} />
            <Route path="documents" element={<StepDocuments applicationId={applicationId} />} />
            <Route path="review" element={<StepReviewSubmit applicationId={applicationId} />} />
            <Route path="*" element={<Navigate to="personal" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
