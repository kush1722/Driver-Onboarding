import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';

export default function ApplicationsQueue() {
  const [allApplications, setAllApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const query = supabase
        .from('applications')
        .select(`
          id, status, submitted_at, created_at,
          drivers (full_name),
          vehicles (type)
        `)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setAllApplications(data);
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

  const filteredApps = filter === 'all' ? allApplications : allApplications.filter(a => a.status === filter);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 6vw, 2rem)', lineHeight: 1.2 }}>Application Queue</h1>
        <button onClick={handleSignOut} className="text-link" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '1rem', marginTop: '0.25rem' }}>Sign out</button>
      </div>

      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
          {['all', 'submitted', 'under_review', 'approved', 'rejected'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flexShrink: 0,
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
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: '0.5rem', width: '3rem', background: 'linear-gradient(to right, transparent, var(--bg-color))', pointerEvents: 'none', zIndex: 10 }}></div>
      </div>

      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <div className="glass-panel hide-scrollbar" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
            ) : filteredApps.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center' }}>No applications found.</td></tr>
            ) : (
              filteredApps.map(app => (
                <tr 
                  key={app.id} 
                  style={{ borderBottom: '1px solid var(--surface-border)', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-border)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => navigate(`/admin/applications/${app.id}`)}
                >
                  <td data-label="Driver Name" style={{ padding: '1rem' }}>{app.drivers?.full_name || 'Unknown'}</td>
                  <td data-label="Vehicle" style={{ padding: '1rem', textTransform: 'capitalize' }}>
                    {app.vehicles && app.vehicles.length > 0 ? app.vehicles[0].type : 'None'}
                  </td>
                  <td data-label="Submitted" style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '-'}
                  </td>
                  <td data-label="Status" style={{ padding: '1rem' }}>
                    <StatusBadge status={app.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <div className="table-fade" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '4rem', background: 'linear-gradient(to right, transparent, rgba(17, 24, 39, 0.9))', pointerEvents: 'none', borderTopRightRadius: '16px', borderBottomRightRadius: '16px', zIndex: 10 }}></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '0 0.5rem' }}>
        <div>
          Showing {filteredApps.length} of {allApplications.length} application{allApplications.length !== 1 ? 's' : ''}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span><strong style={{ color: 'var(--text-primary)' }}>{allApplications.filter(a => a.status === 'submitted').length}</strong> New</span>
          <span><strong style={{ color: 'var(--text-primary)' }}>{allApplications.filter(a => a.status === 'under_review').length}</strong> Reviewing</span>
          <span><strong style={{ color: 'var(--text-primary)' }}>{allApplications.filter(a => a.status === 'approved').length}</strong> Approved</span>
        </div>
      </div>
    </div>
  );
}
