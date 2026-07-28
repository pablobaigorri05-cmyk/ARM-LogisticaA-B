import { addDoc, collection, getDocs, orderBy, query, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { Propietario } from './types';

const ref = collection(db, 'propietarios');

export async function listarPropietarios(): Promise<Propietario[]> {
  const snap = await getDocs(query(ref, orderBy('nombre')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Propietario);
}

export async function crearPropietario(nombre: string) {
  return addDoc(ref, { nombre, activo: true });
}

const BASE = ['Empresa', 'Alquilado', 'Cliente', 'Contratista'];

export async function seedPropietarios() {
  const batch = writeBatch(db);
  BASE.forEach((nombre) => batch.set(doc(ref), { nombre, activo: true }));
  await batch.commit();
}
