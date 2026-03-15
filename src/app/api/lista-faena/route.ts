import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Fetch listas de faena
export async function GET(request: NextRequest) {
  try {
    const listas = await db.listaFaena.findMany({
      include: {
        supervisor: true,
        tropas: {
          include: {
            tropa: {
              include: {
                usuarioFaena: true,
                tiposAnimales: true,
                corral: true
              }
            },
            corral: true
          }
        },
        asignaciones: {
          include: {
            animal: {
              select: {
                id: true,
                codigo: true,
                numero: true,
                tipoAnimal: true
              }
            }
          },
          orderBy: { garron: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Agregar campo numero calculado si no existe
    const listasConNumero = listas.map((lista, index) => ({
      ...lista,
      numero: (lista as any).numero || (listas.length - index)
    }))

    return NextResponse.json({ success: true, data: listasConNumero })
  } catch (error) {
    console.error('Error fetching listas:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener listas de faena' },
      { status: 500 }
    )
  }
}

// POST - Create new lista de faena
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { operadorId } = body

    // Obtener el máximo número existente para generar el correlativo
    // Usar agregación para obtener el máximo número
    const maxResult = await db.listaFaena.aggregate({
      _max: { numero: true }
    })
    const nuevoNumero = (maxResult._max.numero || 0) + 1

    const lista = await db.listaFaena.create({
      data: {
        numero: nuevoNumero,
        fecha: new Date(),
        estado: 'ABIERTA',
        cantidadTotal: 0
      },
      include: {
        supervisor: true,
        tropas: {
          include: {
            tropa: {
              include: {
                usuarioFaena: true,
                tiposAnimales: true
              }
            },
            corral: true
          }
        }
      }
    })

    return NextResponse.json({ 
      success: true, 
      data: lista,
      message: `Lista de Faena N° ${nuevoNumero} creada correctamente`
    })
  } catch (error) {
    console.error('Error creating lista:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear lista de faena' },
      { status: 500 }
    )
  }
}

// PUT - Reabrir lista cerrada
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { listaId, listaFaenaId, accion } = body

    const id = listaId || listaFaenaId

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de lista requerido' },
        { status: 400 }
      )
    }

    // Verificar que la lista existe y está cerrada
    const lista = await db.listaFaena.findUnique({
      where: { id }
    })

    if (!lista) {
      return NextResponse.json(
        { success: false, error: 'Lista no encontrada' },
        { status: 404 }
      )
    }

    if (accion === 'reabrir' && lista.estado !== 'CERRADA') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden reabrir listas cerradas' },
        { status: 400 }
      )
    }

    // Reabrir la lista
    const listaActualizada = await db.listaFaena.update({
      where: { id },
      data: {
        estado: 'ABIERTA',
        fechaCierre: null,
        supervisorId: null
      },
      include: {
        supervisor: true,
        tropas: {
          include: {
            tropa: {
              include: {
                usuarioFaena: true,
                tiposAnimales: true
              }
            },
            corral: true
          }
        }
      }
    })

    const numeroLista = (lista as any).numero || 'N/A'

    return NextResponse.json({ 
      success: true, 
      data: listaActualizada,
      message: `Lista N° ${numeroLista} reabierta correctamente`
    })
  } catch (error) {
    console.error('Error reabriendo lista:', error)
    return NextResponse.json(
      { success: false, error: 'Error al reabrir lista' },
      { status: 500 }
    )
  }
}
