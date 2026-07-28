import { useMemo, useState, useRef, Fragment } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actualizarActivo, crearActivo, listarActivos } from '../../lib/activos';
import { leerExcelActivos, importarActivosEnLote, FilaImportada } from '../../lib/importarActivos';
import { CATEGORIA_LABEL, CategoriaActivo, SUBGRUPOS, MARCAS, estaVigente, venceProntoOVencido, Activo, EstadoActivo } from '../../lib/types';

function toDateInput(ms?: number) {
  return ms ? new Date(ms).toISOString().slice(0, 10) : '';
}

const estadoClass: Record<string, string> = {
  activo: 'bg-green-50 text-green-700',
  baja: 'bg-red-50 text-red-700',
  en_mantenimiento: 'bg-amber-50 text-amber-700',
  inactivo: 'bg-slate-100 text-slate-500',
};

const emptyForm = {
  categoria: 'camionetas' as CategoriaActivo,
  subgrupo: SUBGRUPOS.camionetas[0],
  codigoInterno: '',
  nombre: '',
  marca: '',
  modelo: '',
  anio: '',
  numeroChasis: '',
  numeroMotor: '',
  patente: '',
  lugarCompra: '',
  seguroVencimiento: '',
  vtvVencimiento: '',
  ultimoServiceFecha: '',
  proximoServiceFecha: '',
  capacidadLitros: '',
};

