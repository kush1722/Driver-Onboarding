import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import DocumentUploadSlot from '../../components/DocumentUploadSlot';
import SelfieCapture from '../../components/SelfieCapture';
import { compareFaces } from '../../lib/faceMatch';
import { verifyIdWithGemini } from '../../lib/ocrMatch';

export default function StepIdentityVerification({ applicationId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [idType, setIdType] = useState('national_id');
  const [idNumber, setIdNumber] = useState('');
  const [idFrontUrl, setIdFrontUrl] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  
  const [matchStatus, setMatchStatus] = useState(null); // 'match', 'no_match', 'needs_review'
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Driver details for OCR matching
  const [driverDetails, setDriverDetails] = useState(null);
  const [ocrStatus, setOcrStatus] = useState(null); // 'scanning', 'match', 'no_match'
  const [ocrFeedback, setOcrFeedback] = useState('');

  useEffect(() => {
    if (!applicationId) return;

    const fetchIdentityDetails = async () => {
      try {
        const { data: app, error: appErr } = await supabase
          .from('applications')
          .select(`
            id_type, 
            id_number, 
            face_match_status,
            drivers (full_name, date_of_birth)
          `)
          .eq('id', applicationId)
          .single();

        if (appErr) throw appErr;

        if (app) {
          setIdType(app.id_type || 'national_id');
          setIdNumber(app.id_number || '');
          setMatchStatus(app.face_match_status || null);
          
          if (app.drivers) {
             setDriverDetails(app.drivers);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchIdentityDetails();
  }, [applicationId]);

  const handleIdFrontUpload = async (url, preview) => {
    setIdFrontUrl(url);
    setIdFrontPreview(preview);
    checkFaceMatch(preview, selfiePreview);
    
    // Trigger OCR Scan
    if (driverDetails && driverDetails.full_name) {
      setOcrStatus('scanning');
      setOcrFeedback('Scanning ID for Name and Date of Birth...');
      try {
        const result = await verifyIdWithGemini(preview, driverDetails.full_name, driverDetails.date_of_birth);
        
        let newOcrStatus = 'no_match';
        if (result.isMatch) {
          newOcrStatus = 'match';
          setOcrStatus('match');
          setOcrFeedback('ID details verified automatically!');
        } else {
          setOcrStatus('no_match');
          setOcrFeedback('We could not automatically read your exact Name and DOB from the ID. A reviewer will verify this manually.');
        }
        
        // Save to DB
        await supabase.from('applications').update({ ocr_match_status: newOcrStatus }).eq('id', applicationId);
      } catch (err) {
        console.error(err);
        setOcrStatus('no_match');
        setOcrFeedback('OCR Scan failed. A reviewer will verify this manually.');
      }
    }
  };

  const handleSelfieUpload = (url, preview) => {
    setSelfiePreview(preview);
    checkFaceMatch(idFrontPreview, preview);
  };

  const checkFaceMatch = async (idImgSrc, selfieImgSrc) => {
    if (!idImgSrc || !selfieImgSrc) return;
    
    // Create image elements for face-api
    const imgA = new Image();
    const imgB = new Image();
    
    imgA.src = idImgSrc;
    imgB.src = selfieImgSrc;

    // Wait for images to load
    await Promise.all([
      new Promise(resolve => imgA.onload = resolve),
      new Promise(resolve => imgB.onload = resolve)
    ]);

    const result = await compareFaces(imgA, imgB);
    
    let newStatus = 'needs_review';
    if (result.matched) {
      newStatus = 'match';
      setError(null);
    } else {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      const reasonMsg = result.reason ? ` Reason: ${result.reason}` : '';
      
      if (attempts < 3) {
        newStatus = 'no_match';
        setError(`We couldn't get a clear match.${reasonMsg} Please retake your selfie.`);
      } else {
        newStatus = 'needs_review';
        setError(`We still couldn't match the faces.${reasonMsg} You can proceed, but a reviewer will check it manually.`);
      }
    }

    setMatchStatus(newStatus);

    // Save match status and distance
    await supabase.from('applications').update({
      face_match_status: newStatus,
      face_match_distance: result.distance
    }).eq('id', applicationId);
  };

  const handleBlur = async () => {
    if (!idNumber) return;
    await supabase.from('applications').update({
      id_type: idType,
      id_number: idNumber
    }).eq('id', applicationId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // 1. Validate ID Number
    if (idNumber.trim().length < 5) {
      return setError("Please enter a valid ID Number (minimum 5 characters).");
    }

    if (matchStatus === 'no_match') {
      setError("Please retake your selfie until we get a match, or try 3 times to trigger a manual review.");
      return;
    }

    setSaving(true);
    try {
      await supabase.from('applications').update({
        id_type: idType,
        id_number: idNumber
      }).eq('id', applicationId);

      navigate('/onboarding/vehicle');
    } catch (err) {
      console.error(err);
      setError("Failed to save details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Identity Verification</h2>
      <p className="subtitle" style={{ marginBottom: '2rem' }}>We need to verify your identity to ensure passenger safety.</p>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>ID Type</label>
            <select value={idType} onChange={(e) => setIdType(e.target.value)} onBlur={handleBlur} required>
              <option value="national_id">National ID</option>
              <option value="passport">Passport</option>
              <option value="drivers_license">Driver's License</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
            <label>ID Number</label>
            <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} onBlur={handleBlur} required />
          </div>
        </div>

        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--surface-border)', paddingTop: '2rem' }}>
          <DocumentUploadSlot 
            applicationId={applicationId} 
            documentType="id_front" 
            label="ID Document (Front)" 
            onUploadSuccess={handleIdFrontUpload}
          />
          
          {ocrStatus === 'scanning' && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-color)', borderRadius: '8px' }}>
              <span className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '8px' }}></span>
              {ocrFeedback}
            </div>
          )}
          {ocrStatus === 'match' && (
             <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', borderRadius: '8px' }}>
              ✓ {ocrFeedback}
            </div>
          )}
          {ocrStatus === 'no_match' && (
             <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', borderRadius: '8px' }}>
              ⚠ {ocrFeedback}
            </div>
          )}
          
          <div style={{ marginTop: '1rem' }}>
            <DocumentUploadSlot 
              applicationId={applicationId} 
              documentType="id_back" 
              label="ID Document (Back)" 
            />
          </div>
        </div>

        <div style={{ marginTop: '2rem', paddingTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
             <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--success-color)', color: '#fff', fontSize: '12px', marginRight: '8px' }}>✓</span>
             <span style={{ fontSize: '0.875rem' }}>ID Upload</span>
             <div style={{ flex: 1, height: '1px', background: 'var(--surface-border)', margin: '0 12px' }}></div>
             <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: '500' }}>Step 2: Selfie</span>
          </div>
          <SelfieCapture 
            applicationId={applicationId} 
            onCaptureSuccess={handleSelfieUpload} 
          />
        </div>

        {matchStatus === 'match' && (
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', borderRadius: '8px', marginBottom: '1rem' }}>
            Face match successful!
          </div>
        )}

        {error && <p className="error-text mb-4">{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !idFrontPreview || !selfiePreview || matchStatus === 'no_match'}>
            {saving ? 'Saving...' : 'Next Step'}
          </button>
        </div>
      </form>
    </div>
  );
}
