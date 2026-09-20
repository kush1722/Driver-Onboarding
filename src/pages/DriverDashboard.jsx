import React, { useEffect, useState } from 'react';
import { CheckCircle, Power, ArrowRight, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function DriverDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [driver, setDriver]           = useState(null);
  const [vehicle, setVehicle]         = useState(null);
  const [isOnline, setIsOnline]       = useState(false);
  const [noApplication, setNoApplication] = useState(false); // driver exists but never submitted application

  // ── Strict magic link enforcement ─────────────────────────────────────────
  // If the URL contains an otp_expired / access_denied error (i.e. the magic
  // link was clicked a second time), sign out the existing session immediately
  // and redirect to sign-in with an explanation message.
  // This ensures a used magic link can NEVER piggyback on an existing session.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('error_code=otp_expired') || hash.includes('error=access_denied')) {
      supabase.auth.signOut().then(() => {
        navigate('/sign-in?reason=link_expired', { replace: true });
      });
    }
  }, [navigate]);

  // ── Load driver + application data ────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const { data: d } = await supabase
          .from('drivers')
          .select('*')
          .eq('auth_id', user.id)
          .single();

        if (!d) return;
        setDriver(d);

        // Check for ANY application (not just approved) to detect incomplete onboarding
        const { data: anyApp, error: appErr } = await supabase
          .from('applications')
          .select('id, status')
          .eq('driver_id', d.id)
          .limit(1)
          .maybeSingle();

        if (appErr) throw appErr;

        if (!anyApp) {
          // Driver created an account and entered basic details but never submitted an application
          setNoApplication(true);
          return;
        }

        // Fetch vehicle only for approved applications
        if (anyApp.status === 'approved') {
          const { data: v } = await supabase
            .from('vehicles')
            .select('*')
            .eq('application_id', anyApp.id)
            .single();
          setVehicle(v);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [user]);

  if (!driver) return <div className="auth-container">Loading...</div>;

  // ── Incomplete onboarding state ───────────────────────────────────────────
  if (noApplication) {
    return (
      <div className="container" style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '4rem' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
          }}>
            <RotateCcw size={24} color="var(--warning-color)" />
          </div>

          <h2 style={{ marginBottom: '0.5rem' }}>
            Welcome back, {driver.full_name?.split(' ')[0]}
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '2rem' }}>
            It looks like you started your driver registration but didn't finish it last time.
            Your account is ready — you just need to complete your application.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/onboarding')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              Continue Registration <ArrowRight size={16} />
            </button>
            <button
              className="btn btn-secondary"
              onClick={signOut}
              style={{ color: 'var(--text-secondary)' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Full dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="container" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Welcome back, {driver.full_name?.split(' ')[0]}</h2>
        <button onClick={signOut} className="btn btn-secondary" style={{ marginLeft: 'auto' }}>Sign out</button>
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
          style={{ padding: '1rem 2rem', fontSize: '1.2rem', gap: '0.5rem', flex: '1 1 auto', display: 'flex', justifyContent: 'center' }}
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
