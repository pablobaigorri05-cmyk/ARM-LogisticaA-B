import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { login } from '../../lib/auth';
import { useAuth } from '../../context/AuthContext';

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="mb-1 font-display text-lg text-slate-900">Empresa</h1>
        <p className="mb-5 text-sm text-slate-500">Iniciá sesión para acceder al sistema de combustible y flota.</p>

        <label className="mb-3 block text-xs text-slate-500">
          Email
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" />
        </label>
        <label className="mb-4 block text-xs text-slate-500">
          Contraseña
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" />
        </label>

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
