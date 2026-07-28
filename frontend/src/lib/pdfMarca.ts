import { jsPDF } from 'jspdf';
import { LOGO_BASE64, MARCA } from './brand';

// Encabezado con el logo real de la empresa — se llama una vez por
// página. Devuelve el "y" desde donde puede seguir escribiendo el resto
// del documento sin pisarlo.
export function agregarEncabezadoMarca(doc: jsPDF, margin = 14): number {
  try {
    doc.addImage(LOGO_BASE64, 'PNG', margin, 8, 32, 12);
  } catch {
    // Si por algún motivo la imagen no carga, seguimos sin logo en vez
    // de romper la exportación entera.
  }
  return 26;
}

// Pie de página estándar: línea divisoria + firma del desarrollador +
// numeración. Se llama una vez por cada página ya generada (después de
// saber cuántas páginas tiene el documento en total).
export function agregarPiePaginaMarca(doc: jsPDF, pagina: number, totalPaginas: number) {
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220);
  doc.line(14, alto - 14, ancho - 14, alto - 14);
  doc.setFontSize(7.5);
  doc.setTextColor(140);
  doc.setFont('helvetica', 'normal');
  doc.text(MARCA.footer, 14, alto - 9);
  doc.text(`Página ${pagina} de ${totalPaginas}`, ancho - 14, alto - 9, { align: 'right' });
  doc.setTextColor(0);
}

// Recorre todas las páginas ya escritas y les pone el pie — se llama al
// final, cuando ya se sabe el total de páginas del documento.
export function aplicarPieATodasLasPaginas(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    agregarPiePaginaMarca(doc, p, total);
  }
}
