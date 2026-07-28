import { useState, Fragment } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actualizarUsuario, crearUsuarioSinDesloguearAdmin, enviarResetPassword, listarUsuarios } from '../../lib/usuarios';
import { RolUsuario, Usuario } from '../../lib/types';

const rolLabel: Record<RolUsuario, string> = {
  administracion: 'Administración (acceso total)',
  empleado: 'Empleado (solo Solicitudes)',
};

export function UsuariosPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'empleado' as RolUsuario });
  const [error, setError] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editRol, setEditRol] = useState<RolUsuario>('empleado');
  const [editActivo, setEditActivo] = useState(true);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

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

  const editar = useMutation({
    mutationFn: (id: string) => actualizarUsuario(id, { rol: editRol, activo: editActivo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setEditandoId(null);
    },
  });

  const resetPassword = useMutation({
    mutationFn: (email: string) => enviarResetPassword(email),
    onSuccess: (_data, email) => setResetMsg(`Se mandó un mail a ${email} para que elija una contraseña nueva.`),
    onError: () => setResetMsg('No se pudo enviar el mail de restablecimiento.'),
  });

  function abrirEdicion(u: Usuario) {
    setEditandoId(editandoId === u.id ? null : u.id);
    setEditRol(u.rol);
    setEditActivo(u.activo);
    setResetMsg(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-slate-900">Usuarios</h1>
          <p className="text-sm text-slate-500">Quién puede entrar al sistema y con qué rol</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700">
          {showForm ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>

      {/* Qué puede hacer cada rol, para que quede clarísimo al crear uno */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
          <p className="mb-1 text-xs font-semibold text-teal-800">Administración</p>
          <p className="text-xs text-teal-700">
            Acceso total: Dashboard, Activos, Solicitudes (aprobar/rechazar), Órdenes de carga, Transferencias,
            Rendimiento, Centros de costo, Precios y Usuarios.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold text-slate-700">Empleado</p>
          <p className="text-xs text-slate-600">
            Solo ve Solicitudes: puede pedir combustible y ver sus propios pedidos. No puede aprobar nada ni entrar
            a ningún otro módulo, aunque escriba la URL a mano.
          </p>
        </div>
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
            className="col-span-2 rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700 sm:col-span-1">
            {crear.isPending ? 'Creando...' : 'Crear usuario'}
          </button>
          {error && <p className="col-span-full text-sm text-red-500">{error}</p>}
        </form>
      )}

      {resetMsg && <p className="mb-3 text-sm text-teal-700">{resetMsg}</p>}

      {isLoading && <p className="text-sm text-slate-400">Cargando...</p>}
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin usuarios todavía — creá el primero.</td></tr>
            )}
            {data?.map((u) => (
              <Fragment key={u.id}>
              <tr>
                <td className="px-4 py-2">{u.nombre}</td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2">{rolLabel[u.rol]}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${u.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {u.activo ? 'Activo' : 'Desactivado'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button onClick={() => abrirEdicion(u)} className="text-xs text-slate-500 hover:text-teal-700 hover:underline">
                    {editandoId === u.id ? 'Cerrar' : 'Editar'}
                  </button>
                  <button onClick={() => resetPassword.mutate(u.email)} disabled={resetPassword.isPending}
                    className="text-xs text-slate-500 hover:text-teal-700 hover:underline">
                    Resetear contraseña
                  </button>
                </td>
              </tr>
              {editandoId === u.id && (
                <tr className="bg-slate-50">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col text-xs text-slate-500">
                        Rol
                        <select value={editRol} onChange={(e) => setEditRol(e.target.value as RolUsuario)}
                          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                          {Object.entries(rolLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600">
                        <input type="checkbox" checked={editActivo} onChange={(e) => setEditActivo(e.target.checked)} />
                        Usuario activo (si lo destildás, no va a poder entrar más)
                      </label>
                      <button onClick={() => editar.mutate(u.id)} disabled={editar.isPending}
                        className="rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700">
                        {editar.isPending ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
