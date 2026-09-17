import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';

export default function ApplicationsQueue() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('applications')
        .select(`
          id, status, submitted_at, created_at,
          drivers (full_name),
          vehicles (type)
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      } else {
        query = query.neq('status', 'draft');
      }

      const { data, error } = await query;
      if (error) throw error;
      setApplications(data);
    } catch (err) {
      console.error("Supabase Error:", err);
      // alert the user so they can tell us what the error is
      alert("Database error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Application Queue</h1>
        <button onClick={handleSignOut} className="btn btn-secondary">Sign out</button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        {['all', 'submitted', 'under_review', 'approved', 'rejected'].map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              border: `1px solid ${filter === f ? 'var(--accent-color)' : 'var(--surface-border)'}`,
              background: filter === f ? 'var(--accent-color)' : 'transparent',
              color: filter === f ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {f === 'all' ? 'All Applications' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.2)' }}>
              <th style={{ padding: '1rem' }}>Driver Name</th>
              <th style={{ padding: '1rem' }}>Vehicle</th>
              <th style={{ padding: '1rem' }}>Submitted</th>
              <th style={{ padding: '1rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</td></tr>
            ) : applications.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center' }}>No applications found.</td></tr>
            ) : (
              applications.map(app => (
                <tr 
                  key={app.id} 
                  style={{ borderBottom: '1px solid var(--surface-border)', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-border)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => navigate(`/admin/applications/${app.id}`)}
                >
                  <td style={{ padding: '1rem' }}>{app.drivers?.full_name || 'Unknown'}</td>
                  <td style={{ padding: '1rem', textTransform: 'capitalize' }}>
                    {app.vehicles && app.vehicles.length > 0 ? app.vehicles[0].type : 'None'}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <StatusBadge status={app.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
