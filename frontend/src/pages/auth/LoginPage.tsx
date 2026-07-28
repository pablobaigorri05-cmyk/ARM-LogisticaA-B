import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { login } from '../../lib/auth';
import { useAuth } from '../../context/AuthContext';
import { Footer } from '../../components/Footer';

export function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Si ya hay una sesión activa (por ejemplo, recargaste la página estando
  // logueado), ni siquiera mostramos el formulario — directo adentro.
  if (!authLoading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      setError('Email o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-teal-50 via-white to-white">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <img src="/logo-armegom.png" alt="Armegom" className="h-14 w-auto object-contain" />
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <h1 className="mb-1 font-display text-lg font-semibold text-slate-900">Gestión de combustible y flota</h1>
            <p className="mb-6 text-sm text-slate-500">Iniciá sesión para continuar.</p>

            <label className="mb-4 block text-xs font-medium text-slate-500">
              Email
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </label>
            <label className="mb-5 block text-xs font-medium text-slate-500">
              Contraseña
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
            </label>

            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full rounded-md bg-teal-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-60">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
