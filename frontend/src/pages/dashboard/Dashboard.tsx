import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listarActivos } from '../../lib/activos';
import { listarTanquesMoviles, listarMovimientosBatan } from '../../lib/batan';
import { listarSolicitudes } from '../../lib/solicitudes';
import { listarRegistrosConsumo } from '../../lib/rendimiento';
import { Gauge } from '../../components/Gauge';
import { Activo, estaVigente, venceProntoOVencido } from '../../lib/types';

function AlertPanel({
  titulo,
  activos,
  render,
  tono,
}: {
  titulo: string;
  activos: Activo[];
  render: (a: Activo) => string;
  tono: 'danger' | 'warning';
}) {
  const bg = tono === 'danger' ? 'bg-red-50' : 'bg-amber-50';
  const text = tono === 'danger' ? 'text-red-700' : 'text-amber-700';
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-slate-700">{titulo}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-mono-data ${bg} ${text}`}>{activos.length}</span>
      </div>
      {activos.length === 0 ? (
        <p className="text-sm text-slate-400">Sin pendientes.</p>
      ) : (
        <ul className="space-y-1.5">
          {activos.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-sm">
              <Link to="/activos" className="text-slate-700 hover:underline">
                {a.codigoInterno} · {a.nombre}
              </Link>
              <span className="font-mono-data text-xs text-slate-500">{render(a)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Dashboard() {
  const activosQ = useQuery({ queryKey: ['activos'], queryFn: listarActivos });
  const tanquesQ = useQuery({ queryKey: ['tanquesMoviles'], queryFn: listarTanquesMoviles });
  const solicitudesQ = useQuery({ queryKey: ['solicitudes'], queryFn: listarSolicitudes });
  const movimientosQ = useQuery({ queryKey: ['movimientosBatan'], queryFn: listarMovimientosBatan });
  const registrosQ = useQuery({ queryKey: ['registrosConsumo'], queryFn: listarRegistrosConsumo });
  const alertasRendimiento = (registrosQ.data ?? []).filter((r) => r.alertaConsumo || r.alertaTanque);

  const activos = activosQ.data ?? [];
  const tanques = tanquesQ.data ?? [];
  const litrosStock = tanques.reduce((acc, t) => acc + (t.stockActualLitros ?? 0), 0);
  const gastoDevengado =
    (solicitudesQ.data ?? []).reduce((acc, s) => acc + (s.costoEstimado ?? 0), 0) +
    (movimientosQ.data ?? []).reduce((acc, m) => acc + (m.costoEstimado ?? 0), 0);

  const seguroVencido = activos.filter((a) => a.seguroVencimiento && !estaVigente(a.seguroVencimiento));
  const vtvVencida = activos.filter((a) => a.vtvVencimiento && !estaVigente(a.vtvVencimiento));
  const enMantenimiento = activos.filter((a) => a.estado === 'en_mantenimiento');
  const serviceProximo = activos.filter((a) => venceProntoOVencido(a.proximoServiceFecha));

  return (
    <div>
      <h1 className="mb-4 font-display text-xl text-slate-900">Dashboard</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="mb-1 text-[11px] text-slate-500">Activos</p>
          <p className="font-mono-data text-xl text-slate-900">{activos.length}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="mb-1 text-[11px] text-slate-500">Batán</p>
          <p className="font-mono-data text-xl text-slate-900">{litrosStock.toLocaleString('es-AR')} L</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-4">
          <p className="mb-1 text-[11px] text-emerald-700">Gasto devengado</p>
          <p className="font-mono-data text-xl text-emerald-700">${gastoDevengado.toLocaleString('es-AR')}</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-4">
          <p className="mb-1 text-[11px] text-amber-700">Alertas de rendimiento</p>
          <p className="font-mono-data text-xl text-amber-700">{alertasRendimiento.length}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-4">
          <p className="mb-1 text-[11px] text-red-700">Docs vencidos</p>
          <p className="font-mono-data text-xl text-red-700">
            {new Set([...seguroVencido, ...vtvVencida].map((a) => a.id)).size}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AlertPanel
          titulo="Seguro vencido"
          activos={seguroVencido}
          tono="danger"
          render={(a) => new Date(a.seguroVencimiento!).toLocaleDateString('es-AR')}
        />
        <AlertPanel
          titulo="VTV vencida"
          activos={vtvVencida}
          tono="danger"
          render={(a) => new Date(a.vtvVencimiento!).toLocaleDateString('es-AR')}
        />
        <AlertPanel
          titulo="En mantenimiento"
          activos={enMantenimiento}
          tono="warning"
          render={() => 'Taller'}
        />
      </div>

      {serviceProximo.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-[13px] text-amber-700">Service próximo o vencido</p>
          <ul className="space-y-1">
            {serviceProximo.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <Link to="/activos" className="text-amber-800 hover:underline">{a.codigoInterno} · {a.nombre}</Link>
                <span className="font-mono-data text-xs text-amber-700">
                  {a.proximoServiceFecha ? new Date(a.proximoServiceFecha).toLocaleDateString('es-AR') : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {alertasRendimiento.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] text-amber-700">Alertas de rendimiento</p>
            <Link to="/combustible/rendimiento" className="text-xs text-amber-700 hover:underline">Ver todas →</Link>
          </div>
          <ul className="space-y-1">
            {alertasRendimiento.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-amber-800">{r.activoCodigo} {r.alertaTanque ? '· inconsistencia de tanque' : '· desvío de consumo'}</span>
                <span className="font-mono-data text-xs text-amber-700">{new Date(r.fecha).toLocaleDateString('es-AR')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="mb-3 text-[13px] text-slate-500">Stock del Batán</p>
        {tanquesQ.isLoading && <p className="text-sm text-slate-400">Cargando...</p>}
        {tanques.length === 0 && !tanquesQ.isLoading && (
          <p className="text-sm text-slate-400">
            Todavía no hay ningún Activo marcado como tanque móvil. Dalo de alta en Activos.
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-6">
          {tanques.map((t) => (
            <div key={t.id} className="text-center">
              <Gauge pct={((t.stockActualLitros ?? 0) / (t.capacidadLitros || 1)) * 100} />
              <span className="text-[11px] text-slate-500">{t.nombre}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
