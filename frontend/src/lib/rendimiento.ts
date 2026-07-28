import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, where, runTransaction, limit } from 'firebase/firestore';
import { db } from './firebase';
import { Activo, ConfiguracionRendimiento, NivelTanque, RegistroConsumo } from './types';

const ref = collection(db, 'registrosConsumo');

export async function listarRegistrosConsumo(): Promise<RegistroConsumo[]> {
  const snap = await getDocs(query(ref, orderBy('fecha', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegistroConsumo);
}

export async function listarRegistrosPorActivo(activoId: string): Promise<RegistroConsumo[]> {
  const snap = await getDocs(query(ref, where('activoId', '==', activoId), orderBy('fecha', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegistroConsumo);
}

export async function obtenerConfiguracionRendimiento(): Promise<ConfiguracionRendimiento> {
  const snap = await getDoc(doc(db, 'configuracion', 'rendimiento'));
  return snap.exists() ? (snap.data() as ConfiguracionRendimiento) : { umbralDesviacionPct: 10 };
}

export async function guardarConfiguracionRendimiento(umbralDesviacionPct: number) {
  return setDoc(doc(db, 'configuracion', 'rendimiento'), { umbralDesviacionPct });
}

// Promedio histórico de litros/100km de un activo, sin contar el
// registro que se está por crear — es contra lo que se compara cada
// carga nueva para detectar un desvío.
async function promedioHistorico(activoId: string, excluirId?: string): Promise<number | null> {
  const registros = await listarRegistrosPorActivo(activoId);
  const validos = registros.filter((r) => r.id !== excluirId && r.litrosPor100km !== undefined);
  if (validos.length === 0) return null;
  return validos.reduce((acc, r) => acc + (r.litrosPor100km ?? 0), 0) / validos.length;
}

interface InputConfirmarEntrega {
  activoId: string;
  activoCodigo?: string;
  ordenCargaId: string;
  odometro: number;
  litros: number;
  nivelTanqueAntes?: NivelTanque;
  centroCostoId?: string;
  centroCostoNombre?: string;
  proveedorNombre?: string;
  responsableNombre?: string;
}

// El corazón del módulo: se llama al confirmar la entrega de una Orden
// de Carga. Busca la carga anterior del mismo activo (por odómetro real,
// nunca por el de la Solicitud), calcula km recorridos y litros/100km,
// los compara contra el promedio histórico del equipo, y detecta
// inconsistencias entre el nivel de tanque declarado y los litros
// cargados.
export async function registrarConsumo(input: InputConfirmarEntrega) {
  const [ultimoSnap, activoSnap, config] = await Promise.all([
    getDocs(query(ref, where('activoId', '==', input.activoId), orderBy('fecha', 'desc'), limit(1))),
    getDoc(doc(db, 'activos', input.activoId)),
    obtenerConfiguracionRendimiento(),
  ]);

  const anterior = ultimoSnap.docs[0]?.data() as RegistroConsumo | undefined;
  const activo = activoSnap.data() as Activo | undefined;

  let kmRecorridos: number | undefined;
  let litrosPorKm: number | undefined;
  let litrosPor100km: number | undefined;

  if (anterior?.odometro !== undefined && input.odometro > anterior.odometro) {
    kmRecorridos = input.odometro - anterior.odometro;
    litrosPorKm = input.litros / kmRecorridos;
    litrosPor100km = litrosPorKm * 100;
  }

  // Alerta de desvío: solo se puede calcular si ya hay promedio histórico
  // Y esta carga tiene litros/100km calculado.
  let alertaConsumo = false;
  if (litrosPor100km !== undefined) {
    const promedio = await promedioHistorico(input.activoId);
    if (promedio !== null && promedio > 0) {
      const desvioPct = Math.abs(litrosPor100km - promedio) / promedio * 100;
      alertaConsumo = desvioPct > config.umbralDesviacionPct;
    }
  }

  // Alerta de tanque: cruza capacidad declarada del activo, nivel antes
  // de cargar y litros realmente cargados.
  let alertaTanque: string | undefined;
  if (activo?.capacidadTanqueLitros) {
    if (input.litros > activo.capacidadTanqueLitros) {
      alertaTanque = `Cargó ${input.litros} L pero el tanque es de ${activo.capacidadTanqueLitros} L — revisar.`;
    } else if (input.nivelTanqueAntes === 'vacio' && input.litros < activo.capacidadTanqueLitros * 0.6) {
      alertaTanque = `Tanque declarado "Vacío" pero solo cargó ${input.litros} L de ${activo.capacidadTanqueLitros} L — revisar.`;
    } else if (input.nivelTanqueAntes === 'lleno' && input.litros > activo.capacidadTanqueLitros * 0.15) {
      alertaTanque = `Tanque declarado "Lleno" pero cargó ${input.litros} L — revisar.`;
    }
  }

  return runTransaction(db, async (tx) => {
    const registroRef = doc(collection(db, 'registrosConsumo'));
    tx.set(registroRef, {
      activoId: input.activoId,
      activoCodigo: input.activoCodigo,
      ordenCargaId: input.ordenCargaId,
      fecha: Date.now(),
      odometro: input.odometro,
      odometroAnterior: anterior?.odometro,
      kmRecorridos,
      litros: input.litros,
      litrosPorKm,
      litrosPor100km,
      nivelTanqueAntes: input.nivelTanqueAntes,
      alertaConsumo,
      alertaTanque,
      centroCostoId: input.centroCostoId,
      centroCostoNombre: input.centroCostoNombre,
      proveedorNombre: input.proveedorNombre,
      responsableNombre: input.responsableNombre,
    });
    tx.update(doc(db, 'activos', input.activoId), { odometroHorometroActual: input.odometro });
    return registroRef.id;
  });
}
