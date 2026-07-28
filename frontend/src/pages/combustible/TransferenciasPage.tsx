import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listarMovimientosBatan, listarTanquesMoviles, registrarMovimientoBatan } from '../../lib/batan';
import { listarActivos } from '../../lib/activos';
import { listarCentrosCosto } from '../../lib/centrosCosto';
import { Gauge } from '../../components/Gauge';
import { TipoCombustibleCarga } from '../../lib/types';

const combustibleLabel: Record<TipoCombustibleCarga, string> = {
  diesel: 'Diesel', nafta: 'Nafta', gnc: 'GNC', urea: 'Urea', agua_destilada: 'Agua destilada',
};

export function TransferenciasPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    batanId: '', activoDestinoId: '', litros: '', tipoCombustible: 'diesel' as TipoCombustibleCarga,
    centroCostoId: '', kilometros: '', observaciones: '',
  });
  const [error, setError] = useState<string | null>(null);

  const batanesQ = useQuery({ queryKey: ['tanquesMoviles'], queryFn: listarTanquesMoviles });
  const movimientosQ = useQuery({ queryKey: ['movimientosBatan'], queryFn: listarMovimientosBatan });
  const activosQ = useQuery({ queryKey: ['activos'], queryFn: listarActivos });
  const centrosQ = useQuery({ queryKey: ['centrosCosto'], queryFn: listarCentrosCosto });

  const batan = batanesQ.data?.[0];
  const activoSeleccionado = activosQ.data?.find((a) => a.id === form.activoDestinoId);

  const crear = useMutation({
    mutationFn: () => {
      const destino = activosQ.data?.find((a) => a.id === form.activoDestinoId);
      const centro = centrosQ.data?.find((c) => c.id === form.centroCostoId);
      return registrarMovimientoBatan({
        batanId: form.batanId || batan!.id,
        activoDestinoId: form.activoDestinoId,
        activoDestinoCodigo: destino?.codigoInterno,
        centroCostoId: form.centroCostoId || undefined,
        centroCostoNombre: centro?.nombre,
        litrosEntregados: Number(form.litros),
        tipoCombustible: form.tipoCombustible,
        kilometros: form.kilometros ? Number(form.kilometros) : undefined,
        observaciones: form.observaciones || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimientosBatan'] });
      qc.invalidateQueries({ queryKey: ['tanquesMoviles'] });
      qc.invalidateQueries({ queryKey: ['activos'] });
      setForm({ ...form, litros: '', kilometros: '', observaciones: '' });
      setError(null);
    },
    onError: (e: any) => setError(e.message ?? 'No se pudo registrar el movimiento'),
  });

  const movimientosConConsumo = useMemo(() => {
    const lista = movimientosQ.data ?? [];
    // Ordenados desc por fecha: para cada movimiento, el "anterior" del
    // mismo activo es el próximo en la lista (cronológicamente previo).
    return lista.map((m, i) => {
      const anterior = lista.slice(i + 1).find((x) => x.activoDestinoId === m.activoDestinoId && x.kilometros !== undefined);
      const kmDiferencia = m.kilometros !== undefined && anterior?.kilometros !== undefined ? m.kilometros - anterior.kilometros : undefined;
      const litrosPorKm = kmDiferencia && kmDiferencia > 0 ? m.litrosEntregados / kmDiferencia : undefined;
      // Bandera simple: cargó combustible pero el vehículo no avanzó nada
      // (o retrocedió) desde la carga anterior — el caso más obvio de
      // desvío/consumo no justificado a simple vista.
      const alerta = kmDiferencia !== undefined && kmDiferencia <= 0;
      return { ...m, kmDiferencia, litrosPorKm, alerta };
    });
  }, [movimientosQ.data]);

  if (!batanesQ.isLoading && !batan) {
    return (
      <div>
        <h1 className="mb-1 font-display text-xl text-slate-900">Transferencias</h1>
        <p className="text-sm text-slate-500">
          Todavía no hay ningún Activo marcado como tanque móvil. Andá a <strong>Activos</strong> y dale de alta al
          Batán (categoría "Otros", subgrupo "Batán") completando su capacidad en litros — desde ahí se van a poder
          registrar las entregas.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-6">
        <div>
          <h1 className="mb-1 font-display text-xl text-slate-900">Transferencias</h1>
          <p className="text-sm text-slate-500">Entregas de litros del Batán a vehículos y maquinarias en obra</p>
        </div>
        {batan && (
          <div className="text-center">
            <Gauge pct={((batan.stockActualLitros ?? 0) / (batan.capacidadLitros || 1)) * 100} size={80} />
            <p className="text-[11px] text-slate-500">{batan.stockActualLitros ?? 0} / {batan.capacidadLitros} L</p>
          </div>
        )}
      </div>

      {batan && (
        <form
          onSubmit={(e) => { e.preventDefault(); crear.mutate(); }}
          className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-5"
        >
          <select required value={form.activoDestinoId} onChange={(e) => setForm({ ...form, activoDestinoId: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Activo destino...</option>
            {activosQ.data?.filter((a) => a.id !== batan.id && a.estado !== 'baja').map((a) => <option key={a.id} value={a.id}>{a.codigoInterno} · {a.nombre}</option>)}
          </select>
          <input required type="number" placeholder="Litros entregados" value={form.litros}
            onChange={(e) => setForm({ ...form, litros: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <select value={form.tipoCombustible} onChange={(e) => setForm({ ...form, tipoCombustible: e.target.value as TipoCombustibleCarga })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {Object.entries(combustibleLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="flex flex-col">
            <input type="number" placeholder="Kilómetros / horas" value={form.kilometros}
              onChange={(e) => setForm({ ...form, kilometros: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            {activoSeleccionado?.odometroHorometroActual !== undefined && (
              <span className="mt-0.5 text-[11px] text-slate-400">
                Anterior: {activoSeleccionado.odometroHorometroActual}
                {form.kilometros && Number(form.kilometros) <= activoSeleccionado.odometroHorometroActual && (
                  <span className="ml-1 text-red-500">⚠ no avanzó</span>
                )}
              </span>
            )}
          </div>
          <select value={form.centroCostoId} onChange={(e) => setForm({ ...form, centroCostoId: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Centro de costo...</option>
            {centrosQ.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <input placeholder="Observaciones" value={form.observaciones}
            onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <button type="submit" disabled={crear.isPending}
            className="col-span-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 sm:col-span-1">
            {crear.isPending ? 'Registrando...' : 'Entregar'}
          </button>
          {error && <p className="col-span-full text-sm text-red-500">{error}</p>}
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Destino</th>
              <th className="px-4 py-2">Litros</th>
              <th className="px-4 py-2">Costo</th>
              <th className="px-4 py-2">Km</th>
              <th className="px-4 py-2">Diferencia km</th>
              <th className="px-4 py-2">Consumo (L/km)</th>
              <th className="px-4 py-2">Centro de costo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movimientosQ.data?.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Sin movimientos todavía.</td></tr>
            )}
            {movimientosConConsumo.map((m) => (
              <tr key={m.id} className={m.alerta ? 'bg-red-50/50' : ''}>
                <td className="px-4 py-2 font-mono-data text-slate-700">{new Date(m.fecha).toLocaleDateString('es-AR')}</td>
                <td className="px-4 py-2">{m.activoDestinoCodigo ?? '—'}</td>
                <td className="px-4 py-2 font-mono-data">{m.litrosEntregados} L</td>
                <td className="px-4 py-2 font-mono-data text-slate-500">{m.costoEstimado ? `$${m.costoEstimado.toLocaleString('es-AR')}` : '—'}</td>
                <td className="px-4 py-2 font-mono-data text-slate-500">{m.kilometros ?? '—'}</td>
                <td className="px-4 py-2 font-mono-data text-slate-500">
                  {m.kmDiferencia !== undefined ? (
                    <span className={m.alerta ? 'font-medium text-red-600' : ''}>
                      {m.kmDiferencia} {m.alerta && '⚠'}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 font-mono-data text-slate-500">
                  {m.litrosPorKm ? m.litrosPorKm.toFixed(2) : '—'}
                </td>
                <td className="px-4 py-2 text-slate-500">{m.centroCostoNombre ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
