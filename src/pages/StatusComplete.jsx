import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StatusComplete() {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
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
