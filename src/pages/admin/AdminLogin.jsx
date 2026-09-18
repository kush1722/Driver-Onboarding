import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('email'); // email or otp
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const { isAdmin, loading, signOut, refreshAdminStatus } = useAuth();

  // If already authenticated as admin, skip login page
  useEffect(() => {
    if (!loading && isAdmin) navigate('/admin', { replace: true });
  }, [loading, isAdmin, navigate]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split('');
      for (let i = 0; i < pasted.length; i++) if (index + i < 6) newOtp[index + i] = pasted[i];
      setOtp(newOtp);
    } else {
      newOtp[index] = value;
      setOtp(newOtp);
      if (value !== '' && index < 5) inputRefs.current[index + 1]?.focus();
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError(null);
    const code = otp.join('');
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (verifyErr) throw verifyErr;

      // Check admin status
      let { data: adminCheck } = await supabase
        .from('admins')
        .select('id')
        .eq('auth_id', data.user.id)
        .single();

      // Auto-approve if they have the secret invite code
      if (!adminCheck && inviteCode === 'TESTER2026') {
        const res = await fetch('/api/create-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.user.id, inviteCode })
        });
        if (res.ok) {
          adminCheck = true;
        }
      }

      if (!adminCheck) {
        await signOut();
        throw new Error("Access denied. Not an admin or invalid invite code.");
      }

      await refreshAdminStatus();
      window.location.href = '/admin';
    } catch (err) {
      setError(err.message);
      if (err.message.includes('Access denied')) {
        setStep('email');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 'otp' && otp.join('').length === 6 && !loading) {
      verifyOtp();
    }
  }, [otp, step]);

  return (
    <div className="auth-container">
      <div className="glass-panel auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--accent-color)' }}>
          <ShieldAlert size={48} />
        </div>
        <h1>Admin Portal</h1>
        <p className="subtitle" style={{ marginBottom: '2rem' }}>
          {step === 'email' ? 'Sign in to review driver applications.' : `Code sent to ${email}`}
        </p>

        {step === 'email' ? (
          <form onSubmit={handleSendOtp}>
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <label>Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Invite Code (Optional)</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter secret code to get access"
              />
            </div>
            {error && <p className="error-text mb-4">{error}</p>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading || !email}>
              {loading ? 'Sending...' : 'Send One-Time Code'}
            </button>
          </form>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  disabled={loading}
                  style={{ width: '3rem', height: '3.5rem', textAlign: 'center', fontSize: '1.5rem', fontWeight: '600', padding: '0' }}
                />
              ))}
            </div>
            {error && <p className="error-text mb-4">{error}</p>}
            <button onClick={() => setStep('email')} className="text-link" style={{ fontSize: '0.875rem' }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
