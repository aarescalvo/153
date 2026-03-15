import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { 
  checkRateLimit, 
  getClientIp, 
  getRateLimitKey, 
  resetRateLimit,
  RATE_LIMIT_CONFIGS 
} from '@/lib/rate-limiter'
import { SupervisorAuthSchema, validateOrError } from '@/lib/validations'

// POST - Validar credenciales de supervisor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validar entrada con Zod
    const validation = validateOrError(SupervisorAuthSchema, body)
    if (!validation.success) {
      return validation.error
    }
    
    const { pin, password, usuario } = validation.data
    
    // Obtener IP para rate limiting
    const clientIp = getClientIp(request)
    const rateLimitKey = getRateLimitKey(clientIp, 'supervisor')
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.AUTH_SUPERVISOR)
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: rateLimitResult.blocked 
            ? `Demasiados intentos fallidos. Intente nuevamente en ${rateLimitResult.retryAfter} segundos.`
            : 'Demasiadas solicitudes. Intente más tarde.',
          retryAfter: rateLimitResult.retryAfter
        },
        { 
          status: 429,
          headers: rateLimitResult.retryAfter 
            ? { 'Retry-After': String(rateLimitResult.retryAfter) }
            : undefined
        }
      )
    }

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
            { 
              success: false, 
              error: 'Contraseña incorrecta',
              attemptsRemaining: rateLimitResult.remaining - 1
            },
            { status: 401 }
          )
        }
      }
    }

    if (!operador) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Credenciales inválidas o no tiene permisos de supervisor',
          attemptsRemaining: rateLimitResult.remaining - 1
        },
        { status: 401 }
      )
    }
    
    // Validación exitosa - resetear rate limit
    resetRateLimit(rateLimitKey)

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
