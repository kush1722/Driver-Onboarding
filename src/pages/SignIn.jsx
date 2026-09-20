import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Mail, ArrowRight, UserPlus, LogIn, User } from 'lucide-react';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Rate Limit States
  const [rateLimitExpiry, setRateLimitExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkExpired = searchParams.get('reason') === 'link_expired';
  const { session, loading: authLoading, isAdmin } = useAuth();

  useEffect(() => {
    if (session && !authLoading) {
      if (isAdmin) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    }
  }, [session, isAdmin, authLoading, navigate]);

  // Load expiry from localStorage on mount
  useEffect(() => {
    const storedExpiry = localStorage.getItem('authRateLimitExpiry');
    if (storedExpiry) {
      const expiry = parseInt(storedExpiry, 10);
      if (expiry > Date.now()) {
        setRateLimitExpiry(expiry);
      } else {
        localStorage.removeItem('authRateLimitExpiry');
      }
    }
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!rateLimitExpiry) return;

    // Run immediately once
    const updateTime = () => {
      const now = Date.now();
      if (now >= rateLimitExpiry) {
        setRateLimitExpiry(null);
        setTimeLeft('');
        localStorage.removeItem('authRateLimitExpiry');
      } else {
        const diff = rateLimitExpiry - now;
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m}m ${s}s`);
      }
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [rateLimitExpiry]);

  const handleDevBypass = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const bypassEmail = email || 'dev@driver.com';
    const pwd = 'DevPassword123!';
    try {
      if (isSignUp) {
        if (!fullName) throw new Error("Please enter your full name.");
        
        let { error: upErr, data: upData } = await supabase.auth.signUp({ email: bypassEmail, password: pwd });
        
        // Supabase returns a user but with an identity error if the email is taken (on some configurations)
        // or it might just succeed if "Confirm email" is off.
        // Let's assume if upErr exists, it's an error.
        if (upErr) {
          if (upErr.message.includes('already registered')) {
             throw new Error("Account already exists. Please sign in instead.");
          }
          throw upErr;
        }
        
        if (upData?.user) {
          // Force sign in to guarantee the auth token is attached before we insert
          await supabase.auth.signInWithPassword({ email: bypassEmail, password: pwd });
          
          const { error: insertErr } = await supabase.from('drivers').insert([{ auth_id: upData.user.id, email: bypassEmail, full_name: fullName }]);
          if (insertErr) throw new Error("Database error (Did you run the SQL script?): " + insertErr.message);
          
          if (!upData.session) {
             throw new Error("Account created, but login blocked! Please go to Supabase > Authentication > Providers > Email and turn OFF 'Confirm email'.");
          }
        } else {
           throw new Error("Account already exists. Please sign in instead.");
        }
      } else {
        // Just sign in
        let { error: signErr } = await supabase.auth.signInWithPassword({ email: bypassEmail, password: pwd });
        if (signErr) {
          throw new Error("Login failed: " + signErr.message);
        }
      }
      
      // We don't need to manually navigate here because the useEffect 
      // will trigger as soon as the AuthContext picks up the new session!
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isSignUp && !fullName) {
      setError("Please enter your full name.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: isSignUp,
        },
      });

      if (error) throw error;
      
      navigate('/verify-otp', { state: { email, fullName: isSignUp ? fullName : undefined } });
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many requests')) {
        const expiry = Date.now() + 3600000; // 1 hour
        setRateLimitExpiry(expiry);
        localStorage.setItem('authRateLimitExpiry', expiry.toString());
        setError("Supabase free tier rate limit reached. Please use the Bypass button.");
      } else if (msg.toLowerCase().includes('signups not allowed')) {
        setError("Account not found. Please switch to 'Sign Up' to create an account.");
      } else {
        setError(msg || 'An error occurred during sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-card" style={{ transition: 'all 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--accent-color)' }}>
          {isSignUp ? <UserPlus size={48} /> : <LogIn size={48} />}
        </div>
        <h1>{isSignUp ? 'Join Our Fleet' : 'Welcome Back'}</h1>
        <p className="subtitle" style={{ marginBottom: '2rem' }}>
          {isSignUp 
            ? 'Create an account to start your driver application and get on the road.' 
            : 'Enter your email to resume your application or view your dashboard.'}
        </p>
        {/* ── Expired magic link notice ── */}
        {linkExpired && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '0.875rem 1rem',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '10px',
            textAlign: 'left',
          }}>
            <p style={{ fontWeight: '600', color: 'var(--warning-color)', fontSize: '0.875rem', margin: '0 0 0.25rem 0' }}>
              ⚠ That link has already been used
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, lineHeight: '1.6' }}>
              Your approval link is one-time use only and is no longer valid. Please sign in below using your email — we'll send you a code to log in.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group" style={{ textAlign: 'left', animation: 'fadeIn 0.3s ease' }}>
              <label htmlFor="fullName">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={20} />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required={isSignUp}
                  style={{ paddingLeft: '3.2rem' }}
                />
              </div>
            </div>
          )}

          <div className="form-group" style={{ textAlign: 'left' }}>
            <label htmlFor="email">Email address</label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={20} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                style={{ paddingLeft: '3rem' }}
              />
            </div>
          </div>

          {error && <p className="error-text mb-4">{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: rateLimitExpiry ? 2 : 1 }} disabled={loading || !email || rateLimitExpiry}>
              {loading ? 'Processing...' : rateLimitExpiry ? `Try again in ${timeLeft}` : (isSignUp ? 'Create Account' : 'Send Code')}
            </button>
            {rateLimitExpiry && (
              <button type="button" onClick={handleDevBypass} className="btn btn-secondary" style={{ flex: 1, borderColor: 'var(--accent-color)', color: 'var(--accent-color)', animation: 'fadeIn 0.3s ease' }} disabled={loading}>
                Bypass OTP
              </button>
            )}
          </div>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--surface-border)' }}>
          <p style={{ fontSize: '0.875rem' }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account yet? "}
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up Now'}
            </button>
          </p>
          {rateLimitExpiry && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1.25rem', lineHeight: '1.5', opacity: 0.7, animation: 'fadeIn 0.5s ease' }}>
              <strong>Testing Notice:</strong> Because this app uses a free-tier database, we are limited to sending a few emails per hour. The system has automatically unlocked a bypass for you to continue testing without needing an email.
            </p>
          )}

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button 
              type="button" 
              className="text-link" 
              onClick={() => navigate('/otp-verify')}
              style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
            >
              Already have a verification code?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
