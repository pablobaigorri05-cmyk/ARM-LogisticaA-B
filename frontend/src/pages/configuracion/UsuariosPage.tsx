import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearUsuarioSinDesloguearAdmin, listarUsuarios } from '../../lib/usuarios';
import { RolUsuario } from '../../lib/types';

const rolLabel: Record<RolUsuario, string> = {
  administracion: 'Administración (acceso total)',
  empleado: 'Empleado (solo Solicitudes)',
};

export function UsuariosPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'empleado' as RolUsuario });
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios });

  const crear = useMutation({
    mutationFn: () => crearUsuarioSinDesloguearAdmin(form.email, form.password, form.nombre, form.rol),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setForm({ nombre: '', email: '', password: '', rol: 'empleado' });
      setShowForm(false);
      setError(null);
    },
    onError: (e: any) => setError(e.message ?? 'No se pudo crear el usuario'),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-slate-900">Usuarios</h1>
          <p className="text-sm text-slate-500">Quién puede entrar al sistema y con qué rol</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
          {showForm ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); crear.mutate(); }}
          className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-4">
          <input required placeholder="Nombre" value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <input required type="email" placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <input required type="password" placeholder="Contraseña provisoria" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as RolUsuario })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {Object.entries(rolLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="submit" disabled={crear.isPending}
            className="col-span-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 sm:col-span-1">
            {crear.isPending ? 'Creando...' : 'Crear usuario'}
          </button>
          {error && <p className="col-span-full text-sm text-red-500">{error}</p>}
        </form>
      )}

      {isLoading && <p className="text-sm text-slate-400">Cargando...</p>}
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Rol</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Sin usuarios todavía — creá el primero.</td></tr>
            )}
            {data?.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">{u.nombre}</td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2">{rolLabel[u.rol]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
