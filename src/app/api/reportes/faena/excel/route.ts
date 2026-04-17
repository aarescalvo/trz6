import { NextRequest, NextResponse } from 'next/server';
import { ExcelExporter } from '@/lib/export-excel';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const body = await request.json();
    const { fechaDesde, fechaHasta, tropaId } = body;

    // Construir filtros
    const where: any = {};
    
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha.gte = new Date(fechaDesde);
      if (fechaHasta) where.fecha.lte = new Date(fechaHasta);
    }
    
    if (tropaId) {
      where.tropaId = tropaId;
    }

    // Obtener datos de balances de faena
    const balances = await db.balanceFaena.findMany({
      where,
      include: {
        tropa: {
          include: {
            productor: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });

    // Transformar datos para exportación
    const data = balances.map((b) => ({
      fecha: b.fecha,
      tropaNumero: b.tropa?.numero || 0,
      productor: b.tropa?.productor?.nombre || 'Sin productor',
      cantidadAnimales: b.tropa?.cantidadCabezas || 0,
      pesoVivoTotal: b.pesoVivoTotal,
      pesoFrioTotal: b.pesoFrioTotal,
      rinde: b.rindePromedio || 0,
      observaciones: b.observaciones || '',
    }));

    // Crear workbook
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Preparar datos
    const headers = [
      'Fecha',
      'Tropa',
      'Productor',
      'Animales',
      'Peso Vivo (kg)',
      'Peso Frío (kg)',
      'Rinde (%)',
      'Observaciones',
    ];

    const rows = data.map((d) => [
      new Date(d.fecha).toLocaleDateString('es-AR'),
      `T-${d.tropaNumero}`,
      d.productor,
      d.cantidadAnimales,
      d.pesoVivoTotal,
      d.pesoFrioTotal,
      d.rinde.toFixed(2),
      d.observaciones,
    ]);

    // Agregar totales
    const totalAnimales = data.reduce((sum, d) => sum + d.cantidadAnimales, 0);
    const totalPesoVivo = data.reduce((sum, d) => sum + d.pesoVivoTotal, 0);
    const totalPesoFrio = data.reduce((sum, d) => sum + d.pesoFrioTotal, 0);
    const rindePromedio = totalPesoVivo > 0 ? (totalPesoFrio / totalPesoVivo) * 100 : 0;

    rows.push([]);
    rows.push(['', '', 'TOTALES', totalAnimales, totalPesoVivo, totalPesoFrio, rindePromedio.toFixed(2), '']);

    // Crear hoja
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 10 }, // Tropa
      { wch: 25 }, // Productor
      { wch: 10 }, // Animales
      { wch: 15 }, // Peso Vivo
      { wch: 15 }, // Peso Frío
      { wch: 10 }, // Rinde
      { wch: 30 }, // Observaciones
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Faena');

    // Generar buffer
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reporte_faena_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error generando Excel de faena:', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar el reporte Excel' },
      { status: 500 }
    );
  }
}
