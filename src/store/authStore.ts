import { create } from 'zustand';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Listen to auth changes immediately to resolve local session state
  onAuthStateChanged(auth, (user) => {
    set({ user, loading: false });
  });

  return {
    user: null,
    loading: true,
    error: null,
    login: async (email, password) => {
      set({ loading: true, error: null });
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        let errorMsg = 'Error al iniciar sesión';
        if (
          err.code === 'auth/invalid-email' || 
          err.code === 'auth/user-not-found' || 
          err.code === 'auth/wrong-password' || 
          err.code === 'auth/invalid-credential'
        ) {
          errorMsg = 'Credenciales incorrectas';
        } else if (err.code === 'auth/network-request-failed') {
          errorMsg = 'Error de conexión. Intente nuevamente.';
        }
        set({ error: errorMsg, loading: false });
        throw new Error(errorMsg);
      }
    },
    logout: async () => {
      set({ loading: true, error: null });
      try {
        await signOut(auth);
      } catch (err) {
        set({ error: 'Error al cerrar sesión', loading: false });
      }
    },
    setUser: (user) => set({ user }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error })
  };
});
