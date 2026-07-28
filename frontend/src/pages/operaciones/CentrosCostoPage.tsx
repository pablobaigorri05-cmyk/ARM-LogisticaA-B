import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearCentroCosto, listarCentrosCosto, seedCentrosCosto, agregarCentrosFaltantes } from '../../lib/centrosCosto';
import { TipoCentroCosto } from '../../lib/types';
import { ReporteCombustible } from './ReporteCombustible';

const tipoLabel: Record<TipoCentroCosto, string> = {
  obra: 'Obra',
  area_interna: 'Área interna',
};

export function CentrosCostoPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'lista' | 'reporte'>('lista');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo: 'obra' as TipoCentroCosto });

  const { data, isLoading } = useQuery({ queryKey: ['centrosCosto'], queryFn: listarCentrosCosto });

  const crear = useMutation({
    mutationFn: () => crearCentroCosto({ nombre: form.nombre, tipo: form.tipo, estado: 'en_curso', activo: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['centrosCosto'] });
      setForm({ nombre: '', tipo: 'obra' });
      setShowForm(false);
    },
  });

  const seed = useMutation({
    mutationFn: seedCentrosCosto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['centrosCosto'] }),
  });

  const sync = useMutation({
    mutationFn: agregarCentrosFaltantes,
    onSuccess: (cantidad) => {
      qc.invalidateQueries({ queryKey: ['centrosCosto'] });
      alert(cantidad > 0 ? `Se agregaron ${cantidad} centros de costo nuevos.` : 'No faltaba ninguno — ya estaban todos cargados.');
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-slate-900">Centros de costo</h1>
          <p className="text-sm text-slate-500">Obras y áreas internas a las que se imputan las cargas</p>
        </div>
        {tab === 'lista' && (
          <div className="flex gap-2">
            {data?.length === 0 && (
              <button
                onClick={() => seed.mutate()}
                disabled={seed.isPending}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                {seed.isPending ? 'Cargando...' : 'Cargar lista real (37)'}
              </button>
            )}
            {data && data.length > 0 && (
              <button
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                {sync.isPending ? 'Revisando...' : 'Agregar los que falten'}
              </button>
            )}
            <button
              onClick={() => setShowForm((s) => !s)}
              className="rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700"
            >
              {showForm ? 'Cancelar' : '+ Nuevo'}
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('lista')}
          className={`rounded-full border px-3 py-1 text-xs ${tab === 'lista' ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 text-slate-600'}`}>
          Lista
        </button>
        <button onClick={() => setTab('reporte')}
          className={`rounded-full border px-3 py-1 text-xs ${tab === 'reporte' ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 text-slate-600'}`}>
          Reporte
        </button>
      </div>

      {tab === 'reporte' ? (
        <ReporteCombustible />
      ) : (
        <>
      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); crear.mutate(); }}
          className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-3"
        >
          <input required placeholder="Nombre" value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCentroCosto })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="obra">Obra</option>
            <option value="area_interna">Área interna</option>
          </select>
          <button type="submit" disabled={crear.isPending}
            className="rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700">
            {crear.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      )}

      {isLoading && <p className="text-sm text-slate-400">Cargando...</p>}
      {data?.length === 0 && !isLoading && (
        <p className="text-sm text-slate-400">
          Sin centros de costo todavía. Usá "Cargar lista real" para poblarlo con las 36 obras/áreas del formulario actual.
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">{c.nombre}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.tipo === 'obra' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                    {tipoLabel[c.tipo]}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500">{c.estado}</td>
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
