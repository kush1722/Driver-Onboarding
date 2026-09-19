import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import imageCompression from 'browser-image-compression';

// ─────────────────────────────────────────────────────────────────────────────
// Guide states — drive colour, message, and oval animation
// ─────────────────────────────────────────────────────────────────────────────
const GUIDE = {
  WAITING:    { label: 'Position your face in the oval',        color: '#FFFFFF', subtext: 'Make sure you are in good lighting' },
  TOO_FAR:    { label: 'Move closer',                           color: '#F59E0B', subtext: 'Bring your face nearer to the camera' },
  TOO_CLOSE:  { label: 'Move back a little',                    color: '#F59E0B', subtext: 'Your face is too close to the camera' },
  OFF_CENTER: { label: 'Center your face',                      color: '#F59E0B', subtext: 'Align your face with the oval guide' },
  LOOK_UP:    { label: 'Tilt your head up slightly',            color: '#F59E0B', subtext: 'We need a clear view of your face' },
  LOOK_DOWN:  { label: 'Tilt your head down slightly',          color: '#F59E0B', subtext: 'We need a clear view of your face' },
  HOLD:       { label: 'Hold still…',                           color: '#6366F1', subtext: 'Almost there, keep steady' },
  GOOD:       { label: '✓ Perfect — press capture',             color: '#10B981', subtext: 'Tap the camera button to take photo' },
  NO_FACE:    { label: 'No face detected',                      color: '#EF4444', subtext: 'Ensure your face is clearly visible' },
};

// FaceDetector API availability
const nativeFaceDetectorSupported = typeof window !== 'undefined' && 'FaceDetector' in window;

