import { useMemo, useState, useRef, Fragment } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actualizarActivo, crearActivo, eliminarActivoFisico, listarActivos } from '../../lib/activos';
import { leerExcelActivos, importarActivosEnLote, FilaImportada } from '../../lib/importarActivos';
import { listarCentrosCosto } from '../../lib/centrosCosto';
import { listarPropietarios, seedPropietarios, crearPropietario } from '../../lib/propietarios';
import { listarHistorialActivo, registrarCambiosActivo } from '../../lib/historialActivos';
import { exportarActivosExcel, exportarActivosPDF, generarFichaActivoPDF } from '../../lib/exportActivos';
import { useAuth } from '../../context/AuthContext';
import {
  CATEGORIA_LABEL, CategoriaActivo, SUBGRUPOS, MARCAS, ESTADO_LABEL, EstadoActivo,
  estaVigente, venceProntoOVencido, Activo, TipoCombustibleCarga,
} from '../../lib/types';

const combustibleLabel: Record<TipoCombustibleCarga, string> = {
  diesel: 'Diesel', nafta: 'Nafta', gnc: 'GNC', urea: 'Urea', agua_destilada: 'Agua destilada',
};

function toDateInput(ms?: number) {
  return ms ? new Date(ms).toISOString().slice(0, 10) : '';
}

const estadoClass: Record<EstadoActivo, string> = {
  activo: 'bg-green-50 text-green-700',
  baja: 'bg-red-50 text-red-700',
  en_mantenimiento: 'bg-amber-50 text-amber-700',
  fuera_de_servicio: 'bg-slate-100 text-slate-500',
  alquilado: 'bg-blue-50 text-blue-700',
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
  tipoCombustible: 'diesel' as TipoCombustibleCarga,
  capacidadTanqueLitros: '',
  odometroInicial: '',
  responsableNombre: '',
  observaciones: '',
  centroCostoId: '',
  propietarioId: '',
  seguroVencimiento: '',
  vtvVencimiento: '',
  ultimoServiceFecha: '',
  proximoServiceFecha: '',
  capacidadLitros: '',
};

// Campos completos que se pueden tocar desde "Editar" — la idea es que
// ningún dato cargado en el alta quede después imposible de corregir.
const emptyEditForm = {
  codigoInterno: '',
  patente: '',
  nombre: '',
  marca: '',
  modelo: '',
  anio: '',
  categoria: 'camionetas' as CategoriaActivo,
  subgrupo: '',
  tipoCombustible: 'diesel' as TipoCombustibleCarga,
  centroCostoId: '',
  responsableNombre: '',
  estado: 'activo' as EstadoActivo,
  observaciones: '',
  propietarioId: '',
  capacidadTanqueLitros: '',
  seguroVencimiento: '',
  vtvVencimiento: '',
  ultimoServiceFecha: '',
  proximoServiceFecha: '',
};

