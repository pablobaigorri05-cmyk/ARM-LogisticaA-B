import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { PrecioCombustible, TipoCombustibleCarga } from './types';

const ref = collection(db, 'preciosCombustible');

export async function listarPrecios(): Promise<PrecioCombustible[]> {
  const snap = await getDocs(ref);
  return snap.docs.map((d) => d.data() as PrecioCombustible);
}

// El documento se guarda con el propio tipo de combustible como ID
// (ej. "diesel") — así siempre hay un único precio vigente por tipo, sin
// tener que andar buscando el más reciente entre varios históricos.
export async function guardarPrecio(tipoCombustible: TipoCombustibleCarga, precioPorLitro: number) {
  return setDoc(doc(ref, tipoCombustible), { tipoCombustible, precioPorLitro, actualizadoEn: Date.now() });
}

export async function obtenerPrecio(tipoCombustible: TipoCombustibleCarga): Promise<number> {
  const snap = await getDoc(doc(ref, tipoCombustible));
  return snap.exists() ? (snap.data().precioPorLitro as number) : 0;
}
