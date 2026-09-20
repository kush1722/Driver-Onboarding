import React from 'react';
import { CheckCircle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function StatusComplete() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="auth-container" style={{ position: 'relative' }}>
      <button 
        onClick={async () => {
          await signOut();
          navigate('/signin');
        }} 
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
          padding: '0.5rem 0.75rem', borderRadius: '8px', zIndex: 10, backdropFilter: 'blur(10px)'
        }}
      >
        <LogOut size={18} />
        <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Sign Out</span>
      </button>
      <div className="glass-panel auth-card" style={{ padding: '3rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--success-color)' }}>
          <CheckCircle size={64} />
        </div>
        <h1 style={{ marginBottom: '1rem' }}>Application Submitted</h1>
        <p className="subtitle" style={{ marginBottom: '2rem' }}>
          Thank you for applying. We will review your application and email you once a decision is made.
        </p>
        
        <button onClick={() => navigate('/status/pending')} className="btn btn-primary btn-full">
          View Status
        </button>
      </div>
    </div>
  );
}
