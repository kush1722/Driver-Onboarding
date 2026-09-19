import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function StatusPending() {
  const { user, signOut } = useAuth();
  const [appId, setAppId] = useState(null);

  useEffect(() => {
    const fetchAppId = async () => {
      if (!user) return;
      try {
        const { data: driver } = await supabase.from('drivers').select('id').eq('auth_id', user.id).single();
        if (driver) {
          const { data: app } = await supabase
            .from('applications')
            .select('id')
            .eq('driver_id', driver.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (app) setAppId(app.id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAppId();
  }, [user]);

  return (
    <div className="auth-container">
      <div className="glass-panel auth-card" style={{ padding: '3rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--warning-color)' }}>
          <Clock size={64} />
        </div>
        <h1 style={{ marginBottom: '1rem' }}>Under Review</h1>
        <p className="subtitle" style={{ marginBottom: '2rem' }}>
          Your application is currently being reviewed by our team. 
          Estimated turnaround time is 24-48 hours.
        </p>
        
        {appId && (
          <div style={{ padding: '1rem', background: 'var(--input-bg)', borderRadius: '8px', marginBottom: '2rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Application ID</span>
            <div style={{ fontFamily: 'monospace', marginTop: '0.25rem' }}>{appId.split('-')[0]}...</div>
          </div>
        )}

        <button onClick={signOut} className="btn btn-secondary btn-full">
          Sign out
        </button>
      </div>
    </div>
  );
}
