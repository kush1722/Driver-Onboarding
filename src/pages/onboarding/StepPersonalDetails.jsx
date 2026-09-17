import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function StepPersonalDetails({ applicationId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    phone: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  useEffect(() => {
    if (!applicationId) return;

    const fetchDriverDetails = async () => {
      try {
        const { data: app, error: appErr } = await supabase
          .from('applications')
          .select('driver_id')
          .eq('id', applicationId)
          .single();

        if (appErr) throw appErr;

        const { data: driver, error: driverErr } = await supabase
          .from('drivers')
          .select('*')
          .eq('id', app.driver_id)
          .single();

        if (driverErr) throw driverErr;

        if (driver) {
          setFormData({
            full_name: driver.full_name || '',
            date_of_birth: driver.date_of_birth || '',
            phone: driver.phone || '',
            address: driver.address || '',
            emergency_contact_name: driver.emergency_contact_name || '',
            emergency_contact_phone: driver.emergency_contact_phone || ''
          });
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load your details.");
      } finally {
        setLoading(false);
      }
    };

    fetchDriverDetails();
  }, [applicationId]);

  const handleChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Save-as-you-go logic could be implemented here with a debounce, 
    // but for simplicity and to avoid too many writes, we'll save on blur
  };

  const handleBlur = async (e) => {
    const { name, value } = e.target;
    if (!value) return; // Don't save empty fields unnecessarily on blur

    try {
      const { data: app } = await supabase.from('applications').select('driver_id').eq('id', applicationId).single();
      if (app) {
        await supabase
          .from('drivers')
          .update({ [name]: value })
          .eq('id', app.driver_id);
      }
    } catch (err) {
      console.error("Autosave failed", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // 1. Full Name
    if (formData.full_name.trim().length < 3) return setError("Full Name must be at least 3 characters.");
    
    // 2. Date of Birth (18+ check)
    const dob = new Date(formData.date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age < 18) return setError("You must be at least 18 years old to apply.");
    if (age > 100) return setError("Please enter a valid Date of Birth.");

    // 3. Phone Number
    const phoneRegex = /^[0-9+\-()\s]{8,20}$/;
    if (!phoneRegex.test(formData.phone)) return setError("Please enter a valid phone number (min 8 characters).");

    // 4. Home Address
    if (formData.address.trim().length < 10) return setError("Home Address must be at least 10 characters long.");

    // 5. Emergency Contact Name
    if (formData.emergency_contact_name.trim().length < 3) return setError("Emergency Contact Name must be at least 3 characters.");
    if (formData.full_name.trim().toLowerCase() === formData.emergency_contact_name.trim().toLowerCase()) {
      return setError("Emergency contact cannot be the same person as the applicant.");
    }

    // 6. Emergency Contact Phone
    if (!phoneRegex.test(formData.emergency_contact_phone)) return setError("Please enter a valid emergency contact phone number.");
    if (formData.phone.replace(/[^0-9]/g, '') === formData.emergency_contact_phone.replace(/[^0-9]/g, '')) {
      return setError("Emergency contact phone number cannot be the same as your own phone number.");
    }
    
    setSaving(true);
    
    try {
      const { data: app } = await supabase.from('applications').select('driver_id').eq('id', applicationId).single();
      if (!app) throw new Error("Application not found");

      const { error: updateErr } = await supabase
        .from('drivers')
        .update(formData)
        .eq('id', app.driver_id);

      if (updateErr) throw updateErr;
      
      // Go to next step
      navigate('/onboarding/identity');
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
      <h2 style={{ marginBottom: '0.5rem' }}>Personal Details</h2>
      <p className="subtitle" style={{ marginBottom: '2rem' }}>Tell us a bit about yourself.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name</label>
          <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} onBlur={handleBlur} required />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Date of Birth</label>
            <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} onBlur={handleBlur} required />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Phone Number</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} onBlur={handleBlur} required />
          </div>
        </div>

        <div className="form-group">
          <label>Home Address</label>
          <input type="text" name="address" value={formData.address} onChange={handleChange} onBlur={handleBlur} required />
        </div>

        <div style={{ marginTop: '2rem', marginBottom: '1.5rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Emergency Contact</h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Name</label>
              <input type="text" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange} onBlur={handleBlur} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Phone</label>
              <input type="tel" name="emergency_contact_phone" value={formData.emergency_contact_phone} onChange={handleChange} onBlur={handleBlur} required />
            </div>
          </div>
        </div>

        {error && <p className="error-text mb-4">{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Next Step'}
          </button>
        </div>
      </form>
    </div>
  );
}
