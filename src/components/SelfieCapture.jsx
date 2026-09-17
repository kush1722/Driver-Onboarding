import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Image as ImageIcon, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import imageCompression from 'browser-image-compression';

export default function SelfieCapture({ applicationId, onCaptureSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraMode, setCameraMode] = useState(true);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.warn("Camera access denied or unavailable", err);
      setCameraMode(false);
    }
  };

  useEffect(() => {
    if (cameraMode && !capturedImage) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraMode, capturedImage]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageUrl = canvas.toDataURL('image/jpeg');
    setCapturedImage(imageUrl);
    
    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    await uploadSelfie(imageUrl);
  }, [stream]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      setCapturedImage(e.target.result);
      await uploadSelfie(e.target.result, file);
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
          setCapturedImage(finalDataUrl); // Update preview to compressed version
        } catch (e) {
          console.warn("Compression failed", e);
        }
      } else {
        // Convert dataUrl to Blob
        const res = await fetch(finalDataUrl);
        fileToUpload = await res.blob();
      }

      const fileName = `selfie.jpg`;
      const filePath = `${applicationId}/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, fileToUpload, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const fileUrl = data.path;

      // Upsert document record
      const { data: existingDocs } = await supabase
        .from('documents')
        .select('id')
        .eq('application_id', applicationId)
        .eq('type', 'selfie');
        
      if (existingDocs && existingDocs.length > 0) {
        await supabase
          .from('documents')
          .update({ file_url: fileUrl, uploaded_at: new Date() })
          .eq('id', existingDocs[0].id);
      } else {
        await supabase
          .from('documents')
          .insert([{
            application_id: applicationId,
            type: 'selfie',
            file_url: fileUrl
          }]);
      }

      if (onCaptureSuccess) {
        // We pass the compressed dataUrl for immediate display and face matching
        onCaptureSuccess(fileUrl, finalDataUrl);
      }
    } catch (err) {
      console.error(err);
      setError(`Upload failed: ${err.message || JSON.stringify(err)}`);
      // Send the error to the backend so the agent can read it!
      fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debugError: err.message || JSON.stringify(err) })
      }).catch(() => {});
      
      setCapturedImage(null);
    } finally {
      setLoading(false);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    if (cameraMode) {
      startCamera();
    }
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
        Take a Selfie
      </label>
      
      <div className="glass-panel" style={{ padding: '1rem', overflow: 'hidden', textAlign: 'center' }}>
        {capturedImage ? (
          <div>
            <img src={capturedImage} alt="Captured selfie" style={{ width: '100%', borderRadius: '8px', maxHeight: '300px', objectFit: 'contain' }} />
            <div style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={retake} disabled={loading}>
                Retake
              </button>
            </div>
          </div>
        ) : cameraMode ? (
          <div>
            <div style={{ position: 'relative', display: 'inline-block', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', background: '#000', display: 'block' }} 
              />
              {/* Guide overlay */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60%',
                height: '80%',
                border: '2px dashed rgba(255,255,255,0.7)',
                borderRadius: '50%',
                pointerEvents: 'none'
              }}></div>
              <p style={{ position: 'absolute', bottom: '1rem', left: '0', width: '100%', color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.8)', fontSize: '0.875rem', margin: 0, pointerEvents: 'none' }}>
                Center your face in the oval
              </p>
            </div>
            
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={handleCapture}>
                <Camera size={18} /> Capture
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setCameraMode(false)}>
                Switch to File Upload
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '2rem', border: '2px dashed var(--surface-border)', borderRadius: '8px' }}>
            <ImageIcon size={32} style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }} />
            <p style={{ marginBottom: '1rem' }}>Camera unavailable or disabled.</p>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload} 
              id="selfie-upload" 
              style={{ display: 'none' }} 
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
        {error && <p className="error-text mt-4">{error}</p>}
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
