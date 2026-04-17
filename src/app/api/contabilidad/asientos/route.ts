import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Listar asientos contables
import { checkPermission } from '@/lib/auth-helpers'
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    
    const where: any = {};
    if (estado) where.estado = estado;
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta);
    }
    
    const asientos = await db.asientoContable.findMany({
      where,
      include: { lineas: true },
      orderBy: { fecha: 'desc' }
    });
    
    return NextResponse.json(asientos);
  } catch (error) {
    console.error('Error al obtener asientos:', error);
    return NextResponse.json({ error: 'Error al obtener asientos' }, { status: 500 });
  }
}

// POST - Crear asiento contable
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError

  try {
    const body = await request.json();
    const { tipoOrigen, origenId, origenDetalle, descripcion, lineas } = body;
    
    if (!descripcion || !lineas || lineas.length === 0) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }
    
    // Validar que débitos = créditos
    const totalDebe = lineas.reduce((sum: number, l: any) => sum + (l.debe || 0), 0);
    const totalHaber = lineas.reduce((sum: number, l: any) => sum + (l.haber || 0), 0);
    
    if (Math.abs(totalDebe - totalHaber) > 0.01) {
      return NextResponse.json(
        { error: 'Asiento desbalanceado', totalDebe, totalHaber },
        { status: 400 }
      );
    }
    
    const asiento = await db.asientoContable.create({
      data: {
        tipoOrigen: tipoOrigen || 'AJUSTE',
        origenId,
        origenDetalle,
        descripcion,
        lineas: {
          create: lineas.map((l: any, index: number) => ({
            codigoCuenta: l.codigoCuenta,
            nombreCuenta: l.nombreCuenta,
            debe: l.debe || 0,
            haber: l.haber || 0,
            auxiliarCodigo: l.auxiliarCodigo,
            auxiliarNombre: l.auxiliarNombre,
            orden: index
          }))
        }
      },
      include: { lineas: true }
    });
    
    return NextResponse.json(asiento, { status: 201 });
  } catch (error) {
    console.error('Error al crear asiento:', error);
    return NextResponse.json({ error: 'Error al crear asiento' }, { status: 500 });
  }
}
