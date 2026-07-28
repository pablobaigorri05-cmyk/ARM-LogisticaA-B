// Espejo del modelo de datos de /modelo-datos-combustible.md, adaptado a
// colecciones de Firestore. Las relaciones que antes eran FK ahora son
// simplemente el id del doc relacionado guardado como string.

export type CategoriaActivo = 'automoviles' | 'camionetas' | 'maquinas' | 'otros';
export type EstadoActivo = 'activo' | 'baja' | 'en_mantenimiento' | 'inactivo';
export type UnidadMedidaConsumo = 'km' | 'horas' | 'no_aplica';

export const SUBGRUPOS: Record<CategoriaActivo, string[]> = {
  automoviles: ['Auto', 'Sedán', 'Minibus'],
  camionetas: ['Cabina simple', 'Cabina simple 4x2', 'Doble cabina', 'Doble cabina 4x4'],
  maquinas: [
    'Camión chasis', 'Camión chasis (volcador)', 'Camión hormigonero', 'Camión regador', 'Camión tractor',
    'Cargadora frontal', 'Excavadora', 'Mini excavadora', 'Mini cargadora', 'Motoniveladora',
    'Retropala', 'Retroexcavadora', 'Rodillo compactador', 'Topadora', 'Vibro propulsado', 'Semirremolque',
  ],
  otros: ['Grupo electrógeno', 'Motoguadaña', 'Plancha compactadora', 'Hidrogrúa', 'Aserradora', 'Batán', 'Planta clasificadora', 'Tractor agrícola', 'Otro equipo'],
};

export const CATEGORIA_LABEL: Record<CategoriaActivo, string> = {
  automoviles: 'Automóviles',
  camionetas: 'Camionetas',
  maquinas: 'Máquinas',
  otros: 'Otros',
};

// Catálogo de marcas por categoría — editable acá mismo si falta alguna.
export const MARCAS: Record<CategoriaActivo, string[]> = {
  automoviles: ['Toyota', 'Ford', 'Chevrolet', 'Renault', 'Volkswagen', 'Fiat', 'Peugeot', 'Nissan', 'Honda', 'Citroën'],
  camionetas: ['Toyota', 'Ford', 'Volkswagen', 'Chevrolet', 'Nissan', 'Renault', 'Fiat', 'Mitsubishi', 'RAM'],
  maquinas: [
    'Caterpillar', 'Komatsu', 'John Deere', 'Case', 'New Holland', 'Volvo', 'JCB', 'Hyundai', 'Liebherr',
    'Iveco', 'Scania', 'Mercedes-Benz', 'Volkswagen', 'Chevrolet', 'Dynapac', 'Fiori', 'Patronelli',
    'Randon', 'Valtra', 'Longking',
  ],
  otros: ['Genelec', 'Stihl', 'Honda', 'Yamaha', 'Bosch', 'Wacker Neuson', 'Pramac', 'Husqvarna'],
};

export interface Activo {
  id: string;
  categoria: CategoriaActivo;
  subgrupo: string; // tipo específico dentro de la categoría (ej. "Doble cabina 4x4")
  codigoInterno: string; // "Interno" en el formulario real (ej. C-101, G-105, MC-101)
  nombre: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  numeroChasis?: string;
  numeroMotor?: string;
  patente?: string; // "Domio" en el formulario real, vacío si no aplica
  capacidadTanqueLitros?: number;
  unidadMedidaConsumo: UnidadMedidaConsumo;
  odometroHorometroActual?: number;
  estado: EstadoActivo;
  centroCostoId?: string;
  centroCostoNombre?: string; // desnormalizado para no tener que hacer join al listar
  fechaAlta?: number;
  lugarCompra?: string;
  titular?: string; // razón social a nombre de quién está el activo (ej. "ARMEGOM SA")
  // Fechas de vencimiento, no booleanos: "vigente" = vencimiento > hoy,
  // calculado al vuelo (ver nota en modelo-datos-combustible.md).
  seguroVencimiento?: number;
  vtvVencimiento?: number;
  ultimoServiceFecha?: number;
  proximoServiceFecha?: number;
  // El Batán (y cualquier otro tanque móvil futuro) es un Activo más, no
  // una tabla aparte — estos tres campos solo se completan cuando
  // esTanqueMovil = true.
  esTanqueMovil?: boolean;
  capacidadLitros?: number;
  stockActualLitros?: number;
  createdAt?: number;
}

export function estaVigente(vencimiento?: number): boolean {
  return !!vencimiento && vencimiento > Date.now();
}

