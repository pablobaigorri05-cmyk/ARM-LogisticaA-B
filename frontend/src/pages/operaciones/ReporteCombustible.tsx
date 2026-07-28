import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { obtenerFilasReporte, exportarReporteExcel, exportarReportePDF, FilaReporte } from '../../lib/reportes';
import { listarCentrosCosto } from '../../lib/centrosCosto';
import { listarActivos } from '../../lib/activos';

export function ReporteCombustible() {
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', centroCostoId: '', activoCodigo: '' });
  const [filas, setFilas] = useState<FilaReporte[] | null>(null);

  const centrosQ = useQuery({ queryKey: ['centrosCosto'], queryFn: listarCentrosCosto });
  const activosQ = useQuery({ queryKey: ['activos'], queryFn: listarActivos });

  const buscar = useMutation({
    mutationFn: () =>
      obtenerFilasReporte({
        desde: filtros.desde ? new Date(filtros.desde).getTime() : undefined,
        hasta: filtros.hasta ? new Date(filtros.hasta).getTime() + 86_400_000 - 1 : undefined,
        centroCostoId: filtros.centroCostoId || undefined,
        activoCodigo: filtros.activoCodigo || undefined,
      }),
    onSuccess: (res) => setFilas(res),
  });

  const centroNombre = centrosQ.data?.find((c) => c.id === filtros.centroCostoId)?.nombre;
  const filtrosLabel = [
    filtros.desde && `Desde ${new Date(filtros.desde).toLocaleDateString('es-AR')}`,
    filtros.hasta && `hasta ${new Date(filtros.hasta).toLocaleDateString('es-AR')}`,
    centroNombre && `Centro de costo: ${centroNombre}`,
    filtros.activoCodigo && `Activo: ${filtros.activoCodigo}`,
  ].filter(Boolean).join(' · ') || 'Sin filtros aplicados';

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Junta Solicitudes, Órdenes de carga y Entregas del Batán en un solo listado filtrable.
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); buscar.mutate(); }}
        className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-5"
      >
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
        <select value={filtros.activoCodigo} onChange={(e) => setFiltros({ ...filtros, activoCodigo: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todos los activos</option>
          {activosQ.data?.map((a) => <option key={a.id} value={a.codigoInterno}>{a.codigoInterno} · {a.nombre}</option>)}
        </select>
        <button type="submit" disabled={buscar.isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
          {buscar.isPending ? 'Buscando...' : 'Filtrar'}
        </button>
      </form>

      {filas && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {filas.length} movimientos · {filas.reduce((a, f) => a + f.litros, 0).toLocaleString('es-AR')} L
            </p>
            <div className="flex gap-2">
              <button onClick={() => exportarReporteExcel(filas)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                Exportar Excel
              </button>
              <button onClick={() => exportarReportePDF(filas, filtrosLabel)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                Exportar PDF
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Nº</th>
                  <th className="px-4 py-2">Activo</th>
                  <th className="px-4 py-2">Centro de costo</th>
                  <th className="px-4 py-2">Litros</th>
                  <th className="px-4 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Sin movimientos con estos filtros.</td></tr>
                )}
                {filas.map((f, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-mono-data text-slate-700">{new Date(f.fecha).toLocaleDateString('es-AR')}</td>
                    <td className="px-4 py-2 text-slate-500">{f.tipo}</td>
                    <td className="px-4 py-2 font-mono-data">{f.numero}</td>
                    <td className="px-4 py-2">{f.activoCodigo ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{f.centroCostoNombre ?? '—'}</td>
                    <td className="px-4 py-2 font-mono-data">{f.litros} L</td>
                    <td className="px-4 py-2 text-slate-500">{f.estado ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
