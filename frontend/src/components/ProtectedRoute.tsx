import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout } from '../lib/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, perfil, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Cargando...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // Un usuario desactivado desde Usuarios puede tener credenciales válidas
  // (el login en sí funciona), pero no debe poder usar la app.
  if (perfil?.activo === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-slate-700">Tu usuario fue desactivado. Contactá a un administrador.</p>
        <button onClick={() => logout()} className="text-xs text-teal-700 hover:underline">Cerrar sesión</button>
      </div>
    );
  }
  return <>{children}</>;
}
