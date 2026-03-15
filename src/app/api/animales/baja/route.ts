import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Register animal death/baja
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { animalId, motivoBaja, operadorId } = body

    if (!animalId || !motivoBaja) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    // Get animal
    const animal = await db.animal.findUnique({
      where: { id: animalId },
      include: { tropa: true }
    })

    if (!animal) {
      return NextResponse.json(
        { success: false, error: 'Animal no encontrado' },
        { status: 404 }
      )
    }

    if (animal.estado === 'FALLECIDO') {
      return NextResponse.json(
        { success: false, error: 'El animal ya fue dado de baja' },
        { status: 400 }
      )
    }

    // Use transaction to ensure data consistency
    const result = await db.$transaction(async (tx) => {
      // Update animal state
      const updatedAnimal = await tx.animal.update({
        where: { id: animalId },
        data: {
          estado: 'FALLECIDO',
          fechaBaja: new Date(),
          motivoBaja
        }
      })

      // Update tropa cantidadCabezas
      await tx.tropa.update({
        where: { id: animal.tropaId },
        data: {
          cantidadCabezas: { decrement: 1 }
        }
      })

      // Update corral stock if animal was in a corral
      if (animal.corralId) {
        await tx.corral.update({
          where: { id: animal.corralId },
          data: {
            stockBovinos: animal.tropa.especie === 'BOVINO' ? { decrement: 1 } : undefined,
            stockEquinos: animal.tropa.especie === 'EQUINO' ? { decrement: 1 } : undefined
          }
        })
      }

      // Register audit
      await tx.auditoria.create({
        data: {
          operadorId: operadorId || null,
          modulo: 'MOVIMIENTO_HACIENDA',
          accion: 'UPDATE',
          entidad: 'Animal',
          entidadId: animalId,
          descripcion: `Animal ${animal.codigo} dado de baja - Motivo: ${motivoBaja}`
        }
      })

      return updatedAnimal
    })

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error registering baja:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar baja' },
      { status: 500 }
    )
  }
}
