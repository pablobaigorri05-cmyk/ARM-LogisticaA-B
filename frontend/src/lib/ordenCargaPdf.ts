import { jsPDF } from 'jspdf';
import { Activo, OrdenCarga } from './types';

// PDF de la Orden de Carga — formato limpio pensado para mandarle
// directo al proveedor (Axion Clavero) por mail o WhatsApp.
export function generarPdfOrdenDeCarga(orden: OrdenCarga, activo?: Activo) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Orden de Carga', margin, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº de orden: OC-${String(orden.numero ?? 0).padStart(6, '0')}`, margin, y);
  doc.text(`Solicitud: SC-${String(orden.solicitudNumero ?? 0).padStart(6, '0')}`, 130, y);
  y += 7;
  doc.text(`Fecha: ${new Date(orden.fecha).toLocaleDateString('es-AR')}`, margin, y);
  if (orden.fechaNecesidad) {
    doc.text(`Fecha de necesidad: ${new Date(orden.fechaNecesidad).toLocaleDateString('es-AR')}`, 130, y);
  }
  y += 10;

  doc.setDrawColor(200);
  doc.line(margin, y, 190, y);
  y += 8;

  const filas: [string, string][] = [
    ['Proveedor', orden.proveedorNombre ?? '—'],
    ['Activo', activo ? `${activo.codigoInterno} · ${activo.nombre}` : orden.activoCodigo ?? '—'],
    ['Cantidad autorizada', `${orden.cantidadAutorizada} L`],
    ['Combustible', orden.tipoCombustible],
    ['Kilómetros / horas', orden.kilometros?.toString() ?? '—'],
    ['Centro de costo', orden.centroCostoNombre ?? '—'],
    ['Estado', orden.estado],
    ['Observaciones', orden.observaciones ?? '—'],
  ];

  doc.setFontSize(11);
  for (const [label, value] of filas) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 50, y);
    y += 8;
  }

  y += 15;
  doc.line(margin, y, 90, y);
  doc.line(120, y, 190, y);
  y += 5;
  doc.setFontSize(9);
  doc.text('Firma responsable', margin, y);
  doc.text('Firma proveedor', 120, y);

  doc.save(`orden-carga-OC-${String(orden.numero ?? 0).padStart(6, '0')}.pdf`);
}