export function ActivosList() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaActivo | 'todas'>('todas');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importando, setImportando] = useState<FilaImportada[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState({
    estado: 'activo' as EstadoActivo,
    seguroVencimiento: '',
    vtvVencimiento: '',
    ultimoServiceFecha: '',
    proximoServiceFecha: '',
  });

  const { data, isLoading, isError } = useQuery({ queryKey: ['activos'], queryFn: listarActivos });

  const crear = useMutation({
    mutationFn: () =>
      crearActivo({
        categoria: form.categoria,
        subgrupo: form.subgrupo,
        codigoInterno: form.codigoInterno,
        nombre: form.nombre,
        marca: form.marca || undefined,
        modelo: form.modelo || undefined,
        anio: form.anio ? Number(form.anio) : undefined,
        numeroChasis: form.numeroChasis || undefined,
        numeroMotor: form.numeroMotor || undefined,
        patente: form.patente || undefined,
        lugarCompra: form.lugarCompra || undefined,
        seguroVencimiento: form.seguroVencimiento ? new Date(form.seguroVencimiento).getTime() : undefined,
        vtvVencimiento: form.vtvVencimiento ? new Date(form.vtvVencimiento).getTime() : undefined,
        ultimoServiceFecha: form.ultimoServiceFecha ? new Date(form.ultimoServiceFecha).getTime() : undefined,
        proximoServiceFecha: form.proximoServiceFecha ? new Date(form.proximoServiceFecha).getTime() : undefined,
        unidadMedidaConsumo: form.categoria === 'maquinas' ? 'horas' : 'km',
        estado: 'activo',
        fechaAlta: Date.now(),
        esTanqueMovil: form.subgrupo === 'Batán' || undefined,
        capacidadLitros: form.subgrupo === 'Batán' && form.capacidadLitros ? Number(form.capacidadLitros) : undefined,
        stockActualLitros: form.subgrupo === 'Batán' ? 0 : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activos'] });
      setForm(emptyForm);
      setShowForm(false);
    },
  });

  const editar = useMutation({
    mutationFn: (id: string) =>
      actualizarActivo(id, {
        estado: editForm.estado,
        seguroVencimiento: editForm.seguroVencimiento ? new Date(editForm.seguroVencimiento).getTime() : undefined,
        vtvVencimiento: editForm.vtvVencimiento ? new Date(editForm.vtvVencimiento).getTime() : undefined,
        ultimoServiceFecha: editForm.ultimoServiceFecha ? new Date(editForm.ultimoServiceFecha).getTime() : undefined,
        proximoServiceFecha: editForm.proximoServiceFecha ? new Date(editForm.proximoServiceFecha).getTime() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activos'] });
      setEditingId(null);
    },
  });

  function abrirEdicion(a: Activo) {
    setEditingId(a.id);
    setEditForm({
      estado: a.estado,
      seguroVencimiento: toDateInput(a.seguroVencimiento),
      vtvVencimiento: toDateInput(a.vtvVencimiento),
      ultimoServiceFecha: toDateInput(a.ultimoServiceFecha),
      proximoServiceFecha: toDateInput(a.proximoServiceFecha),
    });
  }

  const importar = useMutation({
    mutationFn: (filas: FilaImportada[]) => importarActivosEnLote(filas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activos'] });
      setImportando(null);
    },
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const filas = await leerExcelActivos(file);
      setImportando(filas);
    } catch {
      setImportError('No se pudo leer el archivo. Confirmá que sea el Excel con las columnas EQUIPO, MARCA, MODELO, N°INTERNO, etc.');
    }
    e.target.value = '';
  }

  const agrupado = useMemo(() => {
    const activos = (data ?? []).filter((a) => filtroCategoria === 'todas' || a.categoria === filtroCategoria);
    const porCategoria: Record<string, Record<string, Activo[]>> = {};
    for (const a of activos) {
      porCategoria[a.categoria] ??= {};
      porCategoria[a.categoria][a.subgrupo] ??= [];
      porCategoria[a.categoria][a.subgrupo].push(a);
    }
    return porCategoria;
  }, [data, filtroCategoria]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-slate-900">Activos</h1>
          <p className="text-sm text-slate-500">Automóviles, camionetas, máquinas y otros equipos</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Importar desde Excel
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            {showForm ? 'Cancelar' : '+ Nuevo activo'}
          </button>
        </div>
      </div>

      {importError && <p className="mb-4 text-sm text-red-500">{importError}</p>}

      {importando && (
        <div className="mb-4 rounded-lg border border-slate-200 p-4">
          <p className="mb-3 text-sm text-slate-700">
            Se leyeron <strong>{importando.length}</strong> equipos del archivo. Revisá la vista previa antes de confirmar:
          </p>
          <div className="mb-3 max-h-64 overflow-y-auto rounded-md border border-slate-100">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-1.5">Interno</th>
                  <th className="px-3 py-1.5">Categoría</th>
                  <th className="px-3 py-1.5">Subgrupo</th>
                  <th className="px-3 py-1.5">Nombre</th>
                  <th className="px-3 py-1.5">Patente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importando.map((f, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-mono-data">{f.activo.codigoInterno}</td>
                    <td className="px-3 py-1.5">{CATEGORIA_LABEL[f.activo.categoria]}</td>
                    <td className="px-3 py-1.5">{f.activo.subgrupo}</td>
                    <td className="px-3 py-1.5">{f.activo.nombre}</td>
                    <td className="px-3 py-1.5">{f.activo.patente ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={() => importar.mutate(importando)} disabled={importar.isPending}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
              {importar.isPending ? 'Importando...' : `Confirmar e importar ${importando.length} equipos`}
            </button>
            <button onClick={() => setImportando(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(['todas', 'automoviles', 'camionetas', 'maquinas', 'otros'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFiltroCategoria(c)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filtroCategoria === c ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600'
            }`}
          >
            {c === 'todas' ? 'Todas' : CATEGORIA_LABEL[c]}
          </button>
        ))}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); crear.mutate(); }}
          className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-4"
        >
          <select
            value={form.categoria}
            onChange={(e) => {
              const categoria = e.target.value as CategoriaActivo;
              setForm({ ...form, categoria, subgrupo: SUBGRUPOS[categoria][0], marca: '' });
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {(Object.keys(CATEGORIA_LABEL) as CategoriaActivo[]).map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
            ))}
          </select>
          <select
            value={form.subgrupo}
            onChange={(e) => setForm({ ...form, subgrupo: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {SUBGRUPOS[form.categoria].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input required placeholder="Código interno" value={form.codigoInterno}
            onChange={(e) => setForm({ ...form, codigoInterno: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <input required placeholder="Nombre" value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <select value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Marca...</option>
            {MARCAS[form.categoria].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input placeholder="Modelo" value={form.modelo}
            onChange={(e) => setForm({ ...form, modelo: e.target.value.toUpperCase() })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase" />
          <select value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Año...</option>
            {Array.from({ length: new Date().getFullYear() + 1 - 1980 + 1 }, (_, i) => new Date().getFullYear() + 1 - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <input placeholder="Patente" value={form.patente}
            onChange={(e) => setForm({ ...form, patente: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <input placeholder="Nº de chasis" value={form.numeroChasis}
            onChange={(e) => setForm({ ...form, numeroChasis: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <input placeholder="Nº de motor" value={form.numeroMotor}
            onChange={(e) => setForm({ ...form, numeroMotor: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <input placeholder="Dónde se compró" value={form.lugarCompra}
            onChange={(e) => setForm({ ...form, lugarCompra: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <label className="flex flex-col text-xs text-slate-500">
            Seguro vence
            <input type="date" value={form.seguroVencimiento}
              onChange={(e) => setForm({ ...form, seguroVencimiento: e.target.value })}
              className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            VTV vence
            <input type="date" value={form.vtvVencimiento}
              onChange={(e) => setForm({ ...form, vtvVencimiento: e.target.value })}
              className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Último service
            <input type="date" value={form.ultimoServiceFecha}
              onChange={(e) => setForm({ ...form, ultimoServiceFecha: e.target.value })}
              className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Próximo service
            <input type="date" value={form.proximoServiceFecha}
              onChange={(e) => setForm({ ...form, proximoServiceFecha: e.target.value })}
              className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
          </label>
          {form.subgrupo === 'Batán' && (
            <input required type="number" placeholder="Capacidad del Batán (L)" value={form.capacidadLitros}
              onChange={(e) => setForm({ ...form, capacidadLitros: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          )}
          <button type="submit" disabled={crear.isPending}
            className="col-span-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 sm:col-span-1">
            {crear.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      )}

      {isLoading && <p className="text-sm text-slate-400">Cargando...</p>}
      {isError && (
        <p className="text-sm text-red-500">No se pudo conectar con Firestore. Revisá las variables VITE_FIREBASE_* en tu .env.</p>
      )}
      {data?.length === 0 && !isLoading && <p className="text-sm text-slate-400">Todavía no hay activos cargados.</p>}

      {Object.entries(agrupado).map(([categoria, subgrupos]) => (
        <div key={categoria} className="mb-6">
          <h2 className="mb-2 font-display text-[15px] text-slate-900">
            {CATEGORIA_LABEL[categoria as CategoriaActivo]}
          </h2>
          {Object.entries(subgrupos).map(([subgrupo, activos]) => (
            <div key={subgrupo} className="mb-3">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">{subgrupo}</p>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Código</th>
                      <th className="px-4 py-2">Nombre</th>
                      <th className="px-4 py-2">Patente</th>
                      <th className="px-4 py-2">Seguro</th>
                      <th className="px-4 py-2">VTV</th>
                      <th className="px-4 py-2">Service</th>
                      <th className="px-4 py-2">Estado</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activos.map((a) => (
                      <Fragment key={a.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono-data text-slate-700">{a.codigoInterno}</td>
                        <td className="px-4 py-2">
                          {a.nombre}
                          {a.esTanqueMovil && (
                            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                              {a.stockActualLitros ?? 0} / {a.capacidadLitros} L
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">{a.patente ?? '—'}</td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${estaVigente(a.seguroVencimiento) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {estaVigente(a.seguroVencimiento) ? 'Vigente' : 'Vencido / sin datos'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${estaVigente(a.vtvVencimiento) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {estaVigente(a.vtvVencimiento) ? 'Vigente' : 'Vencido / sin datos'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {a.proximoServiceFecha ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${venceProntoOVencido(a.proximoServiceFecha) ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                              {new Date(a.proximoServiceFecha).toLocaleDateString('es-AR')}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${estadoClass[a.estado] ?? ''}`}>{a.estado}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => (editingId === a.id ? setEditingId(null) : abrirEdicion(a))}
                            className="text-xs text-slate-500 hover:text-slate-900 hover:underline">
                            {editingId === a.id ? 'Cerrar' : 'Editar'}
                          </button>
                        </td>
                      </tr>
                      {editingId === a.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                              <label className="flex flex-col text-xs text-slate-500">
                                Estado
                                <select value={editForm.estado}
                                  onChange={(e) => setEditForm({ ...editForm, estado: e.target.value as EstadoActivo })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                                  <option value="activo">Activo</option>
                                  <option value="en_mantenimiento">En mantenimiento</option>
                                  <option value="inactivo">Inactivo</option>
                                  <option value="baja">Baja</option>
                                </select>
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Seguro vence
                                <input type="date" value={editForm.seguroVencimiento}
                                  onChange={(e) => setEditForm({ ...editForm, seguroVencimiento: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                VTV vence
                                <input type="date" value={editForm.vtvVencimiento}
                                  onChange={(e) => setEditForm({ ...editForm, vtvVencimiento: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Último service
                                <input type="date" value={editForm.ultimoServiceFecha}
                                  onChange={(e) => setEditForm({ ...editForm, ultimoServiceFecha: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Próximo service
                                <input type="date" value={editForm.proximoServiceFecha}
                                  onChange={(e) => setEditForm({ ...editForm, proximoServiceFecha: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                              </label>
                            </div>
                            <button onClick={() => editar.mutate(a.id)} disabled={editar.isPending}
                              className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
                              {editar.isPending ? 'Guardando...' : 'Guardar cambios'}
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
          ))}
        </div>
      ))}
    </div>
  );
}