// Alerta si vence en menos de `dias` (o ya venció). Se usa para seguro,
// VTV y ahora también para el próximo service.
export function venceProntoOVencido(vencimiento?: number, dias = 15): boolean {
  if (!vencimiento) return false;
  return vencimiento < Date.now() + dias * 24 * 60 * 60 * 1000;
}

// Dos roles nada más: Administración ve y edita todo; Empleado solo
// entra al módulo de Solicitudes (para pedir combustible y ver sus
// propios pedidos), nada más.
export type RolUsuario = 'administracion' | 'empleado';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
}

// Tipo de centro de costo: el formulario real mezcla obras (proyectos con
// fecha de inicio/fin) y áreas internas (Gerencia, Taller, RRHH) en un
// mismo desplegable "Obra". Se modelan juntos pero con este campo para
// poder filtrar/reportar por separado si hace falta.
export type TipoCentroCosto = 'obra' | 'area_interna';
export type EstadoCentroCosto = 'planificada' | 'en_curso' | 'finalizada' | 'activo';

export interface CentroCosto {
  id: string;
  codigo?: string;
  nombre: string;
  tipo: TipoCentroCosto;
  ubicacion?: string;
  estado: EstadoCentroCosto;
  activo: boolean;
}

export type TipoCombustibleCarga = 'diesel' | 'nafta' | 'gnc' | 'urea' | 'agua_destilada';

// Precio vigente por litro de cada tipo — se usa para calcular el gasto
// devengado apenas se pide/entrega combustible, sin esperar a la factura.
export interface PrecioCombustible {
  tipoCombustible: TipoCombustibleCarga;
  precioPorLitro: number;
  actualizadoEn: number;
}

// Movimiento del Batán: entrega de litros desde el tanque móvil hacia
// otro activo (vehículo/maquinaria). Es el libro mayor único que pedía
// tu documento — cada entrega queda acá, descuenta el stock del Batán,
// y de acá salen los reportes de consumo por vehículo/obra/responsable.
export interface MovimientoBatan {
  id: string;
  batanId: string; // id del Activo que es el Batán
  activoDestinoId: string;
  activoDestinoCodigo?: string;
  personaId?: string; // responsable
  centroCostoId?: string;
  centroCostoNombre?: string;
  litrosEntregados: number;
  tipoCombustible?: TipoCombustibleCarga;
  costoEstimado?: number;
  kilometros?: number;
  observaciones?: string;
  fecha: number;
  stockResultante: number;
}

export interface Proveedor {
  id: string;
  nombre: string;
  cuit?: string;
  contacto?: string;
  activo: boolean;
}

// ==================== Solicitudes de Combustible → Órdenes de Carga ====================
// Capa que precede a las Cargas: primero se pide combustible (Solicitud),
// alguien la aprueba, se convierte en una Orden de Carga (que es lo que se
// manda al proveedor), y recién cuando el proveedor entrega, se registra
// la Carga real (lo que ya teníamos). Las tres quedan encadenadas por id.

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'convertida_en_orden' | 'anulada';

export interface SolicitudCombustible {
  id: string;
  numero?: number; // correlativo autogenerado → se muestra como SC-000001
  fecha: number;
  fechaNecesidad?: number;
  activoId: string;
  activoCodigo?: string;
  personaId?: string; // responsable / chofer / operador
  kilometros?: number;
  litrosSolicitados: number;
  tipoCombustible: TipoCombustibleCarga;
  costoEstimado?: number; // litrosSolicitados × precio vigente al momento de pedir
  centroCostoId: string; // obligatorio, a diferencia de Carga
  centroCostoNombre?: string;
  observaciones?: string;
  usuarioSolicitanteEmail?: string;
  usuarioSolicitanteNombre?: string;
  estado: EstadoSolicitud;
}

export type EstadoOrdenCarga = 'pendiente' | 'enviada' | 'utilizada' | 'vencida' | 'cancelada';

export interface OrdenCarga {
  id: string;
  numero?: number; // correlativo autogenerado → se muestra como OC-000001
  solicitudId: string; // toda Orden viene de una Solicitud, nunca se carga suelta
  solicitudNumero?: number;
  fecha: number;
  fechaNecesidad?: number;
  activoId: string;
  activoCodigo?: string;
  personaId?: string;
  kilometros?: number;
  cantidadAutorizada: number;
  tipoCombustible: TipoCombustibleCarga;
  centroCostoId?: string;
  centroCostoNombre?: string;
  proveedorId?: string;
  proveedorNombre?: string;
  observaciones?: string;
  estado: EstadoOrdenCarga;
}

export interface Persona {
  id: string;
  nombre: string;
  dni: string;
  tipo: 'chofer' | 'operador' | 'ambos';
  telefono?: string;
  estado: 'activo' | 'inactivo';
}


