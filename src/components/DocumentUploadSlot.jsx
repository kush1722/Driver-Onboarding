import React, { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UploadCloud, FileText, CheckCircle, XCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function DocumentUploadSlot({ 
  applicationId, 
  documentType, 
  label, 
  onUploadSuccess,
  accept = "image/*,application/pdf"
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    
    let fileToUpload = file;
    try {
      if (file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 1, // Compress to max 1MB
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        fileToUpload = await imageCompression(file, options);
      }
    } catch (err) {
      console.warn("Compression failed, using original", err);
    }

    // Create a base64 string of the file to send to OCR/Face Match APIs
    // We previously used a canvas to downscale this, but the resulting image 
    // was too low-quality for the AI to reliably extract small faces from ID cards.
    // Since fileToUpload is already compressed to 1MB max by imageCompression,
    // its base64 representation will be ~1.3MB, safely below Vercel's 4.5MB limit.
    let dataUrlPreview = null;
    if (fileToUpload.type.startsWith('image/')) {
      dataUrlPreview = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.readAsDataURL(fileToUpload);
      });
      setPreviewUrl(dataUrlPreview);
    } else {
      setPreviewUrl(null);
    }

    try {
      const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
      const fileName = `${documentType}.${fileExt}`;
      const filePath = `${applicationId}/${fileName}`;

      // Upload to storage
      const { data, error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, fileToUpload, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL (assuming it's a private bucket, we need a signed URL for display, 
      // but for simplicity and since the prompt says "private bucket", we should get a signed URL.
      // Wait, the prompt says "create a bucket named driver-documents, set to private".
      // Then it adds read/upload policies. We can use createSignedUrl or just store the path and fetch it later.
      // Let's store the full file path in the DB.)
      
      const fileUrl = data.path; // e.g. "uuid/id_front.jpg"

      // Insert/Upsert into documents table
      // First check if a document of this type already exists for this app
      const { data: existingDocs } = await supabase
        .from('documents')
        .select('id')
        .eq('application_id', applicationId)
        .eq('type', documentType);
        
      if (existingDocs && existingDocs.length > 0) {
        // Update
        await supabase
          .from('documents')
          .update({ file_url: fileUrl, uploaded_at: new Date() })
          .eq('id', existingDocs[0].id);
      } else {
        // Insert
        await supabase
          .from('documents')
          .insert([{
            application_id: applicationId,
            type: documentType,
            file_url: fileUrl
          }]);
      }
      
      setUploadedUrl(fileUrl);
      if (onUploadSuccess) onUploadSuccess(fileUrl, dataUrlPreview);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to upload document');
      setPreviewUrl(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
        {label}
      </label>
      
      <div 
        onClick={() => !loading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${uploadedUrl ? 'var(--success-color)' : error ? 'var(--error-color)' : 'var(--surface-border)'}`,
          borderRadius: '8px',
          padding: '1.5rem',
          textAlign: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: 'var(--input-bg)',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '120px'
        }}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept={accept} 
          style={{ display: 'none' }} 
        />
        
        {loading ? (
          <div style={{ color: 'var(--text-secondary)' }}>Uploading...</div>
        ) : previewUrl ? (
          <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <img 
              src={previewUrl} 
              alt={label} 
              style={{ maxHeight: '150px', maxWidth: '100%', borderRadius: '4px' }} 
            />
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--bg-color)', borderRadius: '50%' }}>
              <CheckCircle color="var(--success-color)" />
            </div>
          </div>
        ) : uploadedUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--success-color)' }}>
            <FileText size={32} style={{ marginBottom: '0.5rem' }} />
            <span>Document Uploaded</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <UploadCloud size={32} style={{ marginBottom: '0.5rem' }} />
            <span>Click to upload {label}</span>
            <span style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Accepts Images and PDF</span>
          </div>
        )}
      </div>
      
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
