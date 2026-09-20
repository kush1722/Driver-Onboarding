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
  TOO_DARK:   { label: '⚠ Too dark — improve your lighting',   color: '#F59E0B', subtext: 'Face a light source. Avoid windows or lights behind you' },
  TOO_BRIGHT: { label: '⚠ Too much glare or brightness',       color: '#F59E0B', subtext: 'Move away from direct light or a bright window' },
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
  const samplerRef   = useRef(null); // offscreen canvas for brightness sampling

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

  // On mount, check if a selfie already exists
  useEffect(() => {
    if (!applicationId) return;
    const loadExisting = async () => {
      const { data: docRecord } = await supabase
        .from('documents')
        .select('file_url')
        .eq('application_id', applicationId)
        .eq('type', 'selfie')
        .single();

      if (!docRecord?.file_url) return;

      const { data: urlData } = await supabase.storage
        .from('driver-documents')
        .createSignedUrl(docRecord.file_url, 300);
      if (urlData?.signedUrl) {
        setCapturedImage(urlData.signedUrl);
        setCameraMode(false);
        if (onCaptureSuccess) onCaptureSuccess(docRecord.file_url, urlData.signedUrl, true);
      }
    };
    loadExisting();
  }, [applicationId]);

  // ── Native FaceDetector init + brightness sampler canvas ─────────────────
  useEffect(() => {
    if (nativeFaceDetectorSupported) {
      try {
        detectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch { /* not available */ }
    }
    // Create a tiny offscreen canvas used to sample frame brightness every tick.
    // Using willReadFrequently so the browser can optimise repeated getImageData calls.
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    samplerRef.current = c;
  }, []);

  // Samples the perceived luminance of the center of the video frame (0–255).
  // A score below ~45 = too dark; above ~215 = too bright / blown out.
  const sampleBrightness = (video) => {
    try {
      const c = samplerRef.current;
      if (!c || !video.videoWidth) return 128;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      // Sample the centre third of the frame where the face should be
      const vw = video.videoWidth, vh = video.videoHeight;
      ctx.drawImage(video, vw * 0.25, vh * 0.15, vw * 0.5, vh * 0.7, 0, 0, 32, 32);
      const px = ctx.getImageData(0, 0, 32, 32).data;
      let lum = 0;
      for (let i = 0; i < px.length; i += 4) {
        lum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      }
      return lum / (px.length / 4);
    } catch { return 128; }
  };

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
              // Position is good — now verify lighting before saying Perfect
              const lum = sampleBrightness(video);
              if (lum < 45) {
                newGuide = GUIDE.TOO_DARK;
                goodFrames = Math.max(0, goodFrames - 2);
              } else if (lum > 215) {
                newGuide = GUIDE.TOO_BRIGHT;
                goodFrames = Math.max(0, goodFrames - 2);
              } else {
                goodFrames++;
                const progress = Math.min(goodFrames / GOOD_FRAMES_NEEDED, 1);
                setOvalFill(progress);
                if (goodFrames < GOOD_FRAMES_NEEDED * 0.5) newGuide = GUIDE.HOLD;
                else newGuide = GUIDE.GOOD;
                if (goodFrames >= GOOD_FRAMES_NEEDED) goodFrames = GOOD_FRAMES_NEEDED;
              }
            }

            if (newGuide !== GUIDE.HOLD && newGuide !== GUIDE.GOOD) {
              goodFrames = Math.max(0, goodFrames - 2);
              setOvalFill(goodFrames / GOOD_FRAMES_NEEDED);
            }
          }
        } catch { /* detector busy, skip frame */ }
      } else {
        // Fallback: FaceDetector API not available in this browser.
        // We cannot detect face position, but we CAN check lighting quality.
        // Never auto-say "Perfect" — show guidance and let the user manually capture.
        const lum = sampleBrightness(video);
        if (lum < 45)        newGuide = GUIDE.TOO_DARK;
        else if (lum > 215)  newGuide = GUIDE.TOO_BRIGHT;
        else                 newGuide = GUIDE.WAITING;
        setOvalFill(0); // no progress fill in fallback mode
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
  const handleCapture = async () => {
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
  };

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
          .update({ file_url: data.path, created_at: new Date() })
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
          <>
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

              </svg>

              {/* ── Live indicator ── */}
              <div style={{
                position: 'absolute', top: '1rem', left: '1rem',
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px',
                zIndex: 10, whiteSpace: 'nowrap'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
                <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px' }}>LIVE</span>
              </div>

              {/* ── Instruction card (positioned above the button) ── */}
              <div style={{
                position: 'absolute', bottom: '6.5rem', left: 0, right: 0,
                textAlign: 'center',
                pointerEvents: 'none', zIndex: 10
              }}>
                <p style={{
                  color: guideColor,
                  fontSize: '1rem',
                  fontWeight: '700',
                  margin: '0 0 0.2rem',
                  textShadow: `0px 2px 4px rgba(0,0,0,0.8), 0 0 8px ${guideColor}88`,
                  transition: 'color 0.3s ease',
                  letterSpacing: '0.01em',
                }}>
                  {guide.label}
                </p>
                {guide.subtext && (
                  <p style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '0.8rem',
                    margin: 0,
                    fontWeight: '500',
                    textShadow: '0px 1px 3px rgba(0,0,0,0.8)'
                  }}>
                    {guide.subtext}
                  </p>
                )}
              </div>

              {/* ── Capture Button ── */}
              <div style={{
                position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
                display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 20
              }}>
                <button
                  type="button"
                  onClick={handleCapture}
                  style={{
                    width: '64px', height: '64px',
                    borderRadius: '50%',
                    border: '3px solid white',
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(6px)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    transition: 'transform 0.1s ease',
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.93)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'white' }} />
                </button>
              </div>
            </div>
            <div style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--surface-border)' }}>
              <button
                type="button"
                onClick={() => setCameraMode(false)}
                className="btn btn-secondary"
                style={{ width: '100%', maxWidth: '300px', fontSize: '0.9rem' }}
              >
                Upload Photo Instead
              </button>
            </div>
          </>
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
