import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Mover cantidad de animales de una tropa entre corrales (con transacción)
export async function POST(request: NextRequest) {
  console.log('[MOVER-CANTIDAD] ===== INICIANDO =====')
  
  try {
    const body = await request.json()
    console.log('[MOVER-CANTIDAD] Body recibido:', JSON.stringify(body, null, 2))
    
    const { tropaId, corralOrigenId, corralDestinoId, cantidad, operadorId } = body

    // Validar datos requeridos
    if (!tropaId) {
      console.log('[MOVER-CANTIDAD] ERROR: falta tropaId')
      return NextResponse.json(
        { success: false, error: 'tropaId es requerido' },
        { status: 400 }
      )
    }
    if (!corralOrigenId) {
      console.log('[MOVER-CANTIDAD] ERROR: falta corralOrigenId')
      return NextResponse.json(
        { success: false, error: 'corralOrigenId es requerido' },
        { status: 400 }
      )
    }
    if (!corralDestinoId) {
      console.log('[MOVER-CANTIDAD] ERROR: falta corralDestinoId')
      return NextResponse.json(
        { success: false, error: 'corralDestinoId es requerido' },
        { status: 400 }
      )
    }
    if (!cantidad) {
      console.log('[MOVER-CANTIDAD] ERROR: falta cantidad')
      return NextResponse.json(
        { success: false, error: 'cantidad es requerida' },
        { status: 400 }
      )
    }

    const cantidadMover = parseInt(String(cantidad))
    if (isNaN(cantidadMover) || cantidadMover <= 0) {
      console.log('[MOVER-CANTIDAD] ERROR: cantidad inválida:', cantidad)
      return NextResponse.json(
        { success: false, error: 'Cantidad inválida' },
        { status: 400 }
      )
    }

    console.log('[MOVER-CANTIDAD] Datos validados OK:', { tropaId, corralOrigenId, corralDestinoId, cantidadMover })

    // USAR TRANSACCIÓN para evitar race conditions
    const result = await db.$transaction(async (tx) => {
      // Verificar que el corral destino existe
      const corralDestino = await tx.corral.findUnique({
        where: { id: corralDestinoId }
      })

      if (!corralDestino) {
        throw new Error('CORRAL_DESTINO_NO_ENCONTRADO')
      }

      // Obtener animales de la tropa en el corral origen (con lock)
      const animalesEnOrigen = await tx.animal.findMany({
        where: {
          tropaId,
          corralId: corralOrigenId,
          estado: { in: ['RECIBIDO', 'PESADO'] }
        },
        orderBy: { numero: 'asc' },
        take: cantidadMover
      })

      console.log('[MOVER-CANTIDAD] Animales encontrados en origen:', animalesEnOrigen.length)

      if (animalesEnOrigen.length < cantidadMover) {
        throw new Error(`STOCK_INSUFICIENTE:${animalesEnOrigen.length}`)
      }

      // Obtener la tropa para saber la especie
      const tropa = await tx.tropa.findUnique({
        where: { id: tropaId }
      })

      if (!tropa) {
        throw new Error('TROPA_NO_ENCONTRADA')
      }

      // Mover los animales (actualizar corralId)
      const idsAMover = animalesEnOrigen.map(a => a.id)
      console.log('[MOVER-CANTIDAD] IDs a mover:', idsAMover)
      
      await tx.animal.updateMany({
        where: {
          id: { in: idsAMover }
        },
        data: {
          corralId: corralDestinoId
        }
      })

      // Crear registro de movimiento
      await tx.movimientoCorral.create({
        data: {
          tropaId,
          corralOrigenId,
          corralDestinoId,
          cantidad: cantidadMover,
          especie: tropa.especie,
          observaciones: `Movimiento de ${cantidadMover} animales de tropa ${tropa.codigo}`,
          operadorId: operadorId || null
        }
      })

      // Registrar auditoría
      await tx.auditoria.create({
        data: {
          operadorId: operadorId || null,
          modulo: 'MOVIMIENTO_HACIENDA',
          accion: 'UPDATE',
          entidad: 'Animal',
          descripcion: `Movidos ${cantidadMover} animales de tropa ${tropa.codigo} al corral ${corralDestino.nombre}`
        }
      })

      return { cantidadMover, tropa, corralDestino }
    })

    console.log('[MOVER-CANTIDAD] ===== ÉXITO =====')

    return NextResponse.json({
      success: true,
      data: {
        movidos: result.cantidadMover,
        tropa: result.tropa.codigo,
        destino: result.corralDestino.nombre
      }
    })
  } catch (error: unknown) {
    console.error('[MOVER-CANTIDAD] ERROR CRÍTICO:', error)
    
    // Manejar errores específicos
    if (error instanceof Error) {
      if (error.message === 'CORRAL_DESTINO_NO_ENCONTRADO') {
        return NextResponse.json(
          { success: false, error: 'Corral destino no encontrado' },
          { status: 404 }
        )
      }
      if (error.message === 'TROPA_NO_ENCONTRADA') {
        return NextResponse.json(
          { success: false, error: 'Tropa no encontrada' },
          { status: 404 }
        )
      }
      if (error.message.startsWith('STOCK_INSUFICIENTE:')) {
        const disponibles = error.message.split(':')[1]
        return NextResponse.json(
          { success: false, error: `Solo hay ${disponibles} animales disponibles en este corral` },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { success: false, error: 'Error al mover animales' },
      { status: 500 }
    )
  }
}
