import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Obtener stock de animales por tropa y corral
export async function GET(request: NextRequest) {
  try {
    // Obtener todos los animales agrupados por tropa y corral
    const animales = await db.animal.findMany({
      where: {
        estado: { in: ['RECIBIDO', 'PESADO'] } // Solo animales disponibles
      },
      include: {
        tropa: {
          include: {
            usuarioFaena: true,
            tiposAnimales: true
          }
        },
        corral: true
      }
    })

    // Agrupar por tropa + corral
    const stockPorTropaCorral = new Map<string, {
      tropaId: string
      tropaCodigo: string
      corralId: string | null
      corralNombre: string
      usuarioFaena: string
      totalAnimales: number
      animales: { id: string; numero: number; tipoAnimal: string; pesoVivo: number | null }[]
    }>()

    for (const animal of animales) {
      const key = `${animal.tropaId}-${animal.corralId || 'sin-corral'}`
      
      if (!stockPorTropaCorral.has(key)) {
        stockPorTropaCorral.set(key, {
          tropaId: animal.tropaId,
          tropaCodigo: animal.tropa?.codigo || 'Sin código',
          corralId: animal.corralId,
          corralNombre: animal.corral?.nombre || 'Sin corral',
          usuarioFaena: animal.tropa?.usuarioFaena?.nombre || 'Sin usuario',
          totalAnimales: 0,
          animales: []
        })
      }

      const grupo = stockPorTropaCorral.get(key)!
      grupo.totalAnimales++
      grupo.animales.push({
        id: animal.id,
        numero: animal.numero,
        tipoAnimal: animal.tipoAnimal,
        pesoVivo: animal.pesoVivo
      })
    }

    // Calcular disponibilidad real (restando animales ya en listas abiertas)
    const listasAbiertas = await db.listaFaena.findMany({
      where: { estado: 'ABIERTA' },
      include: {
        tropas: {
          include: {
            tropa: true
          }
        }
      }
    })

    // Mapear cantidades en listas abiertas
    const cantidadesEnListasAbiertas = new Map<string, number>()
    for (const lista of listasAbiertas) {
      for (const tropaLista of lista.tropas) {
        const key = `${tropaLista.tropaId}-${tropaLista.corralId || 'sin-corral'}`
        const actual = cantidadesEnListasAbiertas.get(key) || 0
        cantidadesEnListasAbiertas.set(key, actual + tropaLista.cantidad)
      }
    }

    // Calcular animales faenados (con garrón en listas cerradas)
    const asignacionesCerradas = await db.asignacionGarron.findMany({
      where: {
        listaFaena: { estado: 'CERRADA' }
      },
      include: {
        animal: {
          select: { tropaId: true, corralId: true }
        }
      }
    })

    const animalesFaenados = new Map<string, number>()
    for (const asignacion of asignacionesCerradas) {
      if (asignacion.animal) {
        const key = `${asignacion.animal.tropaId}-${asignacion.animal.corralId || 'sin-corral'}`
        const actual = animalesFaenados.get(key) || 0
        animalesFaenados.set(key, actual + 1)
      }
    }

    // Construir respuesta con disponibilidad calculada
    const resultado = Array.from(stockPorTropaCorral.values()).map(grupo => {
      const key = `${grupo.tropaId}-${grupo.corralId || 'sin-corral'}`
      const enListaAbierta = cantidadesEnListasAbiertas.get(key) || 0
      const faenados = animalesFaenados.get(key) || 0
      const disponible = grupo.totalAnimales - enListaAbierta - faenados

      return {
        ...grupo,
        enListaAbierta,
        faenados,
        disponible
      }
    }).filter(g => g.disponible > 0) // Solo mostrar los que tienen disponibilidad

    // Ordenar por tropa y corral
    resultado.sort((a, b) => {
      if (a.tropaCodigo !== b.tropaCodigo) {
        return a.tropaCodigo.localeCompare(b.tropaCodigo)
      }
      return a.corralNombre.localeCompare(b.corralNombre)
    })

    return NextResponse.json({
      success: true,
      data: resultado
    })
  } catch (error) {
    console.error('Error fetching stock corrales:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener stock por corrales' },
      { status: 500 }
    )
  }
}
