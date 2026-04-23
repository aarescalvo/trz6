import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Listar productores/consignatarios
import { checkPermission, checkAnyPermission } from '@/lib/auth-helpers'

const PESAJE_ALT = ['puedeFacturacion', 'puedePesajeCamiones']
export async function GET(request: NextRequest) {
  const authError = await checkAnyPermission(request, PESAJE_ALT)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url);
    const activos = searchParams.get('activos');
    const tipo = searchParams.get('tipo');

    const where: Record<string, unknown> = {};
    if (activos === 'true') {
      where.activo = true;
    }
    if (tipo) {
      where.tipo = tipo;
    }

    const productores = await db.productorConsignatario.findMany({
      where,
      orderBy: { nombre: 'asc' }
    });

    return NextResponse.json({ success: true, data: productores });
  } catch (error) {
    console.error('Error al obtener productores:', error);
    return NextResponse.json({ success: false, error: 'Error al obtener productores' }, { status: 500 });
  }
}

// POST - Crear productor/consignatario
export async function POST(request: NextRequest) {
  const authError = await checkAnyPermission(request, PESAJE_ALT)
  if (authError) return authError

  try {
    const data = await request.json();

    const productor = await db.productorConsignatario.create({
      data: {
        nombre: data.nombre,
        cuit: data.cuit || null,
        direccion: data.direccion,
        telefono: data.telefono,
        email: data.email,
        tipo: data.tipo || 'PRODUCTOR',
        numeroRenspa: data.numeroRenspa,
        numeroEstablecimiento: data.numeroEstablecimiento,
        localidad: data.localidad,
        provincia: data.provincia,
        observaciones: data.observaciones,
        activo: data.activo ?? true,
      }
    });

    return NextResponse.json({ success: true, data: productor });
  } catch (error) {
    console.error('Error al crear productor:', error);
    return NextResponse.json({ success: false, error: 'Error al crear productor' }, { status: 500 });
  }
}

// PUT - Actualizar productor/consignatario
export async function PUT(request: NextRequest) {
  const authError = await checkAnyPermission(request, PESAJE_ALT)
  if (authError) return authError

  try {
    const data = await request.json();

    if (!data.id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const productor = await db.productorConsignatario.update({
      where: { id: data.id },
      data: {
        nombre: data.nombre,
        cuit: data.cuit,
        direccion: data.direccion,
        telefono: data.telefono,
        email: data.email,
        tipo: data.tipo,
        numeroRenspa: data.numeroRenspa,
        numeroEstablecimiento: data.numeroEstablecimiento,
        localidad: data.localidad,
        provincia: data.provincia,
        observaciones: data.observaciones,
        activo: data.activo,
      }
    });

    return NextResponse.json({ success: true, data: productor });
  } catch (error) {
    console.error('Error al actualizar productor:', error);
    return NextResponse.json({ success: false, error: 'Error al actualizar productor' }, { status: 500 });
  }
}

// DELETE - Eliminar productor/consignatario
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await db.productorConsignatario.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar productor:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar productor' }, { status: 500 });
  }
}
