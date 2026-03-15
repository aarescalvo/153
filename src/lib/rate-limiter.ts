/**
 * Rate Limiter para prevenir ataques brute force
 * Implementa rate limiting en memoria con ventanas deslizantes
 */

interface RateLimitEntry {
  count: number
  resetTime: number
  blocked: boolean
}

interface RateLimitConfig {
  windowMs: number // Ventana de tiempo en milisegundos
  maxRequests: number // Máximo de requests permitidos en la ventana
  blockDurationMs: number // Duración del bloqueo en ms
}

// Almacén en memoria para rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>()

// Limpieza periódica de entradas expiradas (cada 5 minutos)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now && !entry.blocked) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Configuraciones predefinidas para diferentes tipos de endpoints
 */
export const RATE_LIMIT_CONFIGS = {
  // Para login - muy restrictivo
  AUTH_LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 5, // 5 intentos
    blockDurationMs: 30 * 60 * 1000, // 30 minutos de bloqueo
  },
  // Para PIN - moderadamente restrictivo
  AUTH_PIN: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    maxRequests: 10, // 10 intentos
    blockDurationMs: 15 * 60 * 1000, // 15 minutos de bloqueo
  },
  // Para supervisor - restrictivo
  AUTH_SUPERVISOR: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 3, // 3 intentos
    blockDurationMs: 30 * 60 * 1000, // 30 minutos de bloqueo
  },
  // Para APIs generales - permisivo
  API_GENERAL: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 100, // 100 requests
    blockDurationMs: 60 * 1000, // 1 minuto de bloqueo
  },
  // Para escritura - moderado
  API_WRITE: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 30, // 30 requests
    blockDurationMs: 2 * 60 * 1000, // 2 minutos de bloqueo
  },
} as const

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS

/**
 * Resultado del rate limiting
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number // Segundos hasta que se pueda reintentar
  blocked: boolean
}

/**
 * Obtiene una clave única para rate limiting
 * Combina IP + identificador adicional (ej: usuario)
 */
export function getRateLimitKey(
  ip: string | null,
  identifier?: string
): string {
  const baseKey = ip || 'unknown-ip'
  return identifier ? `${baseKey}:${identifier}` : baseKey
}

/**
 * Extrae la IP del request de manera segura
 */
export function getClientIp(request: Request): string | null {
  // Intentar obtener IP de headers (para proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Tomar la primera IP (cliente original)
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // En desarrollo, no hay IP real
  return null
}

/**
 * Verifica si una request está permitida bajo rate limiting
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // Si no hay entrada previa, crear una nueva
  if (!entry) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      blocked: false,
    })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
      blocked: false,
    }
  }

  // Si está bloqueado, verificar si ya pasó el tiempo de bloqueo
  if (entry.blocked) {
    const blockEndTime = entry.resetTime + config.blockDurationMs
    if (now < blockEndTime) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockEndTime,
        retryAfter: Math.ceil((blockEndTime - now) / 1000),
        blocked: true,
      }
    }
    // El bloqueo terminó, reiniciar contador
    entry.blocked = false
    entry.count = 0
    entry.resetTime = now + config.windowMs
  }

  // Verificar si la ventana ha expirado
  if (now > entry.resetTime) {
    entry.count = 1
    entry.resetTime = now + config.windowMs
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: entry.resetTime,
      blocked: false,
    }
  }

  // Incrementar contador
  entry.count++

  // Verificar si se excede el límite
  if (entry.count > config.maxRequests) {
    entry.blocked = true
    const blockEndTime = entry.resetTime + config.blockDurationMs
    return {
      allowed: false,
      remaining: 0,
      resetTime: blockEndTime,
      retryAfter: Math.ceil((blockEndTime - now) / 1000),
      blocked: true,
    }
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
    blocked: false,
  }
}

/**
 * Resetea el contador de rate limit para una clave
 * (usar después de un login exitoso)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key)
}

/**
 * Obtiene estadísticas actuales del rate limiter
 */
export function getRateLimitStats(): {
  totalEntries: number
  blockedEntries: number
} {
  let blockedCount = 0
  for (const entry of rateLimitStore.values()) {
    if (entry.blocked) blockedCount++
  }
  return {
    totalEntries: rateLimitStore.size,
    blockedEntries: blockedCount,
  }
}
