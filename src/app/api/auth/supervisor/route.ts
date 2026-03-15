import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST - Validar credenciales de supervisor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pin, password, usuario } = body

    let operador = null

    // Validar con PIN
    if (pin) {
      operador = await db.operador.findFirst({
        where: {
          pin: String(pin),
          activo: true,
          rol: { in: ['SUPERVISOR', 'ADMINISTRADOR'] }
        }
      })
    }
    // Validar con usuario y password
    else if (usuario && password) {
      operador = await db.operador.findFirst({
        where: {
          usuario: String(usuario).toLowerCase(),
          activo: true,
          rol: { in: ['SUPERVISOR', 'ADMINISTRADOR'] }
        }
      })

      if (operador) {
        const validPassword = await bcrypt.compare(password, operador.password)
        if (!validPassword) {
          return NextResponse.json(
            { success: false, error: 'Contraseña incorrecta' },
            { status: 401 }
          )
        }
      }
    }

    if (!operador) {
      return NextResponse.json(
        { success: false, error: 'Credenciales inválidas o no tiene permisos de supervisor' },
        { status: 401 }
      )
    }

    // Registrar auditoría
    await db.auditoria.create({
      data: {
        operadorId: operador.id,
        modulo: 'AUTH_SUPERVISOR',
        accion: 'VALIDACION',
        entidad: 'Operador',
        entidadId: operador.id,
        descripcion: `Validación de supervisor: ${operador.nombre}`
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: operador.id,
        nombre: operador.nombre,
        rol: operador.rol
      }
    })
  } catch (error) {
    console.error('Error validando supervisor:', error)
    return NextResponse.json(
      { success: false, error: 'Error de servidor' },
      { status: 500 }
    )
  }
}