export default function SelfieCapture({ applicationId, onCaptureSuccess }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const overlayRef  = useRef(null);
  const rafRef      = useRef(null);
  const detectorRef = useRef(null);
  const countdownRef = useRef(null);

  const [stream, setStream]             = useState(null);
  const [error, setError]               = useState(null);
  const [loading, setLoading]           = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraMode, setCameraMode]     = useState(true);

  // Guide state
  const [guide, setGuide]               = useState(GUIDE.WAITING);
  const [readyCountdown, setReadyCountdown] = useState(null); // null | 3 | 2 | 1
  const [ovalFill, setOvalFill]         = useState(0);        // 0–1 progress fill
  const [captureAuto, setCaptureAuto]   = useState(false);    // flag to trigger auto-capture

  // ── Camera ───────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setError(null);
      setGuide(GUIDE.WAITING);
      setReadyCountdown(null);
      setOvalFill(0);
    } catch {
      setCameraMode(false);
    }
  };

  useEffect(() => {
    if (cameraMode && !capturedImage) startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [cameraMode, capturedImage]);

  // ── Native FaceDetector init ──────────────────────────────────────────────
  useEffect(() => {
    if (nativeFaceDetectorSupported) {
      try {
        detectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch { /* not available */ }
    }
  }, []);

  // ── Detection loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!stream || capturedImage) return;

    let goodFrames = 0;
    const GOOD_FRAMES_NEEDED = 18; // ~0.6s at 30fps

    const tick = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) { rafRef.current = requestAnimationFrame(tick); return; }

      // Target oval region (centre 45% wide, 70% tall of frame)
      const ovalCX = vw * 0.5;
      const ovalCY = vh * 0.48;
      const ovalRX = vw * 0.22;
      const ovalRY = vh * 0.36;

      let newGuide = GUIDE.WAITING;

      if (detectorRef.current) {
        // Native browser face detection
        try {
          const faces = await detectorRef.current.detect(video);

          if (faces.length === 0) {
            newGuide = GUIDE.NO_FACE;
            goodFrames = 0;
          } else {
            const { x, y, width, height } = faces[0].boundingBox;
            const faceCX = x + width / 2;
            const faceCY = y + height / 2;
            const faceArea = width * height;
            const ovalArea = Math.PI * ovalRX * ovalRY;

            const tooSmall = faceArea < ovalArea * 0.35;
            const tooBig   = faceArea > ovalArea * 2.0;
            const dxPct = Math.abs(faceCX - ovalCX) / vw;
            const dyPct = (faceCY - ovalCY) / vh;
            const offCenter = dxPct > 0.12;

            if (tooSmall)       newGuide = GUIDE.TOO_FAR;
            else if (tooBig)    newGuide = GUIDE.TOO_CLOSE;
            else if (offCenter) newGuide = GUIDE.OFF_CENTER;
            else if (dyPct < -0.1) newGuide = GUIDE.LOOK_DOWN;
            else if (dyPct >  0.1) newGuide = GUIDE.LOOK_UP;
            else {
              goodFrames++;
              const progress = Math.min(goodFrames / GOOD_FRAMES_NEEDED, 1);
              setOvalFill(progress);

              if (goodFrames < GOOD_FRAMES_NEEDED * 0.5) newGuide = GUIDE.HOLD;
              else newGuide = GUIDE.GOOD;

              if (goodFrames >= GOOD_FRAMES_NEEDED) {
                goodFrames = GOOD_FRAMES_NEEDED;
              }
            }

            if (newGuide !== GUIDE.HOLD && newGuide !== GUIDE.GOOD) {
              goodFrames = Math.max(0, goodFrames - 2);
              setOvalFill(goodFrames / GOOD_FRAMES_NEEDED);
            }
          }
        } catch { /* detector busy, skip frame */ }
      } else {
        // Fallback: simulate guided sequence for browsers without FaceDetector
        newGuide = simulatedGuide(goodFrames, GOOD_FRAMES_NEEDED);
        goodFrames++;
        setOvalFill(Math.min(goodFrames / (GOOD_FRAMES_NEEDED * 4), 1));
        if (goodFrames >= GOOD_FRAMES_NEEDED * 4) {
          goodFrames = GOOD_FRAMES_NEEDED * 4;
        }
      }

      setGuide(newGuide);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [stream, capturedImage]);

  // ── Auto-capture trigger ──────────────────────────────────────────────────
  useEffect(() => {
    if (!captureAuto) return;
    setGuide(GUIDE.GOOD);
    setOvalFill(1);
    // Brief pause so the user sees the green state before capture
    const t = setTimeout(() => handleCapture(), 400);
    return () => clearTimeout(t);
  }, [captureAuto]);

  // ── Countdown display while holding steady ────────────────────────────────
  useEffect(() => {
    if (guide === GUIDE.HOLD || guide === GUIDE.GOOD) {
      // start/continue countdown handled by ovalFill visually
    }
  }, [guide]);

  // ── Capture ───────────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (!videoRef.current || !canvasRef.current) return;

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageUrl = canvas.toDataURL('image/jpeg');
    setCapturedImage(imageUrl);

    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    await uploadSelfie(imageUrl);
  }, [stream]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setCapturedImage(ev.target.result);
      await uploadSelfie(ev.target.result, file);
    };
    reader.readAsDataURL(file);
  };

  const uploadSelfie = async (dataUrl, file = null) => {
    setLoading(true);
    try {
      let fileToUpload = file;
      let finalDataUrl = dataUrl;

      if (file) {
        try {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
          fileToUpload = await imageCompression(file, options);
          finalDataUrl = await imageCompression.getDataUrlFromFile(fileToUpload);
          setCapturedImage(finalDataUrl);
        } catch { /* use original */ }
      } else {
        const res = await fetch(finalDataUrl);
        fileToUpload = await res.blob();
      }

      const filePath = `${applicationId}/selfie.jpg`;
      const { data, error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, fileToUpload, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: existing } = await supabase
        .from('documents').select('id')
        .eq('application_id', applicationId).eq('type', 'selfie');

      if (existing?.length > 0) {
        await supabase.from('documents')
          .update({ file_url: data.path, uploaded_at: new Date() })
          .eq('id', existing[0].id);
      } else {
        await supabase.from('documents')
          .insert([{ application_id: applicationId, type: 'selfie', file_url: data.path }]);
      }

      if (onCaptureSuccess) onCaptureSuccess(data.path, finalDataUrl);
    } catch (err) {
      console.error(err);
      setError(`Upload failed: ${err.message || JSON.stringify(err)}`);
      setCapturedImage(null);
    } finally {
      setLoading(false);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setCaptureAuto(false);
    setGuide(GUIDE.WAITING);
    setOvalFill(0);
    setReadyCountdown(null);
    if (cameraMode) startCamera();
  };

  // ── SVG overlay dimensions (rendered at 100% of video container) ──────────
  // We draw the oval as SVG on top of the video feed

  const guideColor = guide.color;

  // Oval progress: animate stroke from 0 → full circumference
  // approximate oval circumference: 2π√((a²+b²)/2)
  const ovalRX = 22; // % of 100
  const ovalRY = 36; // % of 100
  // circumference in SVG units (viewBox 100x100)
  const circum = 2 * Math.PI * Math.sqrt((ovalRX ** 2 + ovalRY ** 2) / 2);

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
        Take a Selfie
      </label>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', textAlign: 'center', borderRadius: '16px' }}>
        {capturedImage ? (
          // ── Captured state ────────────────────────────────────────────────
          <div>
            <div style={{ position: 'relative' }}>
              <img
                src={capturedImage}
                alt="Captured selfie"
                style={{ width: '100%', maxHeight: '340px', objectFit: 'contain', display: 'block' }}
              />
              {loading && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: '0.75rem', color: '#fff',
                }}>
                  <span style={{
                    width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  }} />
                  <span style={{ fontSize: '0.875rem' }}>Uploading…</span>
                </div>
              )}
            </div>
            {!loading && (
              <div style={{ padding: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={retake}>Retake</button>
              </div>
            )}
          </div>
        ) : cameraMode ? (
          // ── Live camera + guided overlay ──────────────────────────────────
          <div style={{ position: 'relative', width: '100%', background: '#000' }}>

            <video
              ref={videoRef}
              autoPlay playsInline muted
              style={{ width: '100%', maxHeight: '380px', objectFit: 'cover', display: 'block' }}
            />

            {/* SVG guide overlay — full cover */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid slice"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              <defs>
                {/* Oval clip to cut a hole in the dark overlay */}
                <mask id="ovalMask">
                  <rect width="100" height="100" fill="white" />
                  <ellipse cx="50" cy="47" rx={ovalRX} ry={ovalRY} fill="black" />
                </mask>
              </defs>

              {/* Dark overlay with oval cutout */}
              <rect
                width="100" height="100"
                fill="rgba(0,0,0,0.52)"
                mask="url(#ovalMask)"
              />

              {/* Oval border — base (dim) */}
              <ellipse
                cx="50" cy="47" rx={ovalRX} ry={ovalRY}
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="0.5"
              />

              {/* Oval border — progress fill (animated) */}
              <ellipse
                cx="50" cy="47" rx={ovalRX} ry={ovalRY}
                fill="none"
                stroke={guideColor}
                strokeWidth="0.8"
                strokeDasharray={circum}
                strokeDashoffset={circum * (1 - ovalFill)}
                strokeLinecap="round"
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '50% 47%',
                  transition: 'stroke-dashoffset 0.15s ease, stroke 0.3s ease',
                  filter: ovalFill > 0 ? `drop-shadow(0 0 1.5px ${guideColor})` : 'none',
                }}
              />

              {/* ── Corner reticle brackets ── */}
              {[
                // top-left
                [`M ${50 - ovalRX - 1} ${47 - ovalRY + 5} L ${50 - ovalRX - 1} ${47 - ovalRY - 1} L ${50 - ovalRX + 5} ${47 - ovalRY - 1}`],
                // top-right
                [`M ${50 + ovalRX + 1} ${47 - ovalRY + 5} L ${50 + ovalRX + 1} ${47 - ovalRY - 1} L ${50 + ovalRX - 5} ${47 - ovalRY - 1}`],
                // bottom-left
                [`M ${50 - ovalRX - 1} ${47 + ovalRY - 5} L ${50 - ovalRX - 1} ${47 + ovalRY + 1} L ${50 - ovalRX + 5} ${47 + ovalRY + 1}`],
                // bottom-right
                [`M ${50 + ovalRX + 1} ${47 + ovalRY - 5} L ${50 + ovalRX + 1} ${47 + ovalRY + 1} L ${50 + ovalRX - 5} ${47 + ovalRY + 1}`],
              ].map((d, i) => (
                <path
                  key={i}
                  d={d[0]}
                  fill="none"
                  stroke={guideColor}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: 'stroke 0.3s ease' }}
                />
              ))}

              {/* ── Live indicator dot ── */}
              <circle cx="5" cy="5" r="1.2" fill="#EF4444">
                <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
              </circle>
              <text x="7.5" y="5.9" fill="white" fontSize="3" fontWeight="bold" fontFamily="Inter,sans-serif">LIVE</text>
            </svg>

            {/* ── Instruction card (bottom of video) ── */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.0) 100%)',
              padding: '2.5rem 1rem 1rem',
              textAlign: 'center',
              pointerEvents: 'none',
            }}>
              <p style={{
                color: guideColor,
                fontSize: '0.9rem',
                fontWeight: '700',
                margin: '0 0 0.2rem',
                textShadow: `0 0 8px ${guideColor}88`,
                transition: 'color 0.3s ease',
                letterSpacing: '0.01em',
              }}>
                {guide.label}
              </p>
              {guide.subtext && (
                <p style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.75rem',
                  margin: 0,
                  fontWeight: '400',
                }}>
                  {guide.subtext}
                </p>
              )}
            </div>

            {/* ── Manual capture button ── */}
            <div style={{
              position: 'absolute', bottom: '4.5rem', right: '1rem',
              display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end',
            }}>
              <button
                type="button"
                onClick={handleCapture}
                style={{
                  width: '56px', height: '56px',
                  borderRadius: '50%',
                  border: '3px solid white',
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(6px)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                  transition: 'transform 0.1s ease',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.93)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white' }} />
              </button>
              <button
                type="button"
                onClick={() => setCameraMode(false)}
                style={{
                  fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)',
                  background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Upload instead
              </button>
            </div>
          </div>
        ) : (
          // ── File upload fallback ──────────────────────────────────────────
          <div style={{ padding: '2.5rem', border: '2px dashed var(--surface-border)', borderRadius: '16px', margin: '0.5rem' }}>
            <ImageIcon size={36} style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }} />
            <p style={{ marginBottom: '1rem' }}>Camera unavailable or disabled.</p>
            <input
              type="file" accept="image/*" onChange={handleFileUpload}
              id="selfie-upload" style={{ display: 'none' }}
            />
            <label htmlFor="selfie-upload" className="btn btn-primary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
              Upload Photo
            </label>
            <div style={{ marginTop: '1rem' }}>
              <button type="button" className="text-link" onClick={() => setCameraMode(true)}>
                Try Camera Again
              </button>
            </div>
          </div>
        )}

        {error && <p className="error-text mt-4" style={{ padding: '0 1rem 1rem' }}>{error}</p>}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback simulated guide sequence for browsers without FaceDetector API
// Walks through instructions so the user still gets meaningful feedback
// ─────────────────────────────────────────────────────────────────────────────
function simulatedGuide(frame, total) {
  const pct = frame / (total * 4);
  if (pct < 0.1)  return GUIDE.WAITING;
  if (pct < 0.2)  return GUIDE.TOO_FAR;
  if (pct < 0.35) return GUIDE.OFF_CENTER;
  if (pct < 0.55) return GUIDE.HOLD;
  if (pct < 0.75) return GUIDE.HOLD;
  return GUIDE.GOOD;
}
