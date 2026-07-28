import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listarRegistrosConsumo, obtenerConfiguracionRendimiento, guardarConfiguracionRendimiento } from '../../lib/rendimiento';
import { listarActivos } from '../../lib/activos';
import { listarCentrosCosto } from '../../lib/centrosCosto';
import { NIVEL_TANQUE_LABEL } from '../../lib/types';

function MiniLineChart({ valores }: { valores: number[] }) {
  if (valores.length < 2) {
    return <p className="text-xs text-slate-400">Hace falta al menos 2 cargas con km calculado para graficar la evolución.</p>;
  }
  const w = 560, h = 140, pad = 24;
  const max = Math.max(...valores) * 1.1;
  const min = Math.min(...valores) * 0.9;
  const puntos = valores.map((v, i) => {
    const x = pad + (i / (valores.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full">
      <polyline points={puntos.join(' ')} fill="none" stroke="#0f172a" strokeWidth={2} />
      {puntos.map((p, i) => {
        const [x, y] = p.split(',').map(Number);
        return <circle key={i} cx={x} cy={y} r={3} fill="#0f172a" />;
      })}
    </svg>
  );
}

export function RendimientoPage() {
  const qc = useQueryClient();
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', centroCostoId: '', proveedorNombre: '', responsableNombre: '' });
  const [activoSeleccionado, setActivoSeleccionado] = useState<string>('');
  const [umbral, setUmbral] = useState('');

  const registrosQ = useQuery({ queryKey: ['registrosConsumo'], queryFn: listarRegistrosConsumo });
  const activosQ = useQuery({ queryKey: ['activos'], queryFn: listarActivos });
  const centrosQ = useQuery({ queryKey: ['centrosCosto'], queryFn: listarCentrosCosto });
  const configQ = useQuery({ queryKey: ['configRendimiento'], queryFn: obtenerConfiguracionRendimiento });

  const guardarUmbral = useMutation({
    mutationFn: (v: number) => guardarConfiguracionRendimiento(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['configRendimiento'] }),
  });

  const registrosFiltrados = useMemo(() => {
    return (registrosQ.data ?? []).filter((r) => {
      if (filtros.desde && r.fecha < new Date(filtros.desde).getTime()) return false;
      if (filtros.hasta && r.fecha > new Date(filtros.hasta).getTime() + 86_400_000 - 1) return false;
      if (filtros.centroCostoId && r.centroCostoId !== filtros.centroCostoId) return false;
      if (filtros.proveedorNombre && r.proveedorNombre !== filtros.proveedorNombre) return false;
      if (filtros.responsableNombre && r.responsableNombre !== filtros.responsableNombre) return false;
      return true;
    });
  }, [registrosQ.data, filtros]);

  const porActivo = useMemo(() => {
    const mapa: Record<string, { codigo: string; nombre: string; valores: number[]; alertas: number; ultimaFecha: number }> = {};
    for (const r of registrosFiltrados) {
      if (r.litrosPor100km === undefined) continue;
      const activo = activosQ.data?.find((a) => a.id === r.activoId);
      mapa[r.activoId] ??= { codigo: r.activoCodigo ?? activo?.codigoInterno ?? '—', nombre: activo?.nombre ?? '', valores: [], alertas: 0, ultimaFecha: 0 };
      mapa[r.activoId].valores.push(r.litrosPor100km);
      if (r.alertaConsumo || r.alertaTanque) mapa[r.activoId].alertas++;
      mapa[r.activoId].ultimaFecha = Math.max(mapa[r.activoId].ultimaFecha, r.fecha);
    }
    return Object.entries(mapa).map(([activoId, v]) => ({
      activoId,
      ...v,
      promedio: v.valores.reduce((a, b) => a + b, 0) / v.valores.length,
    }));
  }, [registrosFiltrados, activosQ.data]);

  const ranking = useMemo(() => [...porActivo].sort((a, b) => a.promedio - b.promedio), [porActivo]);
  const mejores = ranking.slice(0, 5);
  const peores = [...ranking].reverse().slice(0, 5);

  const alertas = registrosFiltrados.filter((r) => r.alertaConsumo || r.alertaTanque);

  const proveedores = Array.from(new Set((registrosQ.data ?? []).map((r) => r.proveedorNombre).filter(Boolean))) as string[];
  const responsables = Array.from(new Set((registrosQ.data ?? []).map((r) => r.responsableNombre).filter(Boolean))) as string[];

  const historialActivoSeleccionado = registrosFiltrados
    .filter((r) => r.activoId === activoSeleccionado && r.litrosPor100km !== undefined)
    .sort((a, b) => a.fecha - b.fecha);

  return (
    <div>
      <h1 className="mb-1 font-display text-xl text-slate-900">Rendimiento de combustible</h1>
      <p className="mb-4 text-sm text-slate-500">
        Calculado con el odómetro real confirmado en cada Orden de Carga — el de la Solicitud es solo informativo.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-6">
        <label className="flex flex-col text-xs text-slate-500">
          Desde
          <input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Hasta
          <input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
        </label>
        <select value={filtros.centroCostoId} onChange={(e) => setFiltros({ ...filtros, centroCostoId: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todos los centros de costo</option>
          {centrosQ.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={filtros.proveedorNombre} onChange={(e) => setFiltros({ ...filtros, proveedorNombre: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtros.responsableNombre} onChange={(e) => setFiltros({ ...filtros, responsableNombre: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todos los responsables</option>
          {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex items-end gap-1">
          <label className="flex flex-col text-xs text-slate-500">
            Umbral de desvío (%)
            <input type="number" placeholder={String(configQ.data?.umbralDesviacionPct ?? 10)}
              value={umbral} onChange={(e) => setUmbral(e.target.value)}
              className="mt-1 w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
          </label>
          <button onClick={() => umbral && guardarUmbral.mutate(Number(umbral))}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50">
            Guardar
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-3 text-[13px] text-slate-700">Mejor rendimiento (menos L/100km)</p>
          {mejores.length === 0 && <p className="text-sm text-slate-400">Todavía no hay datos suficientes.</p>}
          <ul className="space-y-1.5">
            {mejores.map((m) => (
              <li key={m.activoId} className="flex justify-between text-sm">
                <span>{m.codigo} · {m.nombre}</span>
                <span className="font-mono-data text-green-700">{m.promedio.toFixed(1)} L/100km</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-3 text-[13px] text-slate-700">Peor rendimiento (más L/100km)</p>
          {peores.length === 0 && <p className="text-sm text-slate-400">Todavía no hay datos suficientes.</p>}
          <ul className="space-y-1.5">
            {peores.map((m) => (
              <li key={m.activoId} className="flex justify-between text-sm">
                <span>{m.codigo} · {m.nombre}</span>
                <span className="font-mono-data text-red-700">{m.promedio.toFixed(1)} L/100km</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] text-slate-700">Evolución del consumo</p>
          <select value={activoSeleccionado} onChange={(e) => setActivoSeleccionado(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs">
            <option value="">Elegí un activo...</option>
            {porActivo.map((a) => <option key={a.activoId} value={a.activoId}>{a.codigo} · {a.nombre}</option>)}
          </select>
        </div>
        {activoSeleccionado ? (
          <MiniLineChart valores={historialActivoSeleccionado.map((r) => r.litrosPor100km!)} />
        ) : (
          <p className="text-sm text-slate-400">Elegí un activo para ver cómo evolucionó su consumo (L/100km).</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="mb-3 text-[13px] text-slate-700">Alertas ({alertas.length})</p>
        {alertas.length === 0 && <p className="text-sm text-slate-400">Sin alertas con estos filtros.</p>}
        <div className="space-y-2">
          {alertas.map((r) => (
            <div key={r.id} className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              <span className="font-mono-data">{new Date(r.fecha).toLocaleDateString('es-AR')}</span>{' — '}
              <strong>{r.activoCodigo}</strong>: {r.litrosPor100km !== undefined && `${r.litrosPor100km.toFixed(1)} L/100km`}
              {r.alertaConsumo && ' · desvío fuera del rango esperado'}
              {r.alertaTanque && ` · ${r.alertaTanque}`}
              {r.nivelTanqueAntes && ` (tanque antes: ${NIVEL_TANQUE_LABEL[r.nivelTanqueAntes]})`}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
