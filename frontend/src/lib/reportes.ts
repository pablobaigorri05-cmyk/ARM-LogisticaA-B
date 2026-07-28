import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { listarSolicitudes } from './solicitudes';
import { listarOrdenes } from './ordenesCarga';
import { listarMovimientosBatan } from './batan';
import { agregarEncabezadoMarca, aplicarPieATodasLasPaginas } from './pdfMarca';

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

export type FuenteReporte = 'solicitudes' | 'ordenes' | 'entregas';

export interface FiltrosReporte {
  fuente: FuenteReporte;
  desde?: number;
  hasta?: number;
  centroCostoId?: string;
  activoCodigo?: string;
}

// Antes juntaba Solicitudes + Órdenes + Entregas en un solo listado, pero
// eso duplica el litraje: una Orden de Carga sale de una Solicitud, así
// que son el mismo litro contado dos veces. Ahora hay que elegir UNA
// fuente por vez — es la corrección que pediste.
export async function obtenerFilasReporte(filtros: FiltrosReporte): Promise<FilaReporte[]> {
  let filas: FilaReporte[] = [];

  if (filtros.fuente === 'solicitudes') {
    const solicitudes = await listarSolicitudes();
    filas = solicitudes.map((s) => ({
      fecha: s.fecha,
      tipo: 'Solicitud' as const,
      numero: `SC-${String(s.numero ?? 0).padStart(6, '0')}`,
      activoCodigo: s.activoCodigo,
      centroCostoId: s.centroCostoId,
      centroCostoNombre: s.centroCostoNombre,
      litros: s.litrosSolicitados,
      estado: s.estado,
    }));
  } else if (filtros.fuente === 'ordenes') {
    const ordenes = await listarOrdenes();
    filas = ordenes.map((o) => ({
      fecha: o.fecha,
      tipo: 'Orden de carga' as const,
      numero: `OC-${String(o.numero ?? 0).padStart(6, '0')}`,
      activoCodigo: o.activoCodigo,
      centroCostoId: o.centroCostoId,
      centroCostoNombre: o.centroCostoNombre,
      litros: o.cantidadAutorizada,
      estado: o.estado,
    }));
  } else {
    const movimientos = await listarMovimientosBatan();
    filas = movimientos.map((m) => ({
      fecha: m.fecha,
      tipo: 'Entrega Batán' as const,
      numero: '—',
      activoCodigo: m.activoDestinoCodigo,
      centroCostoId: m.centroCostoId,
      centroCostoNombre: m.centroCostoNombre,
      litros: m.litrosEntregados,
      estado: undefined,
    }));
  }

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
  let y = agregarEncabezadoMarca(doc, margin) + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 118, 110); // teal-700
  doc.text('Reporte de combustible', margin, y);
  doc.setTextColor(0);
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

  function filaHeader(yPos: number) {
    doc.setFillColor(13, 148, 136);
    doc.rect(margin, yPos - 4.5, 266, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255);
    let x = margin + 1;
    cols.forEach((c) => { doc.text(c.header, x, yPos); x += c.w; });
    doc.setTextColor(0);
  }

  function fila(yPos: number, valores: string[]) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    let x = margin;
    valores.forEach((v, i) => {
      doc.text(v, x, yPos);
      x += cols[i].w;
    });
  }

  filaHeader(y);
  y += 6;

  for (const f of filas) {
    if (y > 190) {
      doc.addPage();
      y = agregarEncabezadoMarca(doc, margin) + 10;
      filaHeader(y);
      y += 6;
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

  aplicarPieATodasLasPaginas(doc);
  doc.save(`reporte-combustible-${new Date().toISOString().slice(0, 10)}.pdf`);
}
