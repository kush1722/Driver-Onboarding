import React, { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function DriverRejected() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [appId, setAppId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const { data: driver } = await supabase.from('drivers').select('id').eq('auth_id', user.id).single();
        if (driver) {
          const { data: app } = await supabase
            .from('applications')
            .select('id, rejection_reason')
            .eq('driver_id', driver.id)
            .eq('status', 'rejected')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
          if (app) {
            setAppId(app.id);
            setReason(app.rejection_reason || 'No specific reason provided.');
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [user]);

  const handleResubmit = async () => {
    if (!appId) return;
    try {
      // Revert to draft status
      await supabase
        .from('applications')
        .update({ status: 'draft' })
        .eq('id', appId);
      
      // Navigate to onboarding to fix issues
      navigate('/onboarding');
    } catch (err) {
      console.error(err);
      alert("Failed to reset application status.");
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-card" style={{ padding: '3rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--error-color)' }}>
          <XCircle size={64} />
        </div>
        <h1 style={{ marginBottom: '1rem' }}>Application Rejected</h1>
        <p className="subtitle" style={{ marginBottom: '2rem' }}>
          Unfortunately, your application was not approved at this time.
        </p>
        
        <div style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error-color)', borderRadius: '8px', marginBottom: '2rem', textAlign: 'left' }}>
          <h3 style={{ color: 'var(--error-color)', fontSize: '1rem', marginBottom: '0.5rem' }}>Reason for rejection:</h3>
          <p style={{ color: 'var(--text-primary)' }}>{reason}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button onClick={handleResubmit} className="btn btn-primary btn-full">
            Edit & Resubmit
          </button>
          <button onClick={signOut} className="btn btn-secondary btn-full">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
