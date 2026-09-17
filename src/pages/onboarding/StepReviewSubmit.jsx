import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function StepReviewSubmit({ applicationId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!applicationId) return;

    const fetchSummary = async () => {
      try {
        const { data: app, error: appErr } = await supabase
          .from('applications')
          .select(`
            id_type, id_number, face_match_status,
            drivers (*),
            vehicles (*),
            documents (*)
          `)
          .eq('id', applicationId)
          .single();

        if (appErr) throw appErr;

        if (app) {
          setSummary({
            personal: app.drivers,
            identity: { id_type: app.id_type, id_number: app.id_number, face_match: app.face_match_status },
            vehicle: app.vehicles && app.vehicles.length > 0 ? app.vehicles[0] : null,
            documents: app.documents || []
          });
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load summary");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [applicationId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      const { error: submitErr } = await supabase
        .from('applications')
        .update({ status: 'submitted', submitted_at: new Date() })
        .eq('id', applicationId);

      if (submitErr) throw submitErr;

      navigate('/status/complete');
    } catch (err) {
      console.error(err);
      setError("Failed to submit application. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Review & Submit</h2>
      <p className="subtitle" style={{ marginBottom: '2rem' }}>Please review your details before submitting.</p>

      {summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Personal Details</h3>
              <button className="text-link" onClick={() => navigate('/onboarding/personal')}>Edit</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>Name:</span> {summary.personal?.full_name}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Phone:</span> {summary.personal?.phone}</div>
              <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'var(--text-secondary)' }}>Address:</span> {summary.personal?.address}</div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Identity</h3>
              <button className="text-link" onClick={() => navigate('/onboarding/identity')}>Edit</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>Type:</span> {summary.identity?.id_type}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Number:</span> {summary.identity?.id_number}</div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Face Match:</span>{' '}
                <span style={{ color: summary.identity?.face_match === 'match' ? 'var(--success-color)' : 'var(--warning-color)' }}>
                  {summary.identity?.face_match === 'match' ? 'Matched' : 'Needs Review'}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Vehicle Details</h3>
              <button className="text-link" onClick={() => navigate('/onboarding/vehicle')}>Edit</button>
            </div>
            {summary.vehicle ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div><span style={{ color: 'var(--text-secondary)' }}>Type:</span> {summary.vehicle.type}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Plate:</span> {summary.vehicle.plate_number}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Make/Model:</span> {summary.vehicle.make} {summary.vehicle.model}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Color/Year:</span> {summary.vehicle.color} ({summary.vehicle.year})</div>
              </div>
            ) : (
              <p style={{ color: 'var(--warning-color)', fontSize: '0.875rem' }}>Missing vehicle details</p>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Documents</h3>
              <button className="text-link" onClick={() => navigate('/onboarding/documents')}>Edit</button>
            </div>
            <ul style={{ listStyle: 'none', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {summary.documents.map(doc => (
                <li key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)' }} />
                  {doc.type} uploaded
                </li>
              ))}
              {summary.documents.length === 0 && <li style={{ color: 'var(--warning-color)' }}>No documents uploaded</li>}
            </ul>
          </div>

        </div>
      )}

      {error && <p className="error-text mt-4">{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
        <button onClick={handleSubmit} className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}
