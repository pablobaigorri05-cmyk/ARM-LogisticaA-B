import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { obtenerPerfilUsuario } from '../lib/auth';
import { Usuario } from '../lib/types';

interface AuthState {
  user: User | null;
  perfil: Usuario | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, perfil: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, perfil: null, loading: true });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, perfil: null, loading: false });
        return;
      }
      const perfil = await obtenerPerfilUsuario(user.uid);
      setState({ user, perfil, loading: false });
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
