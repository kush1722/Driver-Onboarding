import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // Prevent duplicate in-flight admin checks from racing each other
  const checkInFlightRef = useRef(false);
  const latestUserIdRef = useRef(null);

  useEffect(() => {
    // Get initial session — this is the primary trigger
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user?.id);
    });

    // Auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Only re-run the admin check if the user ID actually changed
      if (session?.user?.id !== latestUserIdRef.current) {
        checkAdminStatus(session?.user?.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId) => {
    latestUserIdRef.current = userId ?? null;

    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // If a check is already in flight for this same user, skip
    if (checkInFlightRef.current) return;
    checkInFlightRef.current = true;
    setLoading(true);

    try {
      const res = await fetch(`/api/check-admin?userId=${userId}`);
      if (res.ok) {
        const { isAdmin: adminFlag } = await res.json();
        // Only update if this result is still for the current user
        if (latestUserIdRef.current === userId) {
          setIsAdmin(!!adminFlag);
        }
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    } finally {
      checkInFlightRef.current = false;
      setLoading(false);
    }
  };

  const signOut = async () => {
    setIsAdmin(false);
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user,
    isAdmin,
    signOut,
    loading,
    refreshAdminStatus: () => checkAdminStatus(user?.id),
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Always render children — ProtectedRoute handles the loading gate */}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
