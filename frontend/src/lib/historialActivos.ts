import { collection, doc, getDocs, orderBy, query, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { HistorialCambioActivo } from './types';

const ref = collection(db, 'historialActivos');

export async function listarHistorialActivo(activoId: string): Promise<HistorialCambioActivo[]> {
  const snap = await getDocs(query(ref, where('activoId', '==', activoId), orderBy('fecha', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistorialCambioActivo);
}

const ETIQUETAS_CAMPO: Record<string, string> = {
  codigoInterno: 'Código interno',
  patente: 'Patente',
  nombre: 'Nombre',
  marca: 'Marca',
  modelo: 'Modelo',
  anio: 'Año',
  categoria: 'Categoría',
  subgrupo: 'Subgrupo',
  tipoCombustible: 'Tipo de combustible',
  centroCostoId: 'Centro de costo',
  responsableNombre: 'Responsable',
  estado: 'Estado',
  observaciones: 'Observaciones',
  propietarioId: 'Propietario',
  seguroVencimiento: 'Vencimiento de seguro',
  vtvVencimiento: 'Vencimiento de VTV',
  proximoServiceFecha: 'Próximo service',
};

function formatearValor(campo: string, valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return '—';
  if (campo.toLowerCase().includes('fecha') || campo.toLowerCase().includes('vencimiento')) {
    return new Date(valor as number).toLocaleDateString('es-AR');
  }
  return String(valor);
}

// Compara el activo antes/después de una edición y arma un registro de
// historial por cada campo que realmente cambió — así el historial no se
// llena de ruido con campos que quedaron iguales.
export async function registrarCambiosActivo(
  activoId: string,
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  usuarioEmail?: string,
  usuarioNombre?: string,
) {
  const campos = Object.keys(ETIQUETAS_CAMPO).filter((c) => c in despues);
  const cambios = campos.filter((c) => (antes[c] ?? undefined) !== (despues[c] ?? undefined));
  if (cambios.length === 0) return;

  const batch = writeBatch(db);
  const fecha = Date.now();
  cambios.forEach((campo) => {
    batch.set(doc(ref), {
      activoId,
      usuarioEmail,
      usuarioNombre,
      fecha,
      campo: ETIQUETAS_CAMPO[campo] ?? campo,
      valorAnterior: formatearValor(campo, antes[campo]),
      valorNuevo: formatearValor(campo, despues[campo]),
    });
  });
  await batch.commit();
}
