import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Cerrar lista de faena
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { listaFaenaId, supervisorId, operadorId } = body

    if (!listaFaenaId) {
      return NextResponse.json(
        { success: false, error: 'ID de lista requerido' },
        { status: 400 }
      )
    }

    const lista = await db.listaFaena.findUnique({
      where: { id: listaFaenaId },
      include: {
        tropas: true,
        asignaciones: true
      }
    })

    if (!lista) {
      return NextResponse.json(
        { success: false, error: 'Lista no encontrada' },
        { status: 404 }
      )
    }

    if (lista.estado !== 'ABIERTA') {
      return NextResponse.json(
        { success: false, error: 'La lista no está abierta' },
        { status: 400 }
      )
    }

    // Validar que la lista tenga animales asignados
    if (lista.asignaciones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'La lista no tiene animales asignados' },
        { status: 400 }
      )
    }

    // Validar que todos los garrones estén completos (tienen ambas medias)
    const garronesIncompletos = lista.asignaciones.filter(a => !a.completado)
    if (garronesIncompletos.length > 0) {
      return NextResponse.json(
        { success: false, error: `Hay ${garronesIncompletos.length} garrón(es) sin completar` },
        { status: 400 }
      )
    }

    // Use transaction for atomic update
    await db.$transaction(async (tx) => {
      // Cerrar lista
      await tx.listaFaena.update({
        where: { id: listaFaenaId },
        data: {
          estado: 'CERRADA',
          supervisorId,
          fechaCierre: new Date()
        }
      })

      // Registrar auditoría
      await tx.auditoria.create({
        data: {
          operadorId: operadorId || supervisorId || null,
          modulo: 'LISTA_FAENA',
          accion: 'UPDATE',
          entidad: 'ListaFaena',
          entidadId: listaFaenaId,
          descripcion: `Lista de faena cerrada con ${lista.asignaciones.length} animales`
        }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cerrando lista:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cerrar lista' },
      { status: 500 }
    )
  }
}
