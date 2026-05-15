'use client';

import { useEffect } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Keeps the firebase-token cookie in sync with Firebase's current ID token.
//
// onIdTokenChanged fires on:
//   - initial load (immediately with current user or null)
//   - sign-in / sign-out
//   - Firebase's automatic ~55-minute token refresh
//
// This means the middleware always has a fresh, valid token to check.
// ---------------------------------------------------------------------------

function setTokenCookie(token: string) {
  const secure = typeof window !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  // max-age=3600 matches Firebase token lifetime. The listener re-fires and
  // resets this cookie before expiry whenever the app is open.
  document.cookie = `firebase-token=${token}; path=/; SameSite=Lax; max-age=3600${secure}`;
}

function clearTokenCookie() {
  document.cookie = 'firebase-token=; path=/; SameSite=Lax; max-age=0';
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        // Force-fetch a fresh token (handles "user returns after overnight gap"
        // where Firebase has them signed in but the cookie is long expired).
        const token = await user.getIdToken();
        setTokenCookie(token);
      } else {
        clearTokenCookie();
      }
    });

    return () => unsubscribe();
  }, []);

  return <>{children}</>;
}
