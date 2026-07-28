import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Activo } from './types';

const activosRef = collection(db, 'activos');

export async function listarActivos(): Promise<Activo[]> {
  const snap = await getDocs(query(activosRef, orderBy('codigoInterno')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Activo);
}

export async function crearActivo(data: Omit<Activo, 'id'>) {
  return addDoc(activosRef, { ...data, createdAt: serverTimestamp() });
}

export async function actualizarActivo(id: string, data: Partial<Activo>) {
  return updateDoc(doc(db, 'activos', id), data);
}

// Borrado lógico: Firestore no tiene el concepto, así que lo modelamos
// como un update de estado en vez de un delete físico, igual que en el
// modelo relacional original.
export async function darDeBajaActivo(id: string) {
  return updateDoc(doc(db, 'activos', id), { estado: 'baja' });
}

export async function eliminarActivoFisico(id: string) {
  return deleteDoc(doc(db, 'activos', id));
}
