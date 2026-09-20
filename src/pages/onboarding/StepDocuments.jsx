import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, RefreshCw, Send } from 'lucide-react';
import DocumentUploadSlot from '../../components/DocumentUploadSlot';
import { supabase } from '../../lib/supabaseClient';

// Convert a remote URL into a base64 data URL so we can send it to our API
const urlToBase64 = async (url) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const S = {
  IDLE: null,
  SCANNING: 'scanning',
  MATCH: 'match',
  NO_MATCH: 'no_match',
  NEEDS_REVIEW: 'needs_review',
};

export default function StepDocuments({ applicationId }) {
  const navigate = useNavigate();

  // Upload state
  const [frontUploaded, setFrontUploaded] = useState(false);
  const [backUploaded, setBackUploaded] = useState(false);
  const [regUploaded, setRegUploaded] = useState(false);
  const [insUploaded, setInsUploaded] = useState(false);
  // Incrementing this key forces DocumentUploadSlot to remount (reset)
  const [licenceFrontKey, setLicenceFrontKey] = useState(0);

  // Context loaded on mount
  const [driverDetails, setDriverDetails] = useState(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState(null);

  // Verification check statuses
  const [ocrStatus, setOcrStatus] = useState(S.IDLE);
  const [ocrReason, setOcrReason] = useState('');
  const [faceStatus, setFaceStatus] = useState(S.IDLE);
  const [faceReason, setFaceReason] = useState('');

  // Whether the driver chose to proceed despite failures
  const [overrideSubmitted, setOverrideSubmitted] = useState(false);

  // ── Load driver info + selfie on mount ──────────────────────────────────
  useEffect(() => {
    if (!applicationId) return;

    const loadContext = async () => {
      try {
        const { data: app, error: appErr } = await supabase
          .from('applications')
          .select(`
            driver_id,
            licence_ocr_status,
            licence_face_match_status,
            drivers (full_name, date_of_birth),
            documents (type)
          `)
          .eq('id', applicationId)
          .single();

        if (appErr) throw appErr;

        if (app) {
          setDriverDetails(app.drivers);

          // Restore persisted check statuses so the UI reflects prior runs
          if (app.licence_ocr_status) setOcrStatus(app.licence_ocr_status);
          if (app.licence_face_match_status) setFaceStatus(app.licence_face_match_status);

          const ocrOk = app.licence_ocr_status === S.MATCH || app.licence_ocr_status === S.NEEDS_REVIEW;
          const faceOk = app.licence_face_match_status === S.MATCH || app.licence_face_match_status === S.NEEDS_REVIEW;

          if (ocrOk || faceOk) setFrontUploaded(true);
          if (app.licence_ocr_status === S.NEEDS_REVIEW || app.licence_face_match_status === S.NEEDS_REVIEW) {
            setOverrideSubmitted(true);
          }

          if (app.documents) {
            if (app.documents.some(d => d.type === 'license_back')) setBackUploaded(true);
            if (app.documents.some(d => d.type === 'vehicle_registration')) setRegUploaded(true);
            if (app.documents.some(d => d.type === 'vehicle_insurance')) setInsUploaded(true);
          }
        }

        // We no longer need to fetch the selfie base64 on the client side
        // because the Vercel API will securely fetch it directly from Supabase!
      } catch (err) {
        console.error('StepDocuments: context load failed', err);
        setContextError('Failed to load your application details. Please refresh and try again.');
      } finally {
        setLoadingContext(false);
      }
    };

    loadContext();
  }, [applicationId]);

  // ── OCR helper ─────────────────────────────────────────────────────────
  const runOcrCheck = async () => {
    if (!driverDetails?.full_name) {
      return { status: S.NO_MATCH, reason: 'Driver details not found. Please complete the personal details step first.' };
    }
    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        fullName: driverDetails.full_name,
        dateOfBirth: driverDetails.date_of_birth,
        isLicence: true,
      }),
    });
    const data = await res.json();
    return {
      status: data.isMatch ? S.MATCH : S.NO_MATCH,
      reason: data.isMatch
        ? ''
        : `Name or date of birth on the licence could not be verified. ` +
          `Found: "${data.extractedName || 'N/A'}" / "${data.extractedDob || 'N/A'}". ` +
          `Ensure the front of the licence is clearly visible and well-lit.`,
    };
  };

  // ── Face-match helper ──────────────────────────────────────────────────
  const runFaceMatchCheck = async () => {
    const res = await fetch('/api/licence-face-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
      }),
    });
    const data = await res.json();
    return {
      status: data.matched ? S.MATCH : S.NO_MATCH,
      reason: data.reason || '',
    };
  };

  // ── Called by DocumentUploadSlot after successful upload ───────────────
  const handleLicenceFrontUpload = async () => {
    setFrontUploaded(true);
    setOcrStatus(S.SCANNING);
    setFaceStatus(S.SCANNING);
    setOverrideSubmitted(false);

    // Run both checks in parallel
    const [ocrResult, faceResult] = await Promise.allSettled([
      runOcrCheck(),
      runFaceMatchCheck(),
    ]);

    // Handle OCR result
    if (ocrResult.status === 'fulfilled') {
      const { status, reason } = ocrResult.value;
      setOcrStatus(status);
      setOcrReason(reason);
      await supabase.from('applications').update({ licence_ocr_status: status }).eq('id', applicationId);
    } else {
      console.error('OCR check threw:', ocrResult.reason);
      setOcrStatus(S.NO_MATCH);
      setOcrReason('OCR scan failed. Please try a clearer photo of the licence front.');
      await supabase.from('applications').update({ licence_ocr_status: S.NO_MATCH }).eq('id', applicationId);
    }

    // Handle face-match result
    if (faceResult.status === 'fulfilled') {
      const { status, reason } = faceResult.value;
      setFaceStatus(status);
      setFaceReason(reason);
      await supabase.from('applications').update({ licence_face_match_status: status }).eq('id', applicationId);
    } else {
      console.error('Face match check threw:', faceResult.reason);
      setFaceStatus(S.NO_MATCH);
      setFaceReason('Face comparison failed. Please try a clearer photo.');
      await supabase.from('applications').update({ licence_face_match_status: S.NO_MATCH }).eq('id', applicationId);
    }
  };

  // ── Re-upload: reset the licence front slot ────────────────────────────
  const handleRetry = () => {
    setFrontUploaded(false);
    setOcrStatus(S.IDLE);
    setOcrReason('');
    setFaceStatus(S.IDLE);
    setFaceReason('');
    setOverrideSubmitted(false);
    setLicenceFrontKey((k) => k + 1); // remounts DocumentUploadSlot
  };

  // ── Submit for admin review despite failures ───────────────────────────
  const handleSubmitForReview = async () => {
    const updates = {};
    if (ocrStatus === S.NO_MATCH) updates.licence_ocr_status = S.NEEDS_REVIEW;
    if (faceStatus === S.NO_MATCH) updates.licence_face_match_status = S.NEEDS_REVIEW;

    if (Object.keys(updates).length > 0) {
      await supabase.from('applications').update(updates).eq('id', applicationId);
    }

    if (ocrStatus === S.NO_MATCH) setOcrStatus(S.NEEDS_REVIEW);
    if (faceStatus === S.NO_MATCH) setFaceStatus(S.NEEDS_REVIEW);
    setOverrideSubmitted(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/onboarding/review');
  };

  // ── Can proceed gate ───────────────────────────────────────────────────
  const checksRunning = ocrStatus === S.SCANNING || faceStatus === S.SCANNING;
  const checksAllPassed = ocrStatus === S.MATCH && faceStatus === S.MATCH;
  const anyStillFailing = ocrStatus === S.NO_MATCH || faceStatus === S.NO_MATCH;
  const noChecksRan = !ocrStatus && !faceStatus; // selfie missing edge-case
  const canProceed =
    frontUploaded &&
    backUploaded &&
    regUploaded &&
    insUploaded &&
    !checksRunning &&
    (checksAllPassed || overrideSubmitted || noChecksRan);

  // ── Render ─────────────────────────────────────────────────────────────
  if (loadingContext) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Driver's Licence</h2>
      <p className="subtitle" style={{ marginBottom: '2rem' }}>
        Upload photos of your valid driver's licence. We'll automatically verify it matches your identity.
      </p>

      {contextError && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(239,68,68,0.1)', color: 'var(--error-color)', borderRadius: '10px', fontSize: '0.875rem' }}>
          ⚠ {contextError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Licence Front ── */}
        <DocumentUploadSlot
          key={licenceFrontKey}
          applicationId={applicationId}
          documentType="license_front"
          label="Licence Front"
          accept="image/*"
          onUploadSuccess={handleLicenceFrontUpload}
        />

        {/* ── Verification Result Cards ── */}
        {(ocrStatus || faceStatus) && (
          <div style={{ marginBottom: '1.5rem' }}>
            <CheckCard label="Name & Date of Birth" status={ocrStatus} reason={ocrReason} />
            <CheckCard label="Face Match (Licence → Selfie)" status={faceStatus} reason={faceReason} />

            {/* Action panel — shown only when at least one check failed and override not yet chosen */}
            {anyStillFailing && !overrideSubmitted && (
              <div style={{
                marginTop: '0.75rem',
                padding: '1.25rem',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '12px',
              }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  One or more checks could not be automatically verified. You can re-upload a clearer photo, or flag this for manual admin review and continue.
                </p>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleRetry}
                    style={{ gap: '0.5rem' }}
                  >
                    <RefreshCw size={15} /> Re-upload Photo
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSubmitForReview}
                    style={{ gap: '0.5rem', color: 'var(--warning-color)', borderColor: 'var(--warning-color)' }}
                  >
                    <Send size={15} /> Submit for Admin Review
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation once user chose to submit for review */}
            {overrideSubmitted && anyStillFailing && (
              <div style={{
                marginTop: '0.75rem',
                padding: '1rem',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: '12px',
                color: 'var(--warning-color)',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                ⚠ Submitted for admin review. An admin will manually verify your licence. You can continue.
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: frontUploaded ? '0' : '1rem' }}>
          <DocumentUploadSlot
            applicationId={applicationId}
            documentType="license_back"
            label="Licence Back"
            accept="image/*,application/pdf"
            onUploadSuccess={() => setBackUploaded(true)}
          />
        </div>

        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--surface-border)', paddingTop: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Vehicle Documents</h3>
          <p className="subtitle" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Please upload your vehicle registration and proof of insurance.
          </p>

          <DocumentUploadSlot
            applicationId={applicationId}
            documentType="vehicle_registration"
            label="Vehicle Registration"
            accept="image/*,application/pdf"
            onUploadSuccess={() => setRegUploaded(true)}
          />

          <div style={{ marginTop: regUploaded ? '0' : '1rem' }}>
            <DocumentUploadSlot
              applicationId={applicationId}
              documentType="vehicle_insurance"
              label="Proof of Insurance"
              accept="image/*,application/pdf"
              onUploadSuccess={() => setInsUploaded(true)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" disabled={!canProceed}>
            {checksRunning ? 'Verifying...' : 'Next Step'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Shared status card component ────────────────────────────────────────────
function CheckCard({ label, status, reason }) {
  if (!status) return null;

  const config = {
    scanning: {
      bg: 'rgba(99,102,241,0.07)',
      border: 'rgba(99,102,241,0.25)',
      color: 'var(--accent-color)',
      icon: (
        <span style={{
          display: 'inline-block', width: '15px', height: '15px',
          border: '2px solid var(--accent-color)', borderRightColor: 'transparent',
          borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0,
        }} />
      ),
      message: `Scanning ${label}…`,
    },
    match: {
      bg: 'rgba(16,185,129,0.07)',
      border: 'rgba(16,185,129,0.25)',
      color: 'var(--success-color)',
      icon: <CheckCircle size={16} color="var(--success-color)" style={{ flexShrink: 0 }} />,
      message: `${label} — Verified ✓`,
    },
    no_match: {
      bg: 'rgba(239,68,68,0.07)',
      border: 'rgba(239,68,68,0.25)',
      color: 'var(--error-color)',
      icon: <XCircle size={16} color="var(--error-color)" style={{ flexShrink: 0 }} />,
      message: `${label} — Could not verify`,
    },
    needs_review: {
      bg: 'rgba(245,158,11,0.07)',
      border: 'rgba(245,158,11,0.25)',
      color: 'var(--warning-color)',
      icon: <span style={{ flexShrink: 0 }}>⚠</span>,
      message: `${label} — Sent for admin review`,
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      padding: '0.875rem 1rem',
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: '10px',
      marginBottom: '0.5rem',
    }}>
      <span style={{ marginTop: '2px' }}>{c.icon}</span>
      <div>
        <p style={{ color: c.color, fontWeight: '600', fontSize: '0.875rem', margin: 0 }}>{c.message}</p>
        {reason && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.3rem 0 0 0', lineHeight: '1.4' }}>{reason}</p>
        )}
      </div>
    </div>
  );
}
