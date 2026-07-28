import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listarPrecios, guardarPrecio } from '../../lib/precios';
import { TipoCombustibleCarga } from '../../lib/types';

const combustibleLabel: Record<TipoCombustibleCarga, string> = {
  diesel: 'Diesel', nafta: 'Nafta', gnc: 'GNC', urea: 'Urea', agua_destilada: 'Agua destilada',
};

export function PreciosPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['precios'], queryFn: listarPrecios });
  const [valores, setValores] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const iniciales: Record<string, string> = {};
    data.forEach((p) => { iniciales[p.tipoCombustible] = String(p.precioPorLitro); });
    setValores((v) => ({ ...iniciales, ...v }));
  }, [data]);

  const guardar = useMutation({
    mutationFn: (tipo: TipoCombustibleCarga) => guardarPrecio(tipo, Number(valores[tipo] || 0)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['precios'] }),
  });

  return (
    <div>
      <h1 className="mb-1 font-display text-xl text-slate-900">Precios de combustible</h1>
      <p className="mb-4 text-sm text-slate-500">
        Se usan para calcular el gasto devengado apenas se pide o entrega combustible, sin esperar la factura.
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Precio por litro ($)</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(Object.keys(combustibleLabel) as TipoCombustibleCarga[]).map((tipo) => (
              <tr key={tipo}>
                <td className="px-4 py-2">{combustibleLabel[tipo]}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={valores[tipo] ?? ''}
                    onChange={(e) => setValores({ ...valores, [tipo]: e.target.value })}
                    className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => guardar.mutate(tipo)}
                    disabled={guardar.isPending}
                    className="rounded-md bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800"
                  >
                    Guardar
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
