import { collection, doc, getDocs, orderBy, query, runTransaction, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { Activo, MovimientoBatan, TipoCombustibleCarga } from './types';

// Cualquier Activo marcado esTanqueMovil = true funciona como "un Batán"
// — hoy hay uno solo, pero el modelo soporta sumar más sin cambiar código.
export async function listarTanquesMoviles(): Promise<Activo[]> {
  const snap = await getDocs(query(collection(db, 'activos'), where('esTanqueMovil', '==', true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Activo);
}

export async function listarMovimientosBatan(): Promise<MovimientoBatan[]> {
  const snap = await getDocs(query(collection(db, 'movimientosBatan'), orderBy('fecha', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MovimientoBatan);
}

// Entrega de litros del Batán a otro activo — descuenta el stock del
// Batán en la misma transacción que registra el movimiento, y no deja
// entregar más litros de los que hay (regla de negocio del pedido).
export async function registrarMovimientoBatan(input: {
  batanId: string;
  activoDestinoId: string;
  activoDestinoCodigo?: string;
  personaId?: string;
  centroCostoId?: string;
  centroCostoNombre?: string;
  litrosEntregados: number;
  tipoCombustible?: TipoCombustibleCarga;
  kilometros?: number;
  observaciones?: string;
}) {
  return runTransaction(db, async (tx) => {
    const batanRef = doc(db, 'activos', input.batanId);
    const tipoCombustible = input.tipoCombustible ?? 'diesel';
    const precioRef = doc(db, 'preciosCombustible', tipoCombustible);
    const [batanSnap, precioSnap] = await Promise.all([tx.get(batanRef), tx.get(precioRef)]);
    if (!batanSnap.exists()) throw new Error('Batán no encontrado');

    const stockActual = (batanSnap.data().stockActualLitros as number) ?? 0;
    if (stockActual < input.litrosEntregados) {
      throw new Error(`Stock insuficiente en el Batán: quedan ${stockActual} L`);
    }
    const stockResultante = stockActual - input.litrosEntregados;
    tx.update(batanRef, { stockActualLitros: stockResultante });

    const precioPorLitro = precioSnap.exists() ? (precioSnap.data().precioPorLitro as number) : 0;
    const costoEstimado = precioPorLitro > 0 ? input.litrosEntregados * precioPorLitro : undefined;

    const movRef = doc(collection(db, 'movimientosBatan'));
    tx.set(movRef, { ...input, tipoCombustible, costoEstimado, fecha: Date.now(), stockResultante });

    if (input.kilometros !== undefined) {
      tx.update(doc(db, 'activos', input.activoDestinoId), { odometroHorometroActual: input.kilometros });
    }

    return movRef.id;
  });
}

// Cuando el proveedor entrega lo pedido en una Orden de Carga: si el
// activo de la orden ES el Batán, esos litros suman a su stock (recién
// ahí hay algo para repartir). Si es un vehículo normal, no hay stock
// que tocar — se cargó directo en el surtidor.
export async function confirmarEntregaOrden(activoId: string, litros: number) {
  const activoRef = doc(db, 'activos', activoId);
  const snap = await getDocs(query(collection(db, 'activos'), where('__name__', '==', activoId)));
  const activo = snap.docs[0]?.data() as Activo | undefined;
  if (activo?.esTanqueMovil) {
    const stockActual = activo.stockActualLitros ?? 0;
    await updateDoc(activoRef, { stockActualLitros: stockActual + litros });
  }
}
