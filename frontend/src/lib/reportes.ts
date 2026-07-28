import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { listarSolicitudes } from './solicitudes';
import { listarOrdenes } from './ordenesCarga';
import { listarMovimientosBatan } from './batan';

export interface FilaReporte {
  fecha: number;
  tipo: 'Solicitud' | 'Orden de carga' | 'Entrega Batán';
  numero: string;
  activoCodigo?: string;
  centroCostoId?: string;
  centroCostoNombre?: string;
  litros: number;
  estado?: string;
}

export interface FiltrosReporte {
  desde?: number;
  hasta?: number;
  centroCostoId?: string;
  activoCodigo?: string;
}

// Junta las tres fuentes en un único "libro mayor" de combustible para
// reportear — es la vista consolidada que pedías, sin tener que mirar
// tres pantallas distintas.
export async function obtenerFilasReporte(filtros: FiltrosReporte): Promise<FilaReporte[]> {
  const [solicitudes, ordenes, movimientos] = await Promise.all([
    listarSolicitudes(),
    listarOrdenes(),
    listarMovimientosBatan(),
  ]);

  let filas: FilaReporte[] = [
    ...solicitudes.map((s) => ({
      fecha: s.fecha,
      tipo: 'Solicitud' as const,
      numero: `SC-${String(s.numero ?? 0).padStart(6, '0')}`,
      activoCodigo: s.activoCodigo,
      centroCostoId: s.centroCostoId,
      centroCostoNombre: s.centroCostoNombre,
      litros: s.litrosSolicitados,
      estado: s.estado,
    })),
    ...ordenes.map((o) => ({
      fecha: o.fecha,
      tipo: 'Orden de carga' as const,
      numero: `OC-${String(o.numero ?? 0).padStart(6, '0')}`,
      activoCodigo: o.activoCodigo,
      centroCostoId: o.centroCostoId,
      centroCostoNombre: o.centroCostoNombre,
      litros: o.cantidadAutorizada,
      estado: o.estado,
    })),
    ...movimientos.map((m) => ({
      fecha: m.fecha,
      tipo: 'Entrega Batán' as const,
      numero: '—',
      activoCodigo: m.activoDestinoCodigo,
      centroCostoId: m.centroCostoId,
      centroCostoNombre: m.centroCostoNombre,
      litros: m.litrosEntregados,
      estado: undefined,
    })),
  ];

  if (filtros.desde) filas = filas.filter((f) => f.fecha >= filtros.desde!);
  if (filtros.hasta) filas = filas.filter((f) => f.fecha <= filtros.hasta!);
  if (filtros.centroCostoId) filas = filas.filter((f) => f.centroCostoId === filtros.centroCostoId);
  if (filtros.activoCodigo) filas = filas.filter((f) => f.activoCodigo === filtros.activoCodigo);

  return filas.sort((a, b) => b.fecha - a.fecha);
}

export function exportarReporteExcel(filas: FilaReporte[]) {
  const datos = filas.map((f) => ({
    Fecha: new Date(f.fecha).toLocaleDateString('es-AR'),
    Tipo: f.tipo,
    'Nº': f.numero,
    Activo: f.activoCodigo ?? '',
    'Centro de costo': f.centroCostoNombre ?? '',
    Litros: f.litros,
    Estado: f.estado ?? '',
  }));
  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Reporte combustible');
  XLSX.writeFile(libro, `reporte-combustible-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportarReportePDF(filas: FilaReporte[], filtrosLabel: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const margin = 14;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Reporte de combustible', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(filtrosLabel, margin, y);
  y += 4;
  doc.text(`Total: ${filas.reduce((a, f) => a + f.litros, 0).toLocaleString('es-AR')} L en ${filas.length} movimientos`, margin, y);
  y += 8;

  const cols = [
    { header: 'Fecha', w: 24 },
    { header: 'Tipo', w: 34 },
    { header: 'Nº', w: 26 },
    { header: 'Activo', w: 26 },
    { header: 'Centro de costo', w: 70 },
    { header: 'Litros', w: 22 },
    { header: 'Estado', w: 30 },
  ];

  function fila(y: number, valores: string[], bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    let x = margin;
    valores.forEach((v, i) => {
      doc.text(v, x, y);
      x += cols[i].w;
    });
  }

  fila(y, cols.map((c) => c.header), true);
  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, 280, y);
  y += 5;

  for (const f of filas) {
    if (y > 200) {
      doc.addPage();
      y = margin;
    }
    fila(y, [
      new Date(f.fecha).toLocaleDateString('es-AR'),
      f.tipo,
      f.numero,
      f.activoCodigo ?? '—',
      (f.centroCostoNombre ?? '—').slice(0, 40),
      `${f.litros} L`,
      f.estado ?? '—',
    ]);
    y += 6;
  }

  doc.save(`reporte-combustible-${new Date().toISOString().slice(0, 10)}.pdf`);
}
