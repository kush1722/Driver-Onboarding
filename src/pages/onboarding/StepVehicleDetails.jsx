import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function StepVehicleDetails({ applicationId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    type: 'car',
    make: '',
    model: '',
    year: '',
    plate_number: '',
    color: ''
  });

  useEffect(() => {
    if (!applicationId) return;

    const fetchVehicleDetails = async () => {
      try {
        const { data: vehicle, error: vehicleErr } = await supabase
          .from('vehicles')
          .select('*')
          .eq('application_id', applicationId)
          .single();

        if (vehicleErr && vehicleErr.code !== 'PGRST116') throw vehicleErr;

        if (vehicle) {
          setFormData({
            type: vehicle.type || 'car',
            make: vehicle.make || '',
            model: vehicle.model || '',
            year: vehicle.year || '',
            plate_number: vehicle.plate_number || '',
            color: vehicle.color || ''
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicleDetails();
  }, [applicationId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = async (e) => {
    const { name, value } = e.target;
    if (!value) return;

    try {
      // Upsert logic
      const { data: existing } = await supabase
        .from('vehicles')
        .select('id')
        .eq('application_id', applicationId)
        .single();
        
      if (existing) {
        await supabase.from('vehicles').update({ [name]: value }).eq('id', existing.id);
      } else {
        // Just create an initial empty record with this field if needed, but it's easier to just rely on submit
        // or a full upsert.
        await supabase.from('vehicles').insert([{ application_id: applicationId, [name]: value }]);
      }
    } catch (err) {
      console.error("Autosave failed", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // 1. Make and Model
    if (formData.make.trim().length < 2) return setError("Make must be at least 2 characters.");
    if (formData.model.trim().length < 2) return setError("Model must be at least 2 characters.");

    // 2. Year
    const year = parseInt(formData.year, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1990 || year > currentYear + 1) {
      return setError(`Year must be between 1990 and ${currentYear + 1}.`);
    }

    // 3. Color
    if (formData.color.trim().length < 3) return setError("Color must be at least 3 characters.");

    // 4. Plate Number
    const plateRegex = /^[A-Za-z0-9\s]{4,15}$/;
    if (!plateRegex.test(formData.plate_number)) {
      return setError("Plate Number must be at least 4 characters and contain only letters, numbers, and spaces.");
    }

    setSaving(true);
    
    try {
      const { data: existing } = await supabase
        .from('vehicles')
        .select('id')
        .eq('application_id', applicationId)
        .single();
        
      if (existing) {
        await supabase.from('vehicles').update(formData).eq('id', existing.id);
      } else {
        await supabase.from('vehicles').insert([{ ...formData, application_id: applicationId }]);
      }

      navigate('/onboarding/documents');
    } catch (err) {
      console.error(err);
      setError("Failed to save vehicle details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Vehicle Details</h2>
      <p className="subtitle" style={{ marginBottom: '2rem' }}>Tell us about the vehicle you'll be driving.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Vehicle Type</label>
          <select name="type" value={formData.type} onChange={handleChange} onBlur={handleBlur} required>
            <option value="bike">Bike</option>
            <option value="car">Car</option>
            <option value="van">Van</option>
            <option value="truck">Truck</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Make</label>
            <select name="make" value={formData.make} onChange={handleChange} onBlur={handleBlur} required>
              <option value="" disabled>Select Make...</option>
              <option value="Toyota">Toyota</option>
              <option value="Honda">Honda</option>
              <option value="Ford">Ford</option>
              <option value="Nissan">Nissan</option>
              <option value="Chevrolet">Chevrolet</option>
              <option value="Hyundai">Hyundai</option>
              <option value="Kia">Kia</option>
              <option value="Mercedes-Benz">Mercedes-Benz</option>
              <option value="BMW">BMW</option>
              <option value="Audi">Audi</option>
              <option value="Volkswagen">Volkswagen</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Model</label>
            <input type="text" name="model" placeholder="e.g. Camry" value={formData.model} onChange={handleChange} onBlur={handleBlur} required />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Year</label>
            <input type="number" name="year" placeholder="YYYY" min="1990" max="2025" value={formData.year} onChange={handleChange} onBlur={handleBlur} required />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Color</label>
            <input type="text" name="color" placeholder="e.g. Silver" value={formData.color} onChange={handleChange} onBlur={handleBlur} required />
          </div>
        </div>

        <div className="form-group">
          <label>License Plate Number</label>
          <input type="text" name="plate_number" value={formData.plate_number} onChange={handleChange} onBlur={handleBlur} required style={{ textTransform: 'uppercase' }} />
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
