import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function OtpVerify() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialEmail = location.state?.email || '';
  const fullName = location.state?.fullName;
  
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const inputRefs = useRef([]);

  useEffect(() => {
    // We no longer kick them out if there's no email. 
    // They can manually enter it if they lost their session!
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [email, navigate]);

  const handleChange = (index, value) => {
    // Strip out any non-numeric characters (useful for mobile auto-fill)
    const cleanValue = value.replace(/[^0-9]/g, '');
    if (!cleanValue && value !== '') return; 
    
    const newOtp = [...otp];
    // Allow pasting or mobile autofill
    if (cleanValue.length > 1) {
      const pasted = cleanValue.slice(0, 8).split('');
      for (let i = 0; i < 8; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setOtp(newOtp);
      // Focus last filled
      const focusIndex = Math.min(pasted.length, 7);
      inputRefs.current[focusIndex]?.focus();
    } else {
      newOtp[index] = cleanValue;
      setOtp(newOtp);
      // Auto-advance
      if (cleanValue !== '' && index < 7) {
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
    if (!email) {
      return setError("Please enter your email address above first.");
    }
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
        
        // Force immediate navigation so the user never gets stuck!
        navigate('/');
      }
    } catch (err) {
      // Show the exact, specific error from Supabase
      setError(err.message || 'The code you entered is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentCode = otp.join('');
    if (currentCode.length === 8 && !loading) {
      verifyCode(currentCode);
    }
  }, [otp]);

  const handleResend = async () => {
    if (countdown > 0) return;
    if (!email) return setError("Please enter your email address to request a code.");
    
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
        
        {!initialEmail ? (
          <div className="form-group" style={{ textAlign: 'left', marginBottom: '2rem' }}>
            <label>Confirm your Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              style={{ width: '100%' }}
            />
          </div>
        ) : (
          <p className="subtitle">
            We sent an 8-digit verification code to<br/>
            <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
          </p>
        )}

        <div style={{ display: 'flex', gap: 'clamp(0.25rem, 1.5vw, 0.5rem)', justifyContent: 'center', marginBottom: '2rem' }}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={loading}
              style={{
                width: 'clamp(1.5rem, 10vw, 3rem)',
                height: 'clamp(2.5rem, 12vw, 3.5rem)',
                textAlign: 'center',
                fontSize: 'clamp(1.2rem, 5vw, 1.5rem)',
                fontWeight: '600',
                padding: '0',
                borderRadius: '8px'
              }}
            />
          ))}
        </div>

        {error && <p className="error-text mb-4">{error}</p>}

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', marginBottom: '1.5rem', height: '3rem', fontSize: '1.1rem' }}
          onClick={() => verifyCode(otp.join(''))}
          disabled={loading || otp.join('').length !== 8}
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>

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

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button 
            type="button" 
            className="text-link" 
            onClick={() => navigate('/signin')}
            style={{ color: 'var(--text-secondary)' }}
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
