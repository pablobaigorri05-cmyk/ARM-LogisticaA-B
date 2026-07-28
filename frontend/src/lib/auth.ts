import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Usuario } from './types';

export async function login(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
}

// El perfil (nombre, rol) vive en Firestore en /usuarios/{uid} — Firebase
// Auth solo maneja el email/contraseña, no roles ni nombre.
export async function obtenerPerfilUsuario(uid: string): Promise<Usuario | null> {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  // El campo "rol" a veces se carga a mano en la consola de Firestore, así
  // que toleramos espacios de más o mayúsculas (" Administracion " también
  // cuenta) en vez de exigir el texto exacto letra por letra.
  const rolNormalizado = typeof data.rol === 'string'
    ? data.rol.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : data.rol;
  return { id: snap.id, ...data, rol: rolNormalizado } as Usuario;
}
