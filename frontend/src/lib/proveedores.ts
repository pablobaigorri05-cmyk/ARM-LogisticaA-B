import { addDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import { Proveedor } from './types';

const ref = collection(db, 'proveedores');

export async function listarProveedores(): Promise<Proveedor[]> {
  const snap = await getDocs(query(ref, orderBy('nombre')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Proveedor);
}

export async function crearProveedor(data: Omit<Proveedor, 'id'>) {
  return addDoc(ref, data);
}

// Por ahora la empresa solo trabaja con Axion Clavero, pero el modelo ya
// soporta agregar más proveedores sin tocar código — solo cargándolos acá.
export async function seedProveedorAxion() {
  return crearProveedor({ nombre: 'Axion Clavero', activo: true });
}
