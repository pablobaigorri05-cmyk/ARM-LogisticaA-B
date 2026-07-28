import { collection, doc, getDocs, orderBy, query, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { SolicitudCombustible } from './types';

const ref = collection(db, 'solicitudesCombustible');

export async function listarSolicitudes(): Promise<SolicitudCombustible[]> {
  const snap = await getDocs(query(ref, orderBy('fecha', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SolicitudCombustible);
}

// Mismo patrón de contador atómico que usamos para el Nº de carga: nunca
// se repite el número aunque dos personas pidan combustible a la vez.
// De paso, calcula el costo estimado con el precio vigente del tipo de
// combustible pedido — así el gasto empieza a devengarse desde el pedido,
// sin esperar la factura del proveedor.
export async function crearSolicitud(input: Omit<SolicitudCombustible, 'id' | 'numero' | 'fecha' | 'estado' | 'costoEstimado'>) {
  return runTransaction(db, async (tx) => {
    const contadorRef = doc(db, 'contadores', 'solicitudes');
    const precioRef = doc(db, 'preciosCombustible', input.tipoCombustible);
    const [contadorSnap, precioSnap] = await Promise.all([tx.get(contadorRef), tx.get(precioRef)]);

    const numero = (contadorSnap.exists() ? contadorSnap.data().ultimo : 0) + 1;
    tx.set(contadorRef, { ultimo: numero }, { merge: true });

    const precioPorLitro = precioSnap.exists() ? (precioSnap.data().precioPorLitro as number) : 0;
    const costoEstimado = precioPorLitro > 0 ? input.litrosSolicitados * precioPorLitro : undefined;

    const solicitudRef = doc(collection(db, 'solicitudesCombustible'));
    tx.set(solicitudRef, { ...input, numero, costoEstimado, fecha: Date.now(), estado: 'pendiente' });
    return { id: solicitudRef.id, numero };
  });
}

export async function aprobarSolicitud(id: string) {
  return updateDoc(doc(db, 'solicitudesCombustible', id), { estado: 'aprobada' });
}

export async function rechazarSolicitud(id: string) {
  return updateDoc(doc(db, 'solicitudesCombustible', id), { estado: 'rechazada' });
}

export async function anularSolicitud(id: string) {
  return updateDoc(doc(db, 'solicitudesCombustible', id), { estado: 'anulada' });
}
