import * as XLSX from 'xlsx';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { Activo, CategoriaActivo } from './types';

interface FilaExcel {
  EQUIPO?: string;
  MARCA?: string;
  MODELO?: string;
  TITULAR?: string;
  'AÑO'?: number;
  'N°INTERNO'?: string | number;
  'DOMINIO-INTERNO'?: string | number;
  'N° MOTOR'?: string | number;
  'N° CHASIS'?: string | number;
}

// Traduce el texto libre de la columna EQUIPO (con toda su variedad real:
// mayúsculas sueltas, espacios de más, sinónimos) a nuestra categoría y
// subgrupo. Usa coincidencia por palabras clave en vez de un diccionario
// exacto, porque en la práctica cada fila viene escrita un poco distinto.
function mapearEquipo(equipoRaw: string): { categoria: CategoriaActivo; subgrupo: string; unidad: 'km' | 'horas' } {
  const e = equipoRaw.toLowerCase().trim();

  if (e.includes('camioneta')) {
    let subgrupo = 'Doble cabina 4x4';
    if (e.includes('doble cabina') && e.includes('4x4')) subgrupo = 'Doble cabina 4x4';
    else if (e.includes('doble cabina')) subgrupo = 'Doble cabina';
    else if (e.includes('cabina simple') && e.includes('4x2')) subgrupo = 'Cabina simple 4x2';
    else if (e.includes('cabina simple')) subgrupo = 'Cabina simple';
    return { categoria: 'camionetas', subgrupo, unidad: 'km' };
  }
  if (e.includes('minibus')) return { categoria: 'automoviles', subgrupo: 'Minibus', unidad: 'km' };

  if (e.includes('camion') || e.includes('camión')) {
    let subgrupo = 'Camión chasis';
    if (e.includes('hormigonero')) subgrupo = 'Camión hormigonero';
    else if (e.includes('regador')) subgrupo = 'Camión regador';
    else if (e.includes('tractor') || e.includes('tector') || e.includes('traker') || e.includes('trakker')) subgrupo = 'Camión tractor';
    else if (e.includes('chasis') && e.includes('volcador')) subgrupo = 'Camión chasis (volcador)';
    else if (e.includes('chasis')) subgrupo = 'Camión chasis';
    return { categoria: 'maquinas', subgrupo, unidad: 'km' };
  }

  if (e.includes('cargadora') && e.includes('mini')) return { categoria: 'maquinas', subgrupo: 'Mini cargadora', unidad: 'horas' };
  if (e.includes('cargadora')) return { categoria: 'maquinas', subgrupo: 'Cargadora frontal', unidad: 'horas' };
  if (e.includes('excavadora') && e.includes('mini')) return { categoria: 'maquinas', subgrupo: 'Mini excavadora', unidad: 'horas' };
  if (e.includes('excavadora')) return { categoria: 'maquinas', subgrupo: 'Excavadora', unidad: 'horas' };
  if (e.includes('motoniveladora')) return { categoria: 'maquinas', subgrupo: 'Motoniveladora', unidad: 'horas' };
  if (e.includes('retropala')) return { categoria: 'maquinas', subgrupo: 'Retropala', unidad: 'horas' };
  if (e.includes('rodillo')) return { categoria: 'maquinas', subgrupo: 'Rodillo compactador', unidad: 'horas' };
  if (e.includes('semi')) return { categoria: 'maquinas', subgrupo: 'Semirremolque', unidad: 'km' };
  if (e.includes('topadora')) return { categoria: 'maquinas', subgrupo: 'Topadora', unidad: 'horas' };
  if (e.includes('vibro')) return { categoria: 'maquinas', subgrupo: 'Vibro propulsado', unidad: 'horas' };
  if (e.includes('planta')) return { categoria: 'otros', subgrupo: 'Planta clasificadora', unidad: 'horas' };
  if (e.includes('tractor') && e.includes('segadora')) return { categoria: 'otros', subgrupo: 'Tractor agrícola', unidad: 'horas' };

  return { categoria: 'otros', subgrupo: 'Otro equipo', unidad: 'no_aplica' };
}

function limpiar(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'no aplica' || s.toLowerCase() === 'n/p') return undefined;
  return s;
}

export interface FilaImportada {
  activo: Omit<Activo, 'id'>;
  fila: number;
  advertencia?: string;
}

// Lee el archivo tal cual lo exportan (columnas EQUIPO, MARCA, MODELO,
// TITULAR, AÑO, N°INTERNO, DOMINIO-INTERNO, N° MOTOR, N° CHASIS) y arma
// la lista de Activos lista para guardar, sin tocar Firestore todavía —
// separado a propósito para poder mostrar una previsualización antes de
// confirmar el alta masiva.
export async function leerExcelActivos(file: File): Promise<FilaImportada[]> {
  const buffer = await file.arrayBuffer();
  const libro = XLSX.read(buffer, { type: 'array' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<FilaExcel>(hoja, { defval: undefined });

  const resultado: FilaImportada[] = [];
  filas.forEach((f, i) => {
    const equipoRaw = limpiar(f.EQUIPO);
    const codigoInterno = limpiar(f['N°INTERNO']);
    if (!equipoRaw || !codigoInterno) return; // fila vacía o sin los datos mínimos

    const { categoria, subgrupo, unidad } = mapearEquipo(equipoRaw);
    const patenteRaw = limpiar(f['DOMINIO-INTERNO']);
    // La columna a veces trae la patente y a veces "OK"/un código interno
    // duplicado — si no tiene forma de patente real, no la guardamos.
    const patente = patenteRaw && !/^ok$/i.test(patenteRaw) ? patenteRaw : undefined;

    resultado.push({
      fila: i + 2,
      activo: {
        categoria,
        subgrupo,
        codigoInterno: codigoInterno.replace(/\s+/g, '-').toUpperCase(),
        nombre: `${limpiar(f.MARCA) ?? ''} ${limpiar(f.MODELO) ?? equipoRaw}`.trim() || equipoRaw,
        marca: limpiar(f.MARCA),
        modelo: limpiar(f.MODELO)?.toUpperCase(),
        anio: typeof f['AÑO'] === 'number' ? f['AÑO'] : undefined,
        patente,
        numeroMotor: limpiar(f['N° MOTOR']),
        numeroChasis: limpiar(f['N° CHASIS']),
        titular: limpiar(f.TITULAR),
        unidadMedidaConsumo: unidad,
        estado: 'activo',
        fechaAlta: Date.now(),
      },
    });
  });

  return resultado;
}

// Guarda todo en Firestore en lotes de a 400 (el máximo de un batch es
// 500 operaciones) para poder importar la flota completa de una.
export async function importarActivosEnLote(filas: FilaImportada[]) {
  const LOTE = 400;
  for (let i = 0; i < filas.length; i += LOTE) {
    const batch = writeBatch(db);
    filas.slice(i, i + LOTE).forEach((f) => {
      batch.set(doc(collection(db, 'activos')), f.activo);
    });
    await batch.commit();
  }
}
