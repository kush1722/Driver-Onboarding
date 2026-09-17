import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DocumentUploadSlot from '../../components/DocumentUploadSlot';

export default function StepDocuments({ applicationId }) {
  const navigate = useNavigate();
  const [frontUploaded, setFrontUploaded] = useState(false);
  const [backUploaded, setBackUploaded] = useState(false);

  const [loadingBypass, setLoadingBypass] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/onboarding/review');
  };

  const handleDevBypass = async () => {
    setLoadingBypass(true);
    // Mock the database entries
    try {
      const { supabase } = await import('../../lib/supabaseClient');
      await supabase.from('documents').upsert([
        { application_id: applicationId, type: 'license_front', file_url: 'mock/license_front.jpg' },
        { application_id: applicationId, type: 'license_back', file_url: 'mock/license_back.jpg' }
      ]);
      setFrontUploaded(true);
      setBackUploaded(true);
      // Auto-navigate to the next step to prevent confusion
      navigate('/onboarding/review');
    } catch (err) {
      console.error(err);
    }
    setLoadingBypass(false);
  };

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Driver's License</h2>
      <p className="subtitle" style={{ marginBottom: '2rem' }}>Upload photos of your valid driver's license.</p>

      <form onSubmit={handleSubmit}>
        <DocumentUploadSlot 
          applicationId={applicationId} 
          documentType="license_front" 
          label="License Front" 
          onUploadSuccess={() => setFrontUploaded(true)}
        />
        
        <div style={{ marginTop: '2rem' }}>
          <DocumentUploadSlot 
            applicationId={applicationId} 
            documentType="license_back" 
            label="License Back" 
            onUploadSuccess={() => setBackUploaded(true)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
          <button 
            type="button" 
            className="text-link" 
            style={{ fontSize: '0.875rem' }} 
            onClick={handleDevBypass}
            disabled={loadingBypass}
          >
            {loadingBypass ? 'Bypassing...' : '🛠 Developer Bypass (Mock Upload)'}
          </button>
          
          <button type="submit" className="btn btn-primary" disabled={!frontUploaded || !backUploaded}>
            Next Step
          </button>
        </div>
      </form>
    </div>
  );
}
