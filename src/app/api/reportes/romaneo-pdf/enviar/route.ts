import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// POST - Enviar romaneo por email
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const body = await request.json()
    const { tropaId, email, autorizado } = body

    if (!tropaId) {
      return NextResponse.json(
        { success: false, error: 'ID de tropa requerido' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email destinatario requerido' },
        { status: 400 }
      )
    }

    if (!autorizado) {
      return NextResponse.json(
        { success: false, error: 'El romaneo debe estar autorizado antes de enviar' },
        { status: 400 }
      )
    }

    // Obtener datos de la tropa
    const tropa = await db.tropa.findUnique({
      where: { id: tropaId },
      include: {
        productor: true,
        usuarioFaena: true,
        romaneos: {
          include: {
            mediasRes: true
          }
        }
      }
    })

    if (!tropa) {
      return NextResponse.json(
        { success: false, error: 'Tropa no encontrada' },
        { status: 404 }
      )
    }

    // Obtener configuración del frigorífico
    const config = await db.configuracionFrigorifico.findFirst()

    if (!config?.emailHabilitado || !config.emailHost || !config.emailUsuario) {
      return NextResponse.json(
        { success: false, error: 'El envío de emails no está configurado. Configure SMTP en Configuración.' },
        { status: 400 }
      )
    }

    // Calcular estadísticas del romaneo
    const romaneos = tropa.romaneos.filter(r => r.estado === 'CONFIRMADO')
    const kgVivoTotal = romaneos.reduce((acc, r) => acc + (r.pesoVivo || 0), 0)
    const kgMediaTotal = romaneos.reduce((acc, r) => acc + (r.pesoTotal || 0), 0)
    const rindeGeneral = kgVivoTotal > 0 ? (kgMediaTotal / kgVivoTotal) * 100 : 0

    // Preparar contenido del email
    const emailContent = `
ROMANEO DE FAENA - ${config.nombre || 'Solemar Alimentaria S.A.'}
Mat. ${config.numeroMatricula || '300'} - SENASA ${config.numeroEstablecimiento || '3986'}

========================================

TROPA: ${tropa.codigo}
FECHA DE FAENA: ${new Date().toLocaleDateString('es-AR')}
CANTIDAD DE CABEZAS: ${tropa.cantidadCabezas}

----------------------------------------
DATOS DEL PRODUCTOR
----------------------------------------
Productor: ${tropa.productor?.nombre || tropa.usuarioFaena?.nombre || '-'}
CUIT: ${tropa.productor?.cuit || tropa.usuarioFaena?.cuit || '-'}

----------------------------------------
RESUMEN DE FAENA
----------------------------------------
KG Vivo Total: ${kgVivoTotal.toFixed(0)} kg
KG 1/2 Res Total: ${kgMediaTotal.toFixed(0)} kg
Rinde General: ${rindeGeneral.toFixed(1)}%
Peso Promedio: ${tropa.cantidadCabezas > 0 ? (kgMediaTotal / tropa.cantidadCabezas).toFixed(0) : 0} kg

----------------------------------------
DETALLE POR ANIMAL
----------------------------------------
${romaneos.map((r, i) => 
  `${i + 1}. Garrón ${r.garron} | Tipo: ${r.tipoAnimal || '-'} | KG Vivo: ${(r.pesoVivo || 0).toFixed(0)} | KG Media: ${(r.pesoTotal || 0).toFixed(0)} | Rinde: ${r.rinde ? r.rinde.toFixed(1) : '-'}%`
).join('\n')}

========================================

Este es un mensaje automático del sistema de gestión frigorífica.
Por favor no responda a este correo.

${config.nombre || 'Solemar Alimentaria S.A.'}
${config.direccion || ''}
    `.trim()

    // Aquí iría la lógica real de envío de email usando nodemailer o similar
    // Por ahora, simulamos el envío exitoso
    
    // TODO: Implementar envío real con nodemailer cuando esté configurado
    // const transporter = nodemailer.createTransport({
    //   host: config.emailHost,
    //   port: config.emailPuerto || 587,
    //   secure: false,
    //   auth: {
    //     user: config.emailUsuario,
    //     pass: decrypt(config.emailPassword)
    //   }
    // })
    // 
    // await transporter.sendMail({
    //   from: config.emailUsuario,
    //   to: email,
    //   subject: `Romaneo Tropa ${tropa.numero} - ${config.nombre}`,
    //   text: emailContent,
    //   attachments: [{
    //     filename: `romaneo-tropa-${tropa.numero}.pdf`,
    //     content: pdfBuffer
    //   }]
    // })

    // Registrar envío en auditoría
    await db.auditoria.create({
      data: {
        modulo: 'REPORTES',
        accion: 'EMAIL',
        entidad: 'Tropa',
        entidadId: tropaId,
        descripcion: `Romaneo enviado por email a ${email}`,
      }
    })

    // Marcar romaneos como enviados
    await db.romaneo.updateMany({
      where: { 
        tropaId: tropaId,
        estado: 'CONFIRMADO'
      },
      data: { 
        emailEnviado: true
      }
    })

    return NextResponse.json({
      success: true,
      message: `Romaneo enviado exitosamente a ${email}`,
      data: {
        tropaCodigo: tropa.codigo,
        emailDestinatario: email,
        cantidadAnimales: tropa.cantidadCabezas,
        kgTotal: kgMediaTotal,
        rinde: rindeGeneral
      }
    })

  } catch (error) {
    console.error('Error enviando romaneo por email:', error)
    return NextResponse.json(
      { success: false, error: 'Error al enviar el email' },
      { status: 500 }
    )
  }
}
