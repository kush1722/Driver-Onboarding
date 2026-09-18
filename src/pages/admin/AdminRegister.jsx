import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ShieldCheck, Mail, ArrowRight } from 'lucide-react';

/**
 * Secret admin registration page.
 * Only accessible via /admin/register?token=<ADMIN_INVITE_CODE>
 * The token is validated server-side — this page silently rejects wrong tokens.
 *
 * Flow:
 *  1. User visits link with correct token in query string
 *  2. Enters their email → receives a Supabase OTP
 *  3. Enters OTP → account verified → /api/create-admin called with token
 *  4. Admin record inserted → redirected to /admin/login
 */
export default function AdminRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'success'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRefs = useRef([]);

  // Silently redirect if no token provided — don't reveal this page exists
  useEffect(() => {
    if (!token) navigate('/signin', { replace: true });
  }, [token, navigate]);

  // ── Step 1: Send OTP ────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({ email });
      if (otpErr) throw otpErr;
      setStep('otp');
      // Focus first OTP box
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handling ─────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    if (value.length > 1) {
      // Handle paste
      const pasted = value.slice(0, 6).split('');
      for (let i = 0; i < pasted.length; i++) {
        if (index + i < 6) newOtp[index + i] = pasted[i];
      }
      setOtp(newOtp);
      inputRefs.current[Math.min(index + pasted.length, 5)]?.focus();
    } else {
      newOtp[index] = value;
      setOtp(newOtp);
      if (value && index < 5) inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Step 2: Verify OTP + create admin ──────────────────────────────────
  const verifyAndRegister = async () => {
    setLoading(true);
    setError(null);
    const code = otp.join('');
    try {
      // 1. Verify the OTP with Supabase
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });
      if (verifyErr) throw verifyErr;

      const userId = data.user?.id;
      if (!userId) throw new Error('Could not retrieve user ID after verification.');

      // 2. Call the server to create the admin record — token validated server-side
      const res = await fetch('/api/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, inviteCode: token }),
      });

      const result = await res.json();

      if (!res.ok) {
        // Sign them back out if the invite code was rejected
        await supabase.auth.signOut();
        throw new Error(result.error || 'Registration failed. Please check your invite link.');
      }

      // 3. Sign out — they'll log in normally via /admin/login
      await supabase.auth.signOut();
      setStep('success');
    } catch (err) {
      setError(err.message);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  // Auto-verify when all 6 digits entered
  useEffect(() => {
    if (step === 'otp' && otp.join('').length === 6 && !loading) {
      verifyAndRegister();
    }
  }, [otp, step]);

  if (!token) return null;

  return (
    <div className="auth-container">
      <div className="glass-panel auth-card" style={{ maxWidth: '420px' }}>

        {/* Icon + header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(16,185,129,0.2))',
            border: '1px solid rgba(99,102,241,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={30} color="var(--accent-color)" />
          </div>
        </div>

        <h1 style={{ marginBottom: '0.25rem' }}>Admin Registration</h1>
        <p className="subtitle" style={{ marginBottom: '2rem', fontSize: '0.9rem' }}>
          {step === 'email' && 'Create your admin account. You only need to do this once.'}
          {step === 'otp' && `Enter the 6-digit code sent to ${email}`}
          {step === 'success' && 'Your admin account is ready.'}
        </p>

        {/* ── Step: Email ── */}
        {step === 'email' && (
          <form onSubmit={handleSendOtp}>
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <label>Your Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                required
              />
            </div>

            {error && <p className="error-text mb-4">{error}</p>}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading || !email}>
              {loading ? 'Sending code…' : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Mail size={17} /> Send Verification Code
                </span>
              )}
            </button>

            <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              After registration you'll sign in at{' '}
              <a href="/admin/login" style={{ color: 'var(--accent-color)' }}>/admin/login</a>{' '}
              using the same email and a one-time code.
            </p>
          </form>
        )}

        {/* ── Step: OTP ── */}
        {step === 'otp' && (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  disabled={loading}
                  style={{
                    width: '3rem', height: '3.5rem',
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    padding: '0',
                    borderColor: digit ? 'var(--accent-color)' : undefined,
                  }}
                />
              ))}
            </div>

            {loading && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Verifying…
              </p>
            )}

            {error && <p className="error-text mb-4">{error}</p>}

            <button
              type="button"
              className="text-link"
              style={{ fontSize: '0.875rem', width: '100%', textAlign: 'center' }}
              onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setError(null); }}
              disabled={loading}
            >
              ← Use a different email
            </button>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid var(--success-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <ShieldCheck size={28} color="var(--success-color)" />
            </div>
            <p style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: '600' }}>
              Account created successfully!
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem', lineHeight: '1.5' }}>
              You can now sign in to the admin panel using your email. A new one-time code will be sent each time you log in.
            </p>
            <button
              className="btn btn-primary btn-full"
              onClick={() => navigate('/admin/login', { replace: true })}
            >
              <ArrowRight size={17} /> Go to Admin Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
