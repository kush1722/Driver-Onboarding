import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function OtpVerify() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;
  const fullName = location.state?.fullName;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) {
      navigate('/signin');
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [email, navigate]);

  const handleChange = (index, value) => {
    if (isNaN(value)) return;
    
    const newOtp = [...otp];
    // Allow pasting
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split('');
      for (let i = 0; i < pasted.length; i++) {
        if (index + i < 6) newOtp[index + i] = pasted[i];
      }
      setOtp(newOtp);
      // Focus last filled
      const focusIndex = Math.min(index + pasted.length, 5);
      inputRefs.current[focusIndex]?.focus();
    } else {
      newOtp[index] = value;
      setOtp(newOtp);
      // Auto-advance
      if (value !== '' && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (codeStr) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: codeStr,
        type: 'email',
      });

      if (verifyError) throw verifyError;

      const user = data?.user;
      if (user) {
        // Check if driver row exists, if not create it
        const { data: driver } = await supabase
          .from('drivers')
          .select('id')
          .eq('auth_id', user.id)
          .single();

        if (!driver) {
          await supabase.from('drivers').insert([
            { auth_id: user.id, email, full_name: fullName || null }
          ]);
        }
        
        // Navigation will be handled by App.jsx routing based on session
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentCode = otp.join('');
    if (currentCode.length === 6 && !loading) {
      verifyCode(currentCode);
    }
  }, [otp]);

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setLoading(true);
    try {
      await supabase.auth.signInWithOtp({ email });
      setCountdown(300);
      setError(null);
    } catch (err) {
      setError('Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-card">
        <h1>Check your email</h1>
        <p className="subtitle">
          We sent a 6-digit verification code to<br/>
          <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={loading}
              style={{
                width: '3rem',
                height: '3.5rem',
                textAlign: 'center',
                fontSize: '1.5rem',
                fontWeight: '600',
                padding: '0',
                borderRadius: '8px'
              }}
            />
          ))}
        </div>

        {error && <p className="error-text mb-4">{error}</p>}

        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {countdown > 0 ? (
            <p>Resend code in {formatTime(countdown)}</p>
          ) : (
            <p>
              Didn't receive it?{' '}
              <button 
                type="button" 
                className="text-link" 
                onClick={handleResend}
                disabled={loading}
              >
                Resend code
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
