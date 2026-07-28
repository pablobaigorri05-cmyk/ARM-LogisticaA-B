import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Activo, ESTADO_LABEL, estaVigente, CATEGORIA_LABEL, CategoriaActivo } from './types';

export function exportarActivosExcel(activos: Activo[]) {
  const datos = activos.map((a) => ({
    Interno: a.codigoInterno,
    Nombre: a.nombre,
    Categoría: CATEGORIA_LABEL[a.categoria],
    Subgrupo: a.subgrupo,
    Marca: a.marca ?? '',
    Modelo: a.modelo ?? '',
    Año: a.anio ?? '',
    Patente: a.patente ?? '',
    'Tipo combustible': a.tipoCombustible ?? '',
    Propietario: a.propietarioNombre ?? '',
    'Centro de costo': a.centroCostoNombre ?? '',
    Responsable: a.responsableNombre ?? '',
    Estado: ESTADO_LABEL[a.estado],
    'Seguro vence': a.seguroVencimiento ? new Date(a.seguroVencimiento).toLocaleDateString('es-AR') : '',
    'VTV vence': a.vtvVencimiento ? new Date(a.vtvVencimiento).toLocaleDateString('es-AR') : '',
    'Próximo service': a.proximoServiceFecha ? new Date(a.proximoServiceFecha).toLocaleDateString('es-AR') : '',
    Observaciones: a.observaciones ?? '',
  }));
  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Activos');
  XLSX.writeFile(libro, `activos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function agregarEncabezadoPie(doc: jsPDF, pagina: number, totalPaginas: number, filtrosLabel: string) {
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Listado de Activos', 14, 10);
  doc.text(new Date().toLocaleDateString('es-AR'), ancho - 14, 10, { align: 'right' });
  doc.text(filtrosLabel, 14, alto - 8);
  doc.text(`Página ${pagina} de ${totalPaginas}`, ancho - 14, alto - 8, { align: 'right' });
  doc.setTextColor(0);
}

// Listado en PDF con encabezado/pie en cada página y numeración —
// pensado para mandarle a Oficina Técnica. No incluye logo todavía (no
// tenemos el archivo); se puede sumar más adelante con doc.addImage.
export function exportarActivosPDF(activos: Activo[], filtrosLabel: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const margin = 14;
  let y = margin + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Listado de Activos', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Total: ${activos.length} activos`, margin, y);
  y += 8;

  const cols = [
    { header: 'Interno', w: 20 },
    { header: 'Nombre', w: 50 },
    { header: 'Categoría', w: 28 },
    { header: 'Patente', w: 22 },
    { header: 'Propietario', w: 26 },
    { header: 'Centro de costo', w: 55 },
    { header: 'Estado', w: 30 },
    { header: 'Seguro', w: 22 },
    { header: 'VTV', w: 22 },
  ];

  function filaHeader(yPos: number) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    let x = margin;
    cols.forEach((c) => { doc.text(c.header, x, yPos); x += c.w; });
    doc.setDrawColor(200);
    doc.line(margin, yPos + 2, 275, yPos + 2);
  }

  let pagina = 1;
  filaHeader(y);
  y += 6;

  for (const a of activos) {
    if (y > 190) {
      doc.addPage();
      pagina++;
      y = margin + 8;
      filaHeader(y);
      y += 6;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let x = margin;
    const valores = [
      a.codigoInterno,
      a.nombre.slice(0, 32),
      CATEGORIA_LABEL[a.categoria],
      a.patente ?? '—',
      a.propietarioNombre ?? '—',
      (a.centroCostoNombre ?? '—').slice(0, 38),
      ESTADO_LABEL[a.estado],
      a.seguroVencimiento ? (estaVigente(a.seguroVencimiento) ? 'Vigente' : 'Vencido') : '—',
      a.vtvVencimiento ? (estaVigente(a.vtvVencimiento) ? 'Vigente' : 'Vencido') : '—',
    ];
    valores.forEach((v, i) => { doc.text(String(v), x, y); x += cols[i].w; });
    y += 6;
  }

  const totalPaginas = pagina;
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    agregarEncabezadoPie(doc, p, totalPaginas, filtrosLabel);
  }

  doc.save(`activos-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Ficha individual de un activo — para inspecciones, auditorías o
// mandarle a un cliente. Junta todo lo que tenemos cargado de ese equipo.
export function generarFichaActivoPDF(activo: Activo) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Ficha de Activo', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Emitido el ${new Date().toLocaleDateString('es-AR')}`, margin, y);
  doc.setTextColor(0);
  y += 10;
  doc.setDrawColor(200);
  doc.line(margin, y, 190, y);
  y += 8;

  function seccion(titulo: string) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 5, 170, 7, 'F');
    doc.text(titulo, margin + 2, y);
    y += 9;
  }
  function fila(label: string, valor: string) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(valor || '—', margin + 55, y);
    y += 7;
  }

  seccion('Datos generales');
  fila('Nº interno', activo.codigoInterno);
  fila('Nombre', activo.nombre);
  fila('Patente', activo.patente ?? '—');
  fila('Marca / Modelo', `${activo.marca ?? '—'} / ${activo.modelo ?? '—'}`);
  fila('Año', activo.anio?.toString() ?? '—');
  fila('Categoría', `${CATEGORIA_LABEL[activo.categoria]} — ${activo.subgrupo}`);
  fila('Tipo de combustible', activo.tipoCombustible ?? '—');
  y += 3;

  seccion('Estado y asignación');
  fila('Estado', ESTADO_LABEL[activo.estado]);
  fila('Propietario', activo.propietarioNombre ?? '—');
  fila('Centro de costo', activo.centroCostoNombre ?? '—');
  fila('Responsable', activo.responsableNombre ?? '—');
  y += 3;

  seccion('Documentación');
  fila('Seguro vence', activo.seguroVencimiento ? new Date(activo.seguroVencimiento).toLocaleDateString('es-AR') : '—');
  fila('VTV vence', activo.vtvVencimiento ? new Date(activo.vtvVencimiento).toLocaleDateString('es-AR') : '—');
  fila('Próximo service', activo.proximoServiceFecha ? new Date(activo.proximoServiceFecha).toLocaleDateString('es-AR') : '—');
  y += 3;

  seccion('Información adicional');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const obs = doc.splitTextToSize(activo.observaciones || 'Sin observaciones.', 170);
  doc.text(obs, margin, y);

  doc.save(`ficha-${activo.codigoInterno}.pdf`);
}

export type FiltroActivos = {
  estado?: string;
  categoria?: CategoriaActivo | '';
  centroCostoId?: string;
  propietarioId?: string;
  vencimientosProximos?: boolean;
};
