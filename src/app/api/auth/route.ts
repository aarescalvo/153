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
import { LoginSchema, validateOrError } from '@/lib/validations'

// GET - Validate operator session
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
    
    const operador = await db.operador.findUnique({
      where: { id: operadorId }
    })
    
    if (!operador || !operador.activo) {
      return NextResponse.json(
        { success: false, error: 'Operador no encontrado o inactivo' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: operador.id,
        nombre: operador.nombre,
        usuario: operador.usuario,
        rol: operador.rol,
        email: operador.email,
        permisos: {
          puedePesajeCamiones: operador.puedePesajeCamiones,
          puedePesajeIndividual: operador.puedePesajeIndividual,
          puedeMovimientoHacienda: operador.puedeMovimientoHacienda,
          puedeListaFaena: operador.puedeListaFaena,
          puedeRomaneo: operador.puedeRomaneo,
          puedeIngresoCajon: operador.puedeIngresoCajon,
          puedeMenudencias: operador.puedeMenudencias,
          puedeStock: operador.puedeStock,
          puedeReportes: operador.puedeReportes,
          puedeCCIR: operador.puedeCCIR,
          puedeFacturacion: operador.puedeFacturacion,
          puedeConfiguracion: operador.puedeConfiguracion
        }
      }
    })
  } catch (error) {
    console.error('Error validando operador:', error)
    return NextResponse.json(
      { success: false, error: 'Error de servidor' },
      { status: 500 }
    )
  }
}

// POST - Login con usuario/password o PIN
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validar entrada con Zod
    const validation = validateOrError(LoginSchema, body)
    if (!validation.success) {
      return validation.error
    }
    
    const { usuario, password, pin } = validation.data
    
    // Obtener IP del cliente para rate limiting
    const clientIp = getClientIp(request)
    
    // Login con usuario y password
    if (usuario && password) {
      // Rate limiting por IP + usuario
      const rateLimitKey = getRateLimitKey(clientIp, usuario.toLowerCase())
      const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.AUTH_LOGIN)
      
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
      
      console.log('[AUTH] Login attempt:', { usuario: usuario.toLowerCase(), ip: clientIp })
      
      const operador = await db.operador.findFirst({
        where: {
          usuario: usuario.toLowerCase(),
          activo: true
        }
      })
      
      console.log('[AUTH] Operador encontrado:', operador ? operador.usuario : 'NO ENCONTRADO')
      
      if (!operador) {
        return NextResponse.json(
          { success: false, error: 'Usuario no encontrado o inactivo' },
          { status: 401 }
        )
      }
      
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
      
      // Login exitoso - resetear rate limit
      resetRateLimit(rateLimitKey)
      
      // Registrar login en auditoría
      await db.auditoria.create({
        data: {
          operadorId: operador.id,
          modulo: 'AUTH',
          accion: 'LOGIN',
          entidad: 'Operador',
          entidadId: operador.id,
          descripcion: `Login exitoso: ${operador.nombre} (${operador.usuario})`
        }
      })
      
      return NextResponse.json({
        success: true,
        data: {
          id: operador.id,
          nombre: operador.nombre,
          usuario: operador.usuario,
          rol: operador.rol,
          email: operador.email,
          permisos: {
            puedePesajeCamiones: operador.puedePesajeCamiones,
            puedePesajeIndividual: operador.puedePesajeIndividual,
            puedeMovimientoHacienda: operador.puedeMovimientoHacienda,
            puedeListaFaena: operador.puedeListaFaena,
            puedeRomaneo: operador.puedeRomaneo,
            puedeIngresoCajon: operador.puedeIngresoCajon,
            puedeMenudencias: operador.puedeMenudencias,
            puedeStock: operador.puedeStock,
            puedeReportes: operador.puedeReportes,
            puedeCCIR: operador.puedeCCIR,
            puedeFacturacion: operador.puedeFacturacion,
            puedeConfiguracion: operador.puedeConfiguracion
          }
        }
      })
    }
    
    // Login con PIN (alternativa rápida)
    if (pin) {
      // Rate limiting por IP para PIN
      const rateLimitKey = getRateLimitKey(clientIp, 'pin')
      const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.AUTH_PIN)
      
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
      
      const operador = await db.operador.findFirst({
        where: {
          pin: String(pin),
          activo: true
        }
      })
      
      if (!operador) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'PIN inválido o operador inactivo',
            attemptsRemaining: rateLimitResult.remaining - 1
          },
          { status: 401 }
        )
      }
      
      // Login exitoso - resetear rate limit
      resetRateLimit(rateLimitKey)
      
      // Registrar login en auditoría
      await db.auditoria.create({
        data: {
          operadorId: operador.id,
          modulo: 'AUTH',
          accion: 'LOGIN_PIN',
          entidad: 'Operador',
          entidadId: operador.id,
          descripcion: `Login con PIN: ${operador.nombre}`
        }
      })
      
      return NextResponse.json({
        success: true,
        data: {
          id: operador.id,
          nombre: operador.nombre,
          usuario: operador.usuario,
          rol: operador.rol,
          email: operador.email,
          permisos: {
            puedePesajeCamiones: operador.puedePesajeCamiones,
            puedePesajeIndividual: operador.puedePesajeIndividual,
            puedeMovimientoHacienda: operador.puedeMovimientoHacienda,
            puedeListaFaena: operador.puedeListaFaena,
            puedeRomaneo: operador.puedeRomaneo,
            puedeIngresoCajon: operador.puedeIngresoCajon,
            puedeMenudencias: operador.puedeMenudencias,
            puedeStock: operador.puedeStock,
            puedeReportes: operador.puedeReportes,
            puedeCCIR: operador.puedeCCIR,
            puedeFacturacion: operador.puedeFacturacion,
            puedeConfiguracion: operador.puedeConfiguracion
          }
        }
      })
    }
    
    return NextResponse.json(
      { success: false, error: 'Debe proporcionar usuario/password o PIN' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json(
      { success: false, error: 'Error de servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Logout
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { operadorId } = body
    
    if (operadorId) {
      // Registrar logout en auditoría
      await db.auditoria.create({
        data: {
          operadorId,
          modulo: 'AUTH',
          accion: 'LOGOUT',
          entidad: 'Operador',
          entidadId: operadorId,
          descripcion: 'Logout'
        }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en logout:', error)
    return NextResponse.json({ success: true })
  }
}
