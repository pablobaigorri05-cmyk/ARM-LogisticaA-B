import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  aprobarSolicitud,
  crearSolicitud,
  listarSolicitudes,
  rechazarSolicitud,
  anularSolicitud,
} from '../../lib/solicitudes';
import { generarOrdenDesdeSolicitud } from '../../lib/ordenesCarga';
import { listarActivos } from '../../lib/activos';
import { listarCentrosCosto } from '../../lib/centrosCosto';
import { listarProveedores, seedProveedorAxion } from '../../lib/proveedores';
import { useAuth } from '../../context/AuthContext';
import { EstadoSolicitud, TipoCombustibleCarga } from '../../lib/types';

const combustibleLabel: Record<TipoCombustibleCarga, string> = {
  diesel: 'Diesel', nafta: 'Nafta', gnc: 'GNC', urea: 'Urea', agua_destilada: 'Agua destilada',
};

const estadoStyle: Record<EstadoSolicitud, string> = {
  pendiente: 'bg-slate-100 text-slate-600',
  aprobada: 'bg-green-50 text-green-700',
  rechazada: 'bg-red-50 text-red-700',
  convertida_en_orden: 'bg-blue-50 text-blue-700',
  anulada: 'bg-slate-100 text-slate-400',
};

function numSC(n?: number) {
  return `SC-${String(n ?? 0).padStart(6, '0')}`;
}

