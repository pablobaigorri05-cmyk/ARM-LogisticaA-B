import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { actualizarEstadoOrden, listarOrdenes } from '../../lib/ordenesCarga';
import { confirmarEntregaOrden } from '../../lib/batan';
import { registrarConsumo } from '../../lib/rendimiento';
import { listarActivos } from '../../lib/activos';
import { generarPdfOrdenDeCarga } from '../../lib/ordenCargaPdf';
import { EstadoOrdenCarga, NIVEL_TANQUE_LABEL, NivelTanque } from '../../lib/types';

const estadoStyle: Record<EstadoOrdenCarga, string> = {
  pendiente: 'bg-slate-100 text-slate-600',
  enviada: 'bg-blue-50 text-blue-700',
  utilizada: 'bg-green-50 text-green-700',
  vencida: 'bg-amber-50 text-amber-700',
  cancelada: 'bg-red-50 text-red-700',
};

function numOC(n?: number) {
  return `OC-${String(n ?? 0).padStart(6, '0')}`;
}
function numSC(n?: number) {
  return `SC-${String(n ?? 0).padStart(6, '0')}`;
}

export function OrdenesCargaPage() {
  const qc = useQueryClient();
  const ordenesQ = useQuery({ queryKey: ['ordenesCarga'], queryFn: listarOrdenes });
  const activosQ = useQuery({ queryKey: ['activos'], queryFn: listarActivos });

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [formEntrega, setFormEntrega] = useState({ odometro: '', litros: '', nivelTanqueAntes: 'mitad' as NivelTanque });
  const [errorEntrega, setErrorEntrega] = useState<string | null>(null);

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoOrdenCarga }) => actualizarEstadoOrden(id, estado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenesCarga'] }),
  });

  // Acá se genera el ÚNICO odómetro que cuenta para Rendimiento — el de
  // la Solicitud es solo informativo. Si el activo es el Batán, además
  // le suma stock (recién ahí hay algo para repartir con Transferencias).
  const confirmarEntrega = useMutation({
    mutationFn: async (ordenId: string) => {
      const orden = ordenesQ.data!.find((o) => o.id === ordenId)!;
      const litros = Number(formEntrega.litros);
      const odometro = Number(formEntrega.odometro);

      await registrarConsumo({
        activoId: orden.activoId,
        activoCodigo: orden.activoCodigo,
        ordenCargaId: orden.id,
        odometro,
        litros,
        nivelTanqueAntes: formEntrega.nivelTanqueAntes,
        centroCostoId: orden.centroCostoId,
        centroCostoNombre: orden.centroCostoNombre,
        proveedorNombre: orden.proveedorNombre,
      });
      await confirmarEntregaOrden(orden.activoId, litros);
      await actualizarEstadoOrden(orden.id, 'utilizada');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordenesCarga'] });
      qc.invalidateQueries({ queryKey: ['tanquesMoviles'] });
      qc.invalidateQueries({ queryKey: ['activos'] });
      qc.invalidateQueries({ queryKey: ['registrosConsumo'] });
      setConfirmandoId(null);
      setFormEntrega({ odometro: '', litros: '', nivelTanqueAntes: 'mitad' });
      setErrorEntrega(null);
    },
    onError: (e: any) => setErrorEntrega(e.message ?? 'No se pudo confirmar la entrega'),
  });

  function abrirConfirmacion(ordenId: string) {
    setConfirmandoId(confirmandoId === ordenId ? null : ordenId);
    setErrorEntrega(null);
    const orden = ordenesQ.data?.find((o) => o.id === ordenId);
    const activo = activosQ.data?.find((a) => a.id === orden?.activoId);
    setFormEntrega({
      odometro: activo?.odometroHorometroActual !== undefined ? String(activo.odometroHorometroActual) : '',
      litros: orden ? String(orden.cantidadAutorizada) : '',
      nivelTanqueAntes: 'mitad',
    });
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-xl text-slate-900">Órdenes de carga</h1>
      <p className="mb-4 text-sm text-slate-500">
        Se generan solo desde una Solicitud aprobada — no se cargan sueltas. Desde acá se manda al proveedor.
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nº orden</th>
              <th className="px-4 py-2">Solicitud</th>
              <th className="px-4 py-2">Activo</th>
              <th className="px-4 py-2">Litros aut.</th>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordenesQ.data?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                Sin órdenes todavía — se generan desde Solicitudes, una vez aprobadas.
              </td></tr>
            )}
            {ordenesQ.data?.map((o) => (
              <Fragment key={o.id}>
              <tr>
                <td className="px-4 py-2 font-mono-data text-slate-700">{numOC(o.numero)}</td>
                <td className="px-4 py-2 font-mono-data text-slate-500">{numSC(o.solicitudNumero)}</td>
                <td className="px-4 py-2">{o.activoCodigo ?? '—'}</td>
                <td className="px-4 py-2 font-mono-data">{o.cantidadAutorizada} L</td>
                <td className="px-4 py-2 text-slate-500">{o.proveedorNombre ?? '—'}</td>
                <td className="px-4 py-2">
                  <select value={o.estado}
                    onChange={(e) => cambiarEstado.mutate({ id: o.id, estado: e.target.value as EstadoOrdenCarga })}
                    className={`rounded-full border-0 px-2 py-0.5 text-xs ${estadoStyle[o.estado]}`}
                  >
                    <option value="pendiente">pendiente</option>
                    <option value="enviada">enviada</option>
                    <option value="utilizada">utilizada</option>
                    <option value="vencida">vencida</option>
                    <option value="cancelada">cancelada</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  {o.estado === 'enviada' && (
                    <button onClick={() => abrirConfirmacion(o.id)} className="text-xs text-blue-700 hover:underline">
                      {confirmandoId === o.id ? 'Cerrar' : 'Confirmar entrega'}
                    </button>
                  )}
                  <button
                    onClick={() => generarPdfOrdenDeCarga(o, activosQ.data?.find((a) => a.id === o.activoId))}
                    className="text-xs text-slate-500 hover:text-slate-900 hover:underline"
                  >
                    PDF
                  </button>
                </td>
              </tr>
              {confirmandoId === o.id && (
                <tr className="bg-slate-50">
                  <td colSpan={7} className="px-4 py-3">
                    <p className="mb-2 text-xs text-slate-500">
                      Odómetro/horómetro REAL al momento de esta carga — es el único que se usa para calcular rendimiento (el de la Solicitud fue solo informativo).
                    </p>
                    {errorEntrega && <p className="mb-2 text-xs text-red-500">{errorEntrega}</p>}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <label className="flex flex-col text-xs text-slate-500">
                        Odómetro/horómetro real
                        <input required type="number" value={formEntrega.odometro}
                          onChange={(e) => setFormEntrega({ ...formEntrega, odometro: e.target.value })}
                          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                      </label>
                      <label className="flex flex-col text-xs text-slate-500">
                        Litros realmente cargados
                        <input required type="number" value={formEntrega.litros}
                          onChange={(e) => setFormEntrega({ ...formEntrega, litros: e.target.value })}
                          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                      </label>
                      <label className="flex flex-col text-xs text-slate-500">
                        Nivel de tanque antes de cargar
                        <select value={formEntrega.nivelTanqueAntes}
                          onChange={(e) => setFormEntrega({ ...formEntrega, nivelTanqueAntes: e.target.value as NivelTanque })}
                          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                          {(Object.keys(NIVEL_TANQUE_LABEL) as NivelTanque[]).map((n) => <option key={n} value={n}>{NIVEL_TANQUE_LABEL[n]}</option>)}
                        </select>
                      </label>
                    </div>
                    <button onClick={() => confirmarEntrega.mutate(o.id)} disabled={confirmarEntrega.isPending}
                      className="mt-3 rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700">
                      {confirmarEntrega.isPending ? 'Confirmando...' : 'Confirmar y calcular rendimiento'}
                    </button>
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
