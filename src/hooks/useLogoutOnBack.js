import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function useLogoutOnBack() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Push a dummy state to history. When the user hits the physical back button,
    // the browser will "pop" this state instead of navigating away.
    window.history.pushState(null, '', window.location.pathname);

    const handlePopState = async () => {
      // User pressed the back button.
      // 1. Sign out the user
      await signOut();
      // 2. Redirect to the sign-in page
      navigate('/signin', { replace: true });
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [signOut, navigate]);
}