export function SolicitudesPage() {
  const qc = useQueryClient();
  const { user, perfil } = useAuth();
  const esAdministracion = perfil?.rol === 'administracion';

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    activoId: '', litrosSolicitados: '', tipoCombustible: 'diesel' as TipoCombustibleCarga,
    centroCostoId: '', fecha: new Date().toISOString().slice(0, 10), kilometros: '', observaciones: '',
  });

  const solicitudesQ = useQuery({ queryKey: ['solicitudes'], queryFn: listarSolicitudes });
  const activosQ = useQuery({ queryKey: ['activos'], queryFn: listarActivos });
  const centrosQ = useQuery({ queryKey: ['centrosCosto'], queryFn: listarCentrosCosto });
  const proveedoresQ = useQuery({ queryKey: ['proveedores'], queryFn: listarProveedores, enabled: esAdministracion });

  // Un Empleado solo ve sus propias solicitudes; Administración las ve todas.
  const solicitudesVisibles = (solicitudesQ.data ?? []).filter(
    (s) => esAdministracion || s.usuarioSolicitanteEmail === user?.email,
  );

  const crear = useMutation({
    mutationFn: () => {
      const activo = activosQ.data?.find((a) => a.id === form.activoId);
      const centro = centrosQ.data?.find((c) => c.id === form.centroCostoId);
      return crearSolicitud({
        activoId: form.activoId,
        activoCodigo: activo?.codigoInterno,
        litrosSolicitados: Number(form.litrosSolicitados),
        tipoCombustible: form.tipoCombustible,
        centroCostoId: form.centroCostoId,
        centroCostoNombre: centro?.nombre,
        fechaNecesidad: new Date(form.fecha).getTime(),
        kilometros: form.kilometros ? Number(form.kilometros) : undefined,
        observaciones: form.observaciones || undefined,
        usuarioSolicitanteEmail: user?.email ?? undefined,
        usuarioSolicitanteNombre: perfil?.nombre ?? user?.email ?? undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitudes'] });
      setForm({ ...form, activoId: '', litrosSolicitados: '', centroCostoId: '', kilometros: '', observaciones: '' });
      setShowForm(false);
    },
  });

  const aprobar = useMutation({ mutationFn: aprobarSolicitud, onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }) });
  const rechazar = useMutation({ mutationFn: rechazarSolicitud, onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }) });
  const anular = useMutation({ mutationFn: anularSolicitud, onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }) });

  const proveedorAxion = proveedoresQ.data?.find((p) => p.nombre.toLowerCase().includes('axion'));
  const generarOrden = useMutation({
    mutationFn: (solicitudId: string) => {
      if (!proveedorAxion) throw new Error('Cargá el proveedor Axion Clavero primero');
      return generarOrdenDesdeSolicitud(solicitudId, proveedorAxion.id, proveedorAxion.nombre);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['solicitudes'] });
      qc.invalidateQueries({ queryKey: ['ordenesCarga'] });
      alert(`Orden OC-${String(res.numero).padStart(6, '0')} generada. Andá a "Órdenes de carga" para verla.`);
    },
  });

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-display text-xl text-slate-900">Solicitudes de combustible</h1>
        <div className="flex gap-2">
          {esAdministracion && !proveedorAxion && (
            <button onClick={() => seedProveedorAxion().then(() => qc.invalidateQueries({ queryKey: ['proveedores'] }))}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              + Cargar proveedor Axion Clavero
            </button>
          )}
          <button onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
            {showForm ? 'Cancelar' : '+ Nueva solicitud'}
          </button>
        </div>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        {esAdministracion
          ? 'Origen del flujo: se pide, se aprueba, y recién ahí se genera la Orden de Carga.'
          : 'Pedí el combustible que necesitás — queda a nombre tuyo hasta que Administración lo apruebe.'}
      </p>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); crear.mutate(); }}
          className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-4">
          <select required value={form.activoId} onChange={(e) => setForm({ ...form, activoId: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Activo...</option>
            {activosQ.data?.map((a) => <option key={a.id} value={a.id}>{a.codigoInterno} · {a.nombre}</option>)}
          </select>
          <select required value={form.centroCostoId} onChange={(e) => setForm({ ...form, centroCostoId: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Centro de costo... (obligatorio)</option>
            {centrosQ.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <input required type="number" placeholder="Litros solicitados" value={form.litrosSolicitados}
            onChange={(e) => setForm({ ...form, litrosSolicitados: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <select value={form.tipoCombustible} onChange={(e) => setForm({ ...form, tipoCombustible: e.target.value as TipoCombustibleCarga })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {Object.entries(combustibleLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" placeholder="Km / horas actuales" value={form.kilometros}
            onChange={(e) => setForm({ ...form, kilometros: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <label className="flex flex-col text-xs text-slate-500">
            Fecha
            <input required type="date" value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
          </label>
          <input placeholder="Observaciones" value={form.observaciones}
            onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <button type="submit" disabled={crear.isPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
            {crear.isPending ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nº</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Solicitante</th>
              <th className="px-4 py-2">Activo</th>
              <th className="px-4 py-2">Litros</th>
              <th className="px-4 py-2">Costo est.</th>
              <th className="px-4 py-2">Centro de costo</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {solicitudesVisibles.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Sin solicitudes todavía.</td></tr>
            )}
            {solicitudesVisibles.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-mono-data text-slate-700">{numSC(s.numero)}</td>
                <td className="px-4 py-2 font-mono-data text-slate-500">
                  {s.fechaNecesidad ? new Date(s.fechaNecesidad).toLocaleDateString('es-AR') : '—'}
                </td>
                <td className="px-4 py-2">{s.usuarioSolicitanteNombre ?? '—'}</td>
                <td className="px-4 py-2">{s.activoCodigo ?? '—'}</td>
                <td className="px-4 py-2 font-mono-data">{s.litrosSolicitados} L</td>
                <td className="px-4 py-2 font-mono-data text-slate-500">
                  {s.costoEstimado ? `$${s.costoEstimado.toLocaleString('es-AR')}` : '—'}
                </td>
                <td className="px-4 py-2 text-slate-500">{s.centroCostoNombre ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${estadoStyle[s.estado]}`}>{s.estado}</span>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  {esAdministracion && s.estado === 'pendiente' && (
                    <>
                      <button onClick={() => aprobar.mutate(s.id)} className="text-xs text-green-700 hover:underline">Aprobar</button>
                      <button onClick={() => rechazar.mutate(s.id)} className="text-xs text-red-600 hover:underline">Rechazar</button>
                    </>
                  )}
                  {esAdministracion && s.estado === 'aprobada' && (
                    <>
                      <button onClick={() => generarOrden.mutate(s.id)} disabled={generarOrden.isPending}
                        className="text-xs text-blue-700 hover:underline">
                        {generarOrden.isPending ? 'Generando...' : 'Generar orden'}
                      </button>
                      <button onClick={() => anular.mutate(s.id)} className="text-xs text-slate-400 hover:underline">Anular</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
