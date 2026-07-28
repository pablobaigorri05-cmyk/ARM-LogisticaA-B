import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { EstadoOrdenCarga, OrdenCarga, SolicitudCombustible } from './types';

const ref = collection(db, 'ordenesCarga');

export async function listarOrdenes(): Promise<OrdenCarga[]> {
  const snap = await getDocs(query(ref, orderBy('fecha', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OrdenCarga);
}

// Solo las órdenes "enviada" están disponibles para convertirse en una
// Carga real — es el filtro que usa la pantalla de Cargas.
export async function listarOrdenesEnviadas(): Promise<OrdenCarga[]> {
  const snap = await getDocs(query(ref, where('estado', '==', 'enviada')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OrdenCarga);
}

// Regla de negocio no negociable del pedido: "No pueden existir Órdenes
// sin Solicitud". Por eso esta es la ÚNICA forma de crear una orden —
// copia los datos de la solicitud, no se cargan a mano.
export async function generarOrdenDesdeSolicitud(
  solicitudId: string,
  proveedorId: string,
  proveedorNombre: string,
) {
  return runTransaction(db, async (tx) => {
    const solicitudRef = doc(db, 'solicitudesCombustible', solicitudId);
    const solicitudSnap = await tx.get(solicitudRef);
    if (!solicitudSnap.exists()) throw new Error('Solicitud no encontrada');
    const solicitud = solicitudSnap.data() as SolicitudCombustible;
    if (solicitud.estado !== 'aprobada') {
      throw new Error('Solo se puede generar una Orden de Carga a partir de una solicitud aprobada');
    }

    const contadorRef = doc(db, 'contadores', 'ordenesCarga');
    const contadorSnap = await tx.get(contadorRef);
    const numero = (contadorSnap.exists() ? contadorSnap.data().ultimo : 0) + 1;
    tx.set(contadorRef, { ultimo: numero }, { merge: true });

    const ordenRef = doc(collection(db, 'ordenesCarga'));
    const orden: Omit<OrdenCarga, 'id'> = {
      numero,
      solicitudId,
      solicitudNumero: solicitud.numero,
      fecha: Date.now(),
      fechaNecesidad: solicitud.fechaNecesidad,
      activoId: solicitud.activoId,
      activoCodigo: solicitud.activoCodigo,
      personaId: solicitud.personaId,
      kilometros: solicitud.kilometros,
      cantidadAutorizada: solicitud.litrosSolicitados,
      tipoCombustible: solicitud.tipoCombustible,
      centroCostoId: solicitud.centroCostoId,
      centroCostoNombre: solicitud.centroCostoNombre,
      proveedorId,
      proveedorNombre,
      observaciones: solicitud.observaciones,
      estado: 'pendiente',
    };
    tx.set(ordenRef, orden);
    tx.update(solicitudRef, { estado: 'convertida_en_orden' });

    return { id: ordenRef.id, numero };
  });
}

export async function actualizarEstadoOrden(id: string, estado: EstadoOrdenCarga) {
  return updateDoc(doc(db, 'ordenesCarga', id), { estado });
}

export async function obtenerOrden(id: string): Promise<OrdenCarga | null> {
  const snap = await getDoc(doc(db, 'ordenesCarga', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as OrdenCarga) : null;
}
