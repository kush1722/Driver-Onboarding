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
    <div className="auth-container" style={{ position: 'relative' }}>
      <button 
        onClick={async () => {
          await signOut();
          // window.location.href='/signin' if needed, but signOut triggers auth state change anyway
        }} 
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
          padding: '0.5rem 0.75rem', borderRadius: '8px', zIndex: 10, backdropFilter: 'blur(10px)'
        }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Sign Out</span>
      </button>

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
