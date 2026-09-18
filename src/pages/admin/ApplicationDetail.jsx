import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import StatusBadge from '../../components/StatusBadge';
import { ArrowLeft, Check, X, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [images, setImages] = useState({}); // Pre-fetched signed URLs
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          drivers (*),
          vehicles (*),
          documents (*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setApp(data);
      setLoading(false); // Instantly show UI
      
      // Load images concurrently in the background
      if (data.documents && data.documents.length > 0) {
        const urls = {};
        await Promise.all(data.documents.map(async (doc) => {
          try {
            const { data: urlData } = await supabase.storage.from('driver-documents').createSignedUrl(doc.file_url, 3600);
            if (urlData?.signedUrl) {
              urls[doc.type] = urlData.signedUrl;
            } else {
              urls[doc.type] = 'error';
            }
          } catch (e) {
            console.error("Failed to load image URL", e);
            urls[doc.type] = 'error';
          }
        }));
        setImages(urls);
      }
      setImagesLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setImagesLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionError('');
    setActionLoading(true);
    try {
      await supabase.from('applications').update({
        status: 'approved',
        decided_at: new Date()
      }).eq('id', id);

      // Send email
      if (app.drivers?.email) {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: app.drivers.email,
            name: app.drivers.full_name,
            status: 'approved'
          })
        }).catch(e => console.error("Email API failed:", e));
      }
      
      navigate('/admin');
    } catch (err) {
      console.error(err);
      setActionError('Failed to approve the application.');
    } finally {
      setActionLoading(false);
      setConfirmApprove(false);
    }
  };

  const handleReject = async () => {
    setActionError('');
    if (!rejectionReason.trim()) {
      setActionError("Please provide a rejection reason.");
      return;
    }
    setActionLoading(true);
    try {
      await supabase.from('applications').update({
        status: 'rejected',
        decided_at: new Date(),
        rejection_reason: rejectionReason
      }).eq('id', id);
      
      // Send email
      if (app.drivers?.email) {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: app.drivers.email,
            name: app.drivers.full_name,
            status: 'rejected',
            reason: rejectionReason
          })
        }).catch(e => console.error("Email API failed:", e));
      }

      navigate('/admin');
    } catch (err) {
      console.error(err);
      setActionError('Failed to reject the application.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionError('');
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      setActionError('Please type DELETE to confirm.');
      return;
    }
    
    setActionLoading(true);
    try {
      const res = await fetch('/api/delete-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, applicationId: id })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      navigate('/admin');
    } catch (err) {
      console.error(err);
      setActionError('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="container" style={{ padding: '2rem' }}>Loading...</div>;
  if (!app) return <div className="container">Application not found.</div>;

  const vehicle = app.vehicles && app.vehicles.length > 0 ? app.vehicles[0] : null;

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ margin: 0 }}>Application Review</h1>
        <div style={{ marginLeft: 'auto' }}>
          <StatusBadge status={app.status} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem' }}>Personal Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
              <div><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Full Name</strong> {app.drivers?.full_name}</div>
              <div><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>DOB</strong> {app.drivers?.date_of_birth}</div>
              <div><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Email</strong> {app.drivers?.email}</div>
              <div><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Phone</strong> {app.drivers?.phone}</div>
              <div style={{ gridColumn: 'span 2' }}><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Address</strong> {app.drivers?.address}</div>
            </div>
            
            <h4 style={{ margin: '1.5rem 0 0.5rem 0', color: 'var(--text-secondary)' }}>Emergency Contact</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
              <div><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Name</strong> {app.drivers?.emergency_contact_name}</div>
              <div><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Phone</strong> {app.drivers?.emergency_contact_phone}</div>
            </div>

            <h4 style={{ margin: '1.5rem 0 0.5rem 0', color: 'var(--text-secondary)' }}>Licence Verification</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-secondary)' }}>OCR (Name/DOB)</strong>
                <LicenceStatusBadge status={app.licence_ocr_status} />
              </div>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Face Match (Licence→Selfie)</strong>
                <LicenceStatusBadge status={app.licence_face_match_status} />
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem' }}>Vehicle Information</h3>
            {vehicle ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
                <div><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Type</strong> <span style={{ textTransform: 'capitalize' }}>{vehicle.type}</span></div>
                <div><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Make/Model</strong> {vehicle.make} {vehicle.model}</div>
                <div><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Year/Color</strong> {vehicle.year} {vehicle.color}</div>
                <div><strong style={{ display: 'block', color: 'var(--text-secondary)' }}>Plate</strong> {vehicle.plate_number}</div>
              </div>
            ) : (
              <p>No vehicle information.</p>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem' }}>Documents</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {['license_front', 'license_back'].map(type => (
                <div key={type}>
                  <strong style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                    {type.replace('_', ' ')}
                  </strong>
                  {images[type] && images[type] !== 'error' ? (
                    <a href={images[type]} target="_blank" rel="noreferrer">
                      <img src={images[type]} alt={type} style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
                    </a>
                  ) : imagesLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                       <span className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                    </div>
                  ) : images[type] === 'error' ? (
                    <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(239,68,68,0.1)', color: 'var(--error-color)', borderRadius: '8px' }}>File Corrupted</div>
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>Missing</div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Identity & Face Match Box */}
          <div className="glass-panel" style={{ padding: '1.5rem', border: app.face_match_status === 'match' ? '1px solid var(--success-color)' : app.face_match_status === 'needs_review' ? '1px solid var(--warning-color)' : '1px solid var(--surface-border)' }}>
            <h3 style={{ marginBottom: '1rem' }}>Identity Verification</h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <div><strong style={{ color: 'var(--text-secondary)' }}>ID Type:</strong> {app.id_type}</div>
              <div><strong style={{ color: 'var(--text-secondary)' }}>ID Num:</strong> {app.id_number}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>ID Front</strong>
                {images.id_front && images.id_front !== 'error' ? (
                  <a href={images.id_front} target="_blank" rel="noreferrer"><img src={images.id_front} alt="ID Front" style={{ width: '100%', borderRadius: '8px' }} /></a>
                ) : imagesLoading ? (
                  <div style={{ padding: '1rem', textAlign: 'center' }}>Loading...</div>
                ) : images.id_front === 'error' ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--error-color)' }}>Error</div>
                ) : <div>Missing</div>}
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Selfie Capture</strong>
                {images.selfie && images.selfie !== 'error' ? (
                  <a href={images.selfie} target="_blank" rel="noreferrer"><img src={images.selfie} alt="Selfie" style={{ width: '100%', borderRadius: '8px' }} /></a>
                ) : imagesLoading ? (
                  <div style={{ padding: '1rem', textAlign: 'center' }}>Loading...</div>
                ) : images.selfie === 'error' ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--error-color)' }}>Error</div>
                ) : <div>Missing</div>}
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>OCR Text Match (Name/DOB):</span>
                <span style={{ fontWeight: '600', color: app.ocr_match_status === 'match' ? 'var(--success-color)' : app.ocr_match_status === 'no_match' ? 'var(--warning-color)' : 'inherit' }}>
                   {app.ocr_match_status === 'match' ? 'Match' : app.ocr_match_status === 'no_match' ? 'Review Needed' : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>AI Face Score:</span>
                <span style={{ fontWeight: '600' }}>{app.face_match_distance ? Number(app.face_match_distance).toFixed(2) : 'N/A'}</span>
              </div>
              
              <div style={{ marginTop: '1rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                {app.face_match_status === 'match' && (app.ocr_match_status === 'match' || app.ocr_match_status == null) ? (
                  <span style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}><Check size={16}/> Passed Automated Checks</span>
                ) : app.face_match_status === 'needs_review' || app.ocr_match_status === 'no_match' ? (
                  <span style={{ color: 'var(--warning-color)' }}>⚠ Needs Manual Review</span>
                ) : (
                  <span style={{ color: 'var(--error-color)' }}>Automated Checks Failed</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Box */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Review Decision</h3>
            
            {actionError && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255,100,100,0.1)', color: 'var(--error-color)', borderRadius: '8px', fontSize: '0.875rem' }}>
                {actionError}
              </div>
            )}

            {app.status === 'approved' || app.status === 'rejected' ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                Decision already made: <strong style={{ color: app.status === 'approved' ? 'var(--success-color)' : 'var(--error-color)', textTransform: 'capitalize' }}>{app.status}</strong>
                {app.rejection_reason && <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>"{app.rejection_reason}"</p>}
              </div>
            ) : (
              <div>
                {!rejecting ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    {!confirmApprove ? (
                      <button onClick={() => setConfirmApprove(true)} className="btn btn-primary" style={{ background: 'var(--success-color)' }} disabled={actionLoading}>
                        <Check size={18} /> Approve Application
                      </button>
                    ) : (
                      <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', border: '1px solid var(--success-color)' }}>
                        <p style={{ color: 'var(--success-color)', marginBottom: '1rem', fontWeight: 'bold' }}>Confirm Approval?</p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={handleApprove} className="btn" style={{ flex: 1, background: 'var(--success-color)', color: 'white' }} disabled={actionLoading}>
                            Yes, Approve
                          </button>
                          <button onClick={() => setConfirmApprove(false)} className="btn btn-secondary" style={{ flex: 1 }} disabled={actionLoading}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <button onClick={() => setRejecting(true)} className="btn btn-secondary" style={{ color: 'var(--error-color)', borderColor: 'var(--error-color)' }} disabled={actionLoading}>
                      <X size={18} /> Reject Application
                    </button>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Rejection Reason (Required)</label>
                    <textarea 
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain what the driver needs to fix..."
                      style={{ minHeight: '100px', marginBottom: '1rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={handleReject} className="btn" style={{ flex: 1, background: 'var(--error-color)', color: 'white' }} disabled={actionLoading}>
                        Confirm Reject
                      </button>
                      <button onClick={() => setRejecting(false)} className="btn btn-secondary" style={{ flex: 1 }} disabled={actionLoading}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            
            <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,100,100,0.2)', paddingTop: '1.5rem' }}>
              <button onClick={() => setDeletePromptOpen(true)} className="btn" style={{ width: '100%', background: 'transparent', border: '1px solid var(--error-color)', color: 'var(--error-color)' }} disabled={actionLoading}>
                <Trash2 size={18} style={{ marginRight: '0.5rem', display: 'inline' }} /> Delete Application
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Elegant Delete Modal */}
      {deletePromptOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--surface-bg)',
            border: '1px solid var(--surface-border)',
            borderRadius: '12px',
            padding: '2rem',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
            textAlign: 'center'
          }}>
            <Trash2 size={48} style={{ color: 'var(--error-color)', margin: '0 auto 1rem auto' }} />
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', color: '#fff' }}>Delete Application?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
              This action cannot be undone. All data, documents, and vehicle records will be permanently erased.
            </p>
            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Type <strong>DELETE</strong> to confirm
              </label>
              <input 
                type="text" 
                placeholder="DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '1rem', textAlign: 'center', letterSpacing: '2px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => { setDeletePromptOpen(false); setDeleteConfirmText(''); }} 
                className="btn btn-secondary" 
                style={{ flex: 1 }} 
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete} 
                className="btn" 
                style={{ flex: 1, background: 'var(--error-color)', color: 'white', opacity: deleteConfirmText.toLowerCase() === 'delete' ? 1 : 0.5 }} 
                disabled={actionLoading || deleteConfirmText.toLowerCase() !== 'delete'}
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LicenceStatusBadge({ status }) {
  if (!status) {
    return <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Not scanned</span>;
  }
  const config = {
    match: { color: 'var(--success-color)', label: '✓ Verified' },
    no_match: { color: 'var(--error-color)', label: '✗ Failed' },
    needs_review: { color: 'var(--warning-color)', label: '⚠ Needs Review' },
  };
  const c = config[status] || { color: 'var(--text-secondary)', label: status };
  return (
    <span style={{
      display: 'inline-block',
      marginTop: '0.25rem',
      padding: '0.2rem 0.6rem',
      borderRadius: '999px',
      background: `${c.color}22`,
      color: c.color,
      fontSize: '0.78rem',
      fontWeight: '600',
      border: `1px solid ${c.color}55`,
    }}>
      {c.label}
    </span>
  );
}
