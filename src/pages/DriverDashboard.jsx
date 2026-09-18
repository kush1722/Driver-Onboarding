import React, { useEffect, useState } from 'react';
import { CheckCircle, Power } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function DriverDashboard() {
  const { user, signOut } = useAuth();
  const [driver, setDriver] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const { data: d } = await supabase.from('drivers').select('*').eq('auth_id', user.id).single();
        if (d) {
          setDriver(d);
          const { data: app } = await supabase
            .from('applications')
            .select('id, decided_at')
            .eq('driver_id', d.id)
            .eq('status', 'approved')
            .single();
            
          if (app) {
            const { data: v } = await supabase.from('vehicles').select('*').eq('application_id', app.id).single();
            setVehicle(v);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [user]);

  if (!driver) return <div className="auth-container">Loading...</div>;

  return (
    <div className="container" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Welcome back, {driver.full_name?.split(' ')[0]}</h2>
        <button onClick={signOut} className="btn btn-secondary">Sign out</button>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)', marginBottom: '0.5rem' }}>
            <CheckCircle size={20} />
            <span style={{ fontWeight: '600' }}>Verified Driver</span>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>You're all set to start taking rides.</p>
        </div>
        
        <button 
          className={`btn ${isOnline ? 'btn-secondary' : 'btn-primary'}`} 
          style={{ padding: '1rem 2rem', fontSize: '1.2rem', gap: '0.5rem' }}
          onClick={() => setIsOnline(!isOnline)}
        >
          <Power size={24} />
          {isOnline ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Your Vehicle</h3>
          {vehicle ? (
            <div style={{ display: 'grid', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>Make:</strong> {vehicle.make}</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Model:</strong> {vehicle.model}</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Plate:</strong> {vehicle.plate_number}</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{vehicle.type}</span></div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No vehicle details found.</p>
          )}
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Stats Summary</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Ride stats will appear here once you complete your first trip.</p>
        </div>
      </div>

    </div>
  );
}
