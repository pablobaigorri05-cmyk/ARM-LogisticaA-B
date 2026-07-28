import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { actualizarEstadoOrden, listarOrdenes } from '../../lib/ordenesCarga';
import { confirmarEntregaOrden } from '../../lib/batan';
import { listarActivos } from '../../lib/activos';
import { generarPdfOrdenDeCarga } from '../../lib/ordenCargaPdf';
import { EstadoOrdenCarga } from '../../lib/types';

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

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoOrdenCarga }) => actualizarEstadoOrden(id, estado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenesCarga'] }),
  });

  // Si el activo de la orden es el Batán, confirmar la entrega suma esos
  // litros a su stock — recién ahí hay algo para repartir con Transferencias.
  const confirmarEntrega = useMutation({
    mutationFn: async (o: { id: string; activoId: string; cantidadAutorizada: number }) => {
      await confirmarEntregaOrden(o.activoId, o.cantidadAutorizada);
      await actualizarEstadoOrden(o.id, 'utilizada');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordenesCarga'] });
      qc.invalidateQueries({ queryKey: ['tanquesMoviles'] });
    },
  });

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
              <tr key={o.id}>
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
                    <button
                      onClick={() => confirmarEntrega.mutate({ id: o.id, activoId: o.activoId, cantidadAutorizada: o.cantidadAutorizada })}
                      className="text-xs text-blue-700 hover:underline"
                    >
                      Confirmar entrega
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
