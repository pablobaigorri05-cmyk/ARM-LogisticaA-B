import { addDoc, collection, getDocs, orderBy, query, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { CentroCosto } from './types';

const ref = collection(db, 'centrosCosto');

export async function listarCentrosCosto(): Promise<CentroCosto[]> {
  const snap = await getDocs(query(ref, orderBy('nombre')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CentroCosto);
}

export async function crearCentroCosto(data: Omit<CentroCosto, 'id'>) {
  return addDoc(ref, data);
}

// Lista real sacada del formulario "Orden de Carga de Combustible" de la
// empresa (campo "Obra"). Mezcla proyectos en ejecución con áreas internas
// — ver la nota de tipo en types.ts. Las que tienen nombre de cliente/obra
// reconocible se marcan `obra`; oficinas y áreas internas, `area_interna`.
const NOMBRES_OBRA = [
  'Bacheo - OSSE',
  'Soil - Veladero',
  'Civil - El Molle, Pachón - MOTOROLA',
  'Obras Varias',
  'Provision Genneia',
  'Provision de Asfalto',
  'Hualilan - Reservorio',
  'Minera El Pacifico - Jachal',
  'Trabajos Tempranos Veladero Fase 8',
  'Refacciones Chalet Cantoni',
  'Estacion Transformadora',
  'Hualilan - Prov Equipos',
  'ALQUILER DE EQUIPOS TRABAJOS TEMPRANOS VELADERO',
  'Provision Barrick F8',
  'Dirección Provincial de Vialidad',
  'Esc. Santurnino Salas',
  'Esc. Obispo Zapata',
  'Traslados Oficinas - Hualilan',
  'Calingasta - Caposos',
  'Genneia - Reparación de Hincas',
  'Hualilan - Colocación de Carteleria',
  'Franklin - Rawson',
  'Sala Nivel Inicial - Pachon',
  'Cancha Alianza',
  'Contegrand - Rep. Varias',
  'Genneia - Conformacion de Top Soil',
  'PTA - Ambiente',
  'Sistema de Riego - Barreal / Glencore',
  'Esc. Islas Malvinas - Zonda',
  'Quebrada de Zonda',
  'Limpieza y Mantenimiento de Rutas',
];

const NOMBRES_AREA_INTERNA = [
  'Oficina Administrativa',
  'Oficina Tecnica',
  'Oficina de RRHH',
  'Gerencia',
  'Taller - Repuestos',
  'Logistica',
  'Stock APARA',
];

export async function seedCentrosCosto() {
  const batch = writeBatch(db);
  NOMBRES_OBRA.forEach((nombre) => {
    batch.set(doc(ref), { nombre, tipo: 'obra', estado: 'en_curso', activo: true });
  });
  NOMBRES_AREA_INTERNA.forEach((nombre) => {
    batch.set(doc(ref), { nombre, tipo: 'area_interna', estado: 'activo', activo: true });
  });
  await batch.commit();
}

// Para cuando ya cargaste la lista una vez y solo agregaron algún centro
// nuevo (ej. "Stock APARA") — compara contra lo que ya existe y agrega
// únicamente lo que falta, sin duplicar nada.
export async function agregarCentrosFaltantes() {
  const existentes = new Set((await listarCentrosCosto()).map((c) => c.nombre.trim().toLowerCase()));
  const batch = writeBatch(db);
  let agregados = 0;
  NOMBRES_OBRA.forEach((nombre) => {
    if (!existentes.has(nombre.trim().toLowerCase())) {
      batch.set(doc(ref), { nombre, tipo: 'obra', estado: 'en_curso', activo: true });
      agregados++;
    }
  });
  NOMBRES_AREA_INTERNA.forEach((nombre) => {
    if (!existentes.has(nombre.trim().toLowerCase())) {
      batch.set(doc(ref), { nombre, tipo: 'area_interna', estado: 'activo', activo: true });
      agregados++;
    }
  });
  if (agregados > 0) await batch.commit();
  return agregados;
}
