import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RolUsuario } from '../lib/types';

export function RoleGuard({ allow, children }: { allow: RolUsuario[]; children: React.ReactNode }) {
  const { perfil, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Cargando...</div>;
  }
  // Si todavía no hay perfil en /usuarios/{uid} lo dejamos pasar — evita
  // que alguien quede trabado por un doc de perfil mal cargado. El
  // control fuerte de acceso sigue siendo el login en sí.
  if (perfil && !allow.includes(perfil.rol)) {
    return <Navigate to="/combustible/solicitudes" replace />;
  }
  return <>{children}</>;
}
