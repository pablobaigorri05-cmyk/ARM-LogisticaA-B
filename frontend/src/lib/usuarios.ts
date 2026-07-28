import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
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
