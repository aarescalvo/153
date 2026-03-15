import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET - Obtener preferencias de UI del operador
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operadorId = searchParams.get('operadorId')
    
    if (!operadorId) {
      return NextResponse.json(
        { success: false, error: 'Operador ID requerido' },
        { status: 400 }
      )
    }
    
    let preferencias = await db.preferenciasUI.findUnique({
      where: { operadorId }
    })
    
    // Si no existe, crear con valores por defecto
    if (!preferencias) {
      preferencias = await db.preferenciasUI.create({
        data: {
          operadorId,
          moduloOrden: JSON.stringify([
            'pesajeCamiones',
            'pesajeIndividual', 
            'movimientoHacienda',
            'listaFaena',
            'ingresoCajon',
            'romaneo',
            'vbRomaneo',
            'expedicion',
            'menudencias',
            'cueros',
            'stocksCorrales',
            'stock',
            'planilla01',
            'rindesTropa',
            'busquedaFiltro',
            'facturacion',
            'configuracion'
          ]),
          moduloTamano: JSON.stringify({
            pesajeCamiones: 'large',
            pesajeIndividual: 'medium',
            movimientoHacienda: 'medium',
            listaFaena: 'medium',
            ingresoCajon: 'medium',
            romaneo: 'medium',
            vbRomaneo: 'small',
            expedicion: 'medium',
            menudencias: 'medium',
            cueros: 'small',
            stocksCorrales: 'medium',
            stock: 'medium',
            planilla01: 'medium',
            rindesTropa: 'medium',
            busquedaFiltro: 'medium',
            facturacion: 'medium',
            configuracion: 'small'
          }),
          moduloVisible: JSON.stringify({}),
          moduloColor: JSON.stringify({}),
          gruposExpandidos: JSON.stringify(['CICLO I', 'Subproductos'])
        }
      })
    }
    
    // Parsear JSON fields
    const result = {
      ...preferencias,
      moduloOrden: preferencias.moduloOrden ? JSON.parse(preferencias.moduloOrden) : [],
      moduloTamano: preferencias.moduloTamano ? JSON.parse(preferencias.moduloTamano) : {},
      moduloVisible: preferencias.moduloVisible ? JSON.parse(preferencias.moduloVisible) : {},
      moduloColor: preferencias.moduloColor ? JSON.parse(preferencias.moduloColor) : {},
      gruposExpandidos: preferencias.gruposExpandidos ? JSON.parse(preferencias.gruposExpandidos) : []
    }
    
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error obteniendo preferencias:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener preferencias' },
      { status: 500 }
    )
  }
}

// POST - Crear o actualizar preferencias
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      operadorId, 
      moduloOrden, 
      moduloTamano, 
      moduloVisible,
      moduloColor,
      sidebarExpandido,
      gruposExpandidos,
      tema,
      tamanoFuente,
      densidad,
      paginaInicio
    } = body
    
    if (!operadorId) {
      return NextResponse.json(
        { success: false, error: 'Operador ID requerido' },
        { status: 400 }
      )
    }
    
    const data: Prisma.PreferenciasUIUpdateInput = {}
    
    if (moduloOrden !== undefined) data.moduloOrden = JSON.stringify(moduloOrden)
    if (moduloTamano !== undefined) data.moduloTamano = JSON.stringify(moduloTamano)
    if (moduloVisible !== undefined) data.moduloVisible = JSON.stringify(moduloVisible)
    if (moduloColor !== undefined) data.moduloColor = JSON.stringify(moduloColor)
    if (sidebarExpandido !== undefined) data.sidebarExpandido = sidebarExpandido
    if (gruposExpandidos !== undefined) data.gruposExpandidos = JSON.stringify(gruposExpandidos)
    if (tema !== undefined) data.tema = tema
    if (tamanoFuente !== undefined) data.tamanoFuente = tamanoFuente
    if (densidad !== undefined) data.densidad = densidad
    if (paginaInicio !== undefined) data.paginaInicio = paginaInicio
    
    const preferencias = await db.preferenciasUI.upsert({
      where: { operadorId },
      create: {
        operadorId,
        moduloOrden: moduloOrden ? JSON.stringify(moduloOrden) : undefined,
        moduloTamano: moduloTamano ? JSON.stringify(moduloTamano) : undefined,
        moduloVisible: moduloVisible ? JSON.stringify(moduloVisible) : undefined,
        moduloColor: moduloColor ? JSON.stringify(moduloColor) : undefined,
        sidebarExpandido: sidebarExpandido ?? true,
        gruposExpandidos: gruposExpandidos ? JSON.stringify(gruposExpandidos) : undefined,
        tema: tema ?? 'light',
        tamanoFuente: tamanoFuente ?? 'normal',
        densidad: densidad ?? 'normal',
        paginaInicio
      },
      update: data
    })
    
    return NextResponse.json({
      success: true,
      data: preferencias
    })
  } catch (error) {
    console.error('Error guardando preferencias:', error)
    return NextResponse.json(
      { success: false, error: 'Error al guardar preferencias' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar solo el orden de módulos (drag & drop)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { operadorId, moduloOrden } = body
    
    if (!operadorId || !moduloOrden) {
      return NextResponse.json(
        { success: false, error: 'Operador ID y moduloOrden requeridos' },
        { status: 400 }
      )
    }
    
    const preferencias = await db.preferenciasUI.upsert({
      where: { operadorId },
      create: {
        operadorId,
        moduloOrden: JSON.stringify(moduloOrden)
      },
      update: {
        moduloOrden: JSON.stringify(moduloOrden)
      }
    })
    
    return NextResponse.json({
      success: true,
      data: preferencias
    })
  } catch (error) {
    console.error('Error actualizando orden:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar orden' },
      { status: 500 }
    )
  }
}

// PATCH - Actualizar un campo específico
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { operadorId, campo, valor } = body
    
    if (!operadorId || !campo) {
      return NextResponse.json(
        { success: false, error: 'Operador ID y campo requeridos' },
        { status: 400 }
      )
    }
    
    // Mapear campos válidos
    const camposValidos: Record<string, string> = {
      'moduloOrden': 'moduloOrden',
      'moduloTamano': 'moduloTamano',
      'moduloVisible': 'moduloVisible',
      'moduloColor': 'moduloColor',
      'sidebarExpandido': 'sidebarExpandido',
      'gruposExpandidos': 'gruposExpandidos',
      'tema': 'tema',
      'tamanoFuente': 'tamanoFuente',
      'densidad': 'densidad',
      'paginaInicio': 'paginaInicio'
    }
    
    const campoDb = camposValidos[campo]
    if (!campoDb) {
      return NextResponse.json(
        { success: false, error: 'Campo no válido' },
        { status: 400 }
      )
    }
    
    // Campos JSON
    const jsonFields = ['moduloOrden', 'moduloTamano', 'moduloVisible', 'moduloColor', 'gruposExpandidos']
    const valorFinal = jsonFields.includes(campo) ? JSON.stringify(valor) : valor
    
    const preferencias = await db.preferenciasUI.upsert({
      where: { operadorId },
      create: {
        operadorId,
        [campoDb]: valorFinal
      } as Prisma.PreferenciasUICreateInput,
      update: {
        [campoDb]: valorFinal
      }
    })
    
    return NextResponse.json({
      success: true,
      data: preferencias
    })
  } catch (error) {
    console.error('Error actualizando preferencia:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar preferencia' },
      { status: 500 }
    )
  }
}
