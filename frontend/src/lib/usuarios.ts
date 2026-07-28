import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db, app } from './firebase';
import { RolUsuario, Usuario } from './types';

export async function listarUsuarios(): Promise<Usuario[]> {
  const snap = await getDocs(query(collection(db, 'usuarios'), orderBy('nombre')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Usuario);
}

// Crear un usuario nuevo con createUserWithEmailAndPassword loguea
// automáticamente a ESE usuario en la sesión actual — si lo hacés desde
// la sesión del admin, te saca a vos y te pone al usuario nuevo. El
// workaround estándar de Firebase es levantar una segunda instancia de
// la app solo para la creación, así la sesión del admin no se toca.
export async function crearUsuarioSinDesloguearAdmin(
  email: string,
  password: string,
  nombre: string,
  rol: RolUsuario,
) {
  const secondaryApp = initializeApp(app.options, 'admin-crea-usuario');
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, 'usuarios', cred.user.uid), { email, nombre, rol, activo: true });
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondaryApp);
  }
}

// Cambiar el rol o desactivar a alguien sin tocar su login — Firestore es
// la única fuente de verdad para permisos, así que alcanza con esto (no
// hace falta tocar Firebase Auth para esto).
export async function actualizarUsuario(id: string, data: Partial<Pick<Usuario, 'nombre' | 'rol' | 'activo'>>) {
  return updateDoc(doc(db, 'usuarios', id), data);
}

// El SDK del cliente no puede cambiarle la contraseña a OTRO usuario
// (eso requiere el Admin SDK, del lado del servidor) — lo que sí puede
// hacer es mandarle un mail para que la reestablezca solo.
export async function enviarResetPassword(email: string) {
  const { auth } = await import('./firebase');
  return sendPasswordResetEmail(auth, email);
}
