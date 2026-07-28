import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Todas las claves salen de variables de entorno (ver .env.example).
// En Netlify, se configuran en Site settings → Environment variables
// con los mismos nombres VITE_FIREBASE_*.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// ignoreUndefinedProperties: nuestros formularios mandan `undefined` en
// campos opcionales que no se completaron (ej. marca, modelo, patente).
// Firestore por defecto RECHAZA cualquier escritura que tenga un valor
// undefined — con esta opción, simplemente los omite en vez de tirar
// error. Sin esto, dar de alta un Activo (o una Solicitud, Orden, etc.)
// con algún campo opcional vacío fallaba en silencio.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

export const auth = getAuth(app);