export function ActivosList() {
  const qc = useQueryClient();
  const { user, perfil } = useAuth();
  const esAdministracion = perfil?.rol === 'administracion';

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaActivo | 'todas'>('todas');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCentroCosto, setFiltroCentroCosto] = useState('');
  const [filtroPropietario, setFiltroPropietario] = useState('');
  const [soloVencimientosProximos, setSoloVencimientosProximos] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [historialId, setHistorialId] = useState<string | null>(null);

  const [importando, setImportando] = useState<FilaImportada[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nuevoPropietario, setNuevoPropietario] = useState('');

  const { data, isLoading, isError } = useQuery({ queryKey: ['activos'], queryFn: listarActivos });
  const centrosQ = useQuery({ queryKey: ['centrosCosto'], queryFn: listarCentrosCosto });
  const propietariosQ = useQuery({ queryKey: ['propietarios'], queryFn: listarPropietarios });
  const historialQ = useQuery({
    queryKey: ['historialActivo', historialId],
    queryFn: () => listarHistorialActivo(historialId!),
    enabled: !!historialId,
  });

  const crear = useMutation({
    mutationFn: () => {
      const centro = centrosQ.data?.find((c) => c.id === form.centroCostoId);
      const propietario = propietariosQ.data?.find((p) => p.id === form.propietarioId);
      return crearActivo({
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
        tipoCombustible: form.tipoCombustible,
        capacidadTanqueLitros: form.capacidadTanqueLitros ? Number(form.capacidadTanqueLitros) : undefined,
        odometroInicial: form.odometroInicial ? Number(form.odometroInicial) : undefined,
        odometroHorometroActual: form.odometroInicial ? Number(form.odometroInicial) : undefined,
        responsableNombre: form.responsableNombre || undefined,
        observaciones: form.observaciones || undefined,
        centroCostoId: form.centroCostoId || undefined,
        centroCostoNombre: centro?.nombre,
        propietarioId: form.propietarioId || undefined,
        propietarioNombre: propietario?.nombre,
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
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activos'] });
      setForm(emptyForm);
      setShowForm(false);
    },
  });

  const editar = useMutation({
    mutationFn: async (activo: Activo) => {
      const centro = centrosQ.data?.find((c) => c.id === editForm.centroCostoId);
      const propietario = propietariosQ.data?.find((p) => p.id === editForm.propietarioId);
      const cambios: Partial<Activo> = {
        codigoInterno: editForm.codigoInterno,
        patente: editForm.patente || undefined,
        nombre: editForm.nombre,
        marca: editForm.marca || undefined,
        modelo: editForm.modelo || undefined,
        anio: editForm.anio ? Number(editForm.anio) : undefined,
        categoria: editForm.categoria,
        subgrupo: editForm.subgrupo,
        tipoCombustible: editForm.tipoCombustible,
        centroCostoId: editForm.centroCostoId || undefined,
        centroCostoNombre: centro?.nombre,
        responsableNombre: editForm.responsableNombre || undefined,
        estado: editForm.estado,
        observaciones: editForm.observaciones || undefined,
        propietarioId: editForm.propietarioId || undefined,
        propietarioNombre: propietario?.nombre,
        capacidadTanqueLitros: editForm.capacidadTanqueLitros ? Number(editForm.capacidadTanqueLitros) : undefined,
        seguroVencimiento: editForm.seguroVencimiento ? new Date(editForm.seguroVencimiento).getTime() : undefined,
        vtvVencimiento: editForm.vtvVencimiento ? new Date(editForm.vtvVencimiento).getTime() : undefined,
        ultimoServiceFecha: editForm.ultimoServiceFecha ? new Date(editForm.ultimoServiceFecha).getTime() : undefined,
        proximoServiceFecha: editForm.proximoServiceFecha ? new Date(editForm.proximoServiceFecha).getTime() : undefined,
        fechaBaja: editForm.estado === 'baja' ? Date.now() : undefined,
      };
      await actualizarActivo(activo.id, cambios);
      await registrarCambiosActivo(activo.id, activo as unknown as Record<string, unknown>, cambios as Record<string, unknown>, user?.email ?? undefined, perfil?.nombre ?? user?.email ?? undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activos'] });
      setEditingId(null);
    },
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarActivoFisico(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activos'] }),
  });

  const crearPropietarioRapido = useMutation({
    mutationFn: (nombre: string) => crearPropietario(nombre),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propietarios'] });
      setNuevoPropietario('');
    },
  });

  const seedProp = useMutation({
    mutationFn: seedPropietarios,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['propietarios'] }),
  });

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

  function abrirEdicion(a: Activo) {
    setEditingId(a.id);
    setHistorialId(null);
    setEditForm({
      codigoInterno: a.codigoInterno,
      patente: a.patente ?? '',
      nombre: a.nombre,
      marca: a.marca ?? '',
      modelo: a.modelo ?? '',
      anio: a.anio ? String(a.anio) : '',
      categoria: a.categoria,
      subgrupo: a.subgrupo,
      tipoCombustible: a.tipoCombustible ?? 'diesel',
      centroCostoId: a.centroCostoId ?? '',
      responsableNombre: a.responsableNombre ?? '',
      estado: a.estado,
      observaciones: a.observaciones ?? '',
      propietarioId: a.propietarioId ?? '',
      capacidadTanqueLitros: a.capacidadTanqueLitros ? String(a.capacidadTanqueLitros) : '',
      seguroVencimiento: toDateInput(a.seguroVencimiento),
      vtvVencimiento: toDateInput(a.vtvVencimiento),
      ultimoServiceFecha: toDateInput(a.ultimoServiceFecha),
      proximoServiceFecha: toDateInput(a.proximoServiceFecha),
    });
  }

  function duplicar(a: Activo) {
    setShowForm(true);
    setForm({
      ...emptyForm,
      categoria: a.categoria,
      subgrupo: a.subgrupo,
      nombre: a.nombre,
      marca: a.marca ?? '',
      modelo: a.modelo ?? '',
      anio: a.anio ? String(a.anio) : '',
      tipoCombustible: a.tipoCombustible ?? 'diesel',
      lugarCompra: a.lugarCompra ?? '',
      centroCostoId: a.centroCostoId ?? '',
      propietarioId: a.propietarioId ?? '',
      capacidadTanqueLitros: a.capacidadTanqueLitros ? String(a.capacidadTanqueLitros) : '',
      // Código interno, patente, chasis y motor NO se copian a propósito
      // — son datos únicos de cada equipo, no tendría sentido duplicarlos.
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const activosFiltrados = useMemo(() => {
    return (data ?? []).filter((a) => {
      if (filtroCategoria !== 'todas' && a.categoria !== filtroCategoria) return false;
      if (filtroEstado && a.estado !== filtroEstado) return false;
      if (filtroCentroCosto && a.centroCostoId !== filtroCentroCosto) return false;
      if (filtroPropietario && a.propietarioId !== filtroPropietario) return false;
      if (soloVencimientosProximos) {
        const vence = venceProntoOVencido(a.seguroVencimiento) || venceProntoOVencido(a.vtvVencimiento) || venceProntoOVencido(a.proximoServiceFecha);
        if (!vence) return false;
      }
      return true;
    });
  }, [data, filtroCategoria, filtroEstado, filtroCentroCosto, filtroPropietario, soloVencimientosProximos]);

  const filtrosLabel = [
    filtroCategoria !== 'todas' && CATEGORIA_LABEL[filtroCategoria],
    filtroEstado && ESTADO_LABEL[filtroEstado as EstadoActivo],
    filtroCentroCosto && centrosQ.data?.find((c) => c.id === filtroCentroCosto)?.nombre,
    filtroPropietario && propietariosQ.data?.find((p) => p.id === filtroPropietario)?.nombre,
    soloVencimientosProximos && 'Solo vencimientos próximos',
  ].filter(Boolean).join(' · ') || 'Sin filtros';

  const agrupado = useMemo(() => {
    const porCategoria: Record<string, Record<string, Activo[]>> = {};
    for (const a of activosFiltrados) {
      porCategoria[a.categoria] ??= {};
      porCategoria[a.categoria][a.subgrupo] ??= [];
      porCategoria[a.categoria][a.subgrupo].push(a);
    }
    return porCategoria;
  }, [activosFiltrados]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-slate-900">Activos</h1>
          <p className="text-sm text-slate-500">Automóviles, camionetas, máquinas y otros equipos</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <button onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Importar Excel
          </button>
          <button onClick={() => exportarActivosExcel(activosFiltrados)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Exportar Excel
          </button>
          <button onClick={() => exportarActivosPDF(activosFiltrados, filtrosLabel)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Exportar PDF
          </button>
          <button onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
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

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3">
        {(['todas', 'automoviles', 'camionetas', 'maquinas', 'otros'] as const).map((c) => (
          <button key={c} onClick={() => setFiltroCategoria(c)}
            className={`rounded-full border px-3 py-1 text-xs ${filtroCategoria === c ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600'}`}>
            {c === 'todas' ? 'Todas' : CATEGORIA_LABEL[c]}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs">
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_LABEL) as EstadoActivo[]).map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
        </select>
        <select value={filtroCentroCosto} onChange={(e) => setFiltroCentroCosto(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs">
          <option value="">Todos los centros de costo</option>
          {centrosQ.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={filtroPropietario} onChange={(e) => setFiltroPropietario(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs">
          <option value="">Todos los propietarios</option>
          {propietariosQ.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={soloVencimientosProximos} onChange={(e) => setSoloVencimientosProximos(e.target.checked)} />
          Solo vencimientos próximos
        </label>
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
          <select value={form.tipoCombustible} onChange={(e) => setForm({ ...form, tipoCombustible: e.target.value as TipoCombustibleCarga })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {Object.entries(combustibleLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" placeholder="Capacidad tanque (L)" value={form.capacidadTanqueLitros}
            onChange={(e) => setForm({ ...form, capacidadTanqueLitros: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <input type="number" placeholder="Odómetro/horómetro inicial" value={form.odometroInicial}
            onChange={(e) => setForm({ ...form, odometroInicial: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <select value={form.centroCostoId} onChange={(e) => setForm({ ...form, centroCostoId: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Centro de costo...</option>
            {centrosQ.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={form.propietarioId} onChange={(e) => setForm({ ...form, propietarioId: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Propietario...</option>
            {propietariosQ.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input placeholder="Responsable" value={form.responsableNombre}
            onChange={(e) => setForm({ ...form, responsableNombre: e.target.value })}
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
          <textarea placeholder="Observaciones" value={form.observaciones}
            onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
            className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2" rows={1} />
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
      {activosFiltrados.length === 0 && !isLoading && <p className="text-sm text-slate-400">No hay activos que coincidan con estos filtros.</p>}

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
                      <th className="px-4 py-2">Propietario</th>
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
                        <td className="px-4 py-2 text-slate-500">{a.propietarioNombre ?? '—'}</td>
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
                          <span className={`rounded-full px-2 py-0.5 text-xs ${estadoClass[a.estado] ?? ''}`}>{ESTADO_LABEL[a.estado]}</span>
                        </td>
                        <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                          <button onClick={() => (editingId === a.id ? setEditingId(null) : abrirEdicion(a))}
                            className="text-xs text-slate-500 hover:text-slate-900 hover:underline">
                            {editingId === a.id ? 'Cerrar' : 'Editar'}
                          </button>
                          <button onClick={() => setHistorialId(historialId === a.id ? null : a.id)}
                            className="text-xs text-slate-500 hover:text-slate-900 hover:underline">
                            Historial
                          </button>
                          <button onClick={() => duplicar(a)} className="text-xs text-slate-500 hover:text-slate-900 hover:underline">
                            Duplicar
                          </button>
                          <button onClick={() => generarFichaActivoPDF(a)} className="text-xs text-slate-500 hover:text-slate-900 hover:underline">
                            Ficha PDF
                          </button>
                          {esAdministracion && (
                            <button
                              onClick={() => { if (confirm(`¿Eliminar ${a.codigoInterno} definitivamente? Esta acción no se puede deshacer.`)) eliminar.mutate(a.id); }}
                              className="text-xs text-red-500 hover:text-red-700 hover:underline"
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>

                      {historialId === a.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={8} className="px-4 py-3">
                            <p className="mb-2 text-xs font-medium text-slate-600">Historial de modificaciones</p>
                            {historialQ.isLoading && <p className="text-xs text-slate-400">Cargando...</p>}
                            {historialQ.data?.length === 0 && <p className="text-xs text-slate-400">Todavía no se registró ninguna edición.</p>}
                            <ul className="space-y-1">
                              {historialQ.data?.map((h) => (
                                <li key={h.id} className="text-xs text-slate-600">
                                  <span className="font-mono-data text-slate-400">{new Date(h.fecha).toLocaleString('es-AR')}</span>{' '}
                                  — <strong>{h.usuarioNombre ?? h.usuarioEmail ?? 'alguien'}</strong> cambió <strong>{h.campo}</strong>:{' '}
                                  <span className="text-red-500 line-through">{h.valorAnterior}</span> → <span className="text-green-600">{h.valorNuevo}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}

                      {editingId === a.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <label className="flex flex-col text-xs text-slate-500">
                                Código interno
                                <input value={editForm.codigoInterno} onChange={(e) => setEditForm({ ...editForm, codigoInterno: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Patente
                                <input value={editForm.patente} onChange={(e) => setEditForm({ ...editForm, patente: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                              </label>
                              <label className="flex flex-col text-xs text-slate-500 sm:col-span-2">
                                Nombre
                                <input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Categoría
                                <select value={editForm.categoria}
                                  onChange={(e) => {
                                    const categoria = e.target.value as CategoriaActivo;
                                    setEditForm({ ...editForm, categoria, subgrupo: SUBGRUPOS[categoria][0] });
                                  }}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                                  {(Object.keys(CATEGORIA_LABEL) as CategoriaActivo[]).map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
                                </select>
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Subgrupo
                                <select value={editForm.subgrupo} onChange={(e) => setEditForm({ ...editForm, subgrupo: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                                  {SUBGRUPOS[editForm.categoria].map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Marca
                                <select value={editForm.marca ?? ''} onChange={(e) => setEditForm({ ...editForm, marca: e.target.value } as any)}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                                  <option value="">Marca...</option>
                                  {MARCAS[editForm.categoria].map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Modelo
                                <input value={editForm.modelo ?? ''} onChange={(e) => setEditForm({ ...editForm, modelo: e.target.value.toUpperCase() } as any)}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase text-slate-900" />
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Año
                                <input type="number" value={editForm.anio ?? ''} onChange={(e) => setEditForm({ ...editForm, anio: e.target.value } as any)}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Tipo de combustible
                                <select value={editForm.tipoCombustible} onChange={(e) => setEditForm({ ...editForm, tipoCombustible: e.target.value as TipoCombustibleCarga })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                                  {Object.entries(combustibleLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Centro de costo
                                <select value={editForm.centroCostoId} onChange={(e) => setEditForm({ ...editForm, centroCostoId: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                                  <option value="">Sin asignar</option>
                                  {centrosQ.data?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Propietario
                                <select value={editForm.propietarioId} onChange={(e) => setEditForm({ ...editForm, propietarioId: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                                  <option value="">Sin asignar</option>
                                  {propietariosQ.data?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Responsable
                                <input value={editForm.responsableNombre} onChange={(e) => setEditForm({ ...editForm, responsableNombre: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Capacidad tanque (L)
                                <input type="number" value={editForm.capacidadTanqueLitros} onChange={(e) => setEditForm({ ...editForm, capacidadTanqueLitros: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
                              </label>
                              <label className="flex flex-col text-xs text-slate-500">
                                Estado
                                <select value={editForm.estado}
                                  onChange={(e) => setEditForm({ ...editForm, estado: e.target.value as EstadoActivo })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                                  {(Object.keys(ESTADO_LABEL) as EstadoActivo[]).map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
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
                              <label className="flex flex-col text-xs text-slate-500 sm:col-span-2">
                                Observaciones
                                <textarea value={editForm.observaciones} onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                                  className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900" rows={1} />
                              </label>
                            </div>
                            <button onClick={() => editar.mutate(a)} disabled={editar.isPending}
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

      {/* Catálogo de propietarios, discreto al pie */}
      <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-3">
        <p className="mb-2 text-xs text-slate-500">Catálogo de propietarios</p>
        <div className="flex flex-wrap items-center gap-2">
          {propietariosQ.data?.length === 0 && (
            <button onClick={() => seedProp.mutate()} disabled={seedProp.isPending}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
              Cargar catálogo básico (Empresa, Alquilado, Cliente, Contratista)
            </button>
          )}
          {propietariosQ.data?.map((p) => (
            <span key={p.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{p.nombre}</span>
          ))}
          <input placeholder="Agregar propietario..." value={nuevoPropietario} onChange={(e) => setNuevoPropietario(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
          <button
            onClick={() => nuevoPropietario.trim() && crearPropietarioRapido.mutate(nuevoPropietario.trim())}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            + Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
