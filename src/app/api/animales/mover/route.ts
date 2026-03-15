import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Mover animal(es) entre corrales
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { animalIds, corralDestinoId, operadorId, observaciones } = body

    if (!animalIds || !Array.isArray(animalIds) || animalIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Se requieren IDs de animales' },
        { status: 400 }
      )
    }

    if (!corralDestinoId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el corral destino' },
        { status: 400 }
      )
    }

    // Verificar que el corral destino existe
    const corralDestino = await db.corral.findUnique({
      where: { id: corralDestinoId }
    })

    if (!corralDestino) {
      return NextResponse.json(
        { success: false, error: 'Corral destino no encontrado' },
        { status: 404 }
      )
    }

    // Obtener animales a mover
    const animales = await db.animal.findMany({
      where: {
        id: { in: animalIds }
      },
      include: { tropa: true }
    })

    if (animales.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron animales' },
        { status: 404 }
      )
    }

    // Agrupar por corral origen para registrar movimientos
    const porCorralOrigen = animales.reduce((acc, animal) => {
      const corralId = animal.corralId || 'sin-corral'
      if (!acc[corralId]) {
        acc[corralId] = []
      }
      acc[corralId].push(animal)
      return acc
    }, {} as Record<string, typeof animales>)

    // Mover cada animal
    const movimientosCreados = []
    for (const [corralOrigenId, animalesGrupo] of Object.entries(porCorralOrigen)) {
      // Actualizar corral de cada animal
      await db.animal.updateMany({
        where: {
          id: { in: animalesGrupo.map(a => a.id) }
        },
        data: {
          corralId: corralDestinoId
        }
      })

      // Crear registro de movimiento
      const movimiento = await db.movimientoCorral.create({
        data: {
          corralOrigenId: corralOrigenId === 'sin-corral' ? null : corralOrigenId,
          corralDestinoId,
          cantidad: animalesGrupo.length,
          especie: animalesGrupo[0].tropa.especie,
          observaciones: observaciones || `Movimiento de ${animalesGrupo.length} animal(es)`,
          operadorId: operadorId || null
        }
      })
      movimientosCreados.push(movimiento)

      // Registrar auditoría
      for (const animal of animalesGrupo) {
        await db.auditoria.create({
          data: {
            operadorId: operadorId || null,
            modulo: 'MOVIMIENTO_HACIENDA',
            accion: 'UPDATE',
            entidad: 'Animal',
            entidadId: animal.id,
            descripcion: `Animal ${animal.codigo} movido de ${corralOrigenId === 'sin-corral' ? 'sin corral' : corralOrigenId} a ${corralDestino.nombre}`
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        movidos: animales.length,
        movimientos: movimientosCreados
      }
    })
  } catch (error) {
    console.error('Error moviendo animales:', error)
    return NextResponse.json(
      { success: false, error: 'Error al mover animales' },
      { status: 500 }
    )
  }
}
