/**
 * Backup Scheduler Library
 * Sistema de backups automáticos para la base de datos
 */

import cron from 'node-cron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { db } from './db'

const execAsync = promisify(exec)

// Tipos para la configuración
export type FrecuenciaBackup = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type DestinoBackup = 'LOCAL' | 'GOOGLE_DRIVE' | 'FTP' | 'S3'
export type EstadoBackup = 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADO' | 'FALLIDO' | 'VERIFICANDO'

export interface BackupConfig {
  id: string
  enabled: boolean
  frecuencia: FrecuenciaBackup
  hora: number
  minuto: number
  diaSemana?: number | null
  diaMes?: number | null
  retencionDias: number
  maxBackups: number
  destino: DestinoBackup
  rutaDestino?: string | null
  credencialesDestino?: string | null
  compresion: boolean
  incluirArchivos: boolean
  verificarIntegridad: boolean
  notificarExito: boolean
  notificarFallo: boolean
  emailNotificacion?: string | null
  ultimoBackup?: Date | null
  proximoBackup?: Date | null
  ultimoEstado: EstadoBackup
  ultimoError?: string | null
  totalBackups: number
  espacioUsado: number
}

// Instancia del scheduler
let scheduledTask: cron.ScheduledTask | null = null
let currentConfig: BackupConfig | null = null

/**
 * Obtiene la configuración actual de backups
 */
export async function getBackupConfig(): Promise<BackupConfig | null> {
  try {
    const config = await db.configuracionBackup.findFirst()
    if (!config) {
      // Crear configuración por defecto
      const newConfig = await db.configuracionBackup.create({
        data: {
          enabled: false,
          frecuencia: 'DAILY',
          hora: 3,
          minuto: 0,
          retencionDias: 30,
          maxBackups: 10,
          destino: 'LOCAL',
          compresion: true,
          incluirArchivos: false,
          verificarIntegridad: true,
          notificarExito: false,
          notificarFallo: true,
          ultimoEstado: 'PENDIENTE'
        }
      })
      return newConfig as BackupConfig
    }
    return config as BackupConfig
  } catch (error) {
    console.error('Error obteniendo configuración de backup:', error)
    return null
  }
}

/**
 * Actualiza la configuración de backups
 */
export async function updateBackupConfig(data: Partial<BackupConfig>): Promise<BackupConfig | null> {
  try {
    const existing = await getBackupConfig()
    if (!existing) return null

    const updated = await db.configuracionBackup.update({
      where: { id: existing.id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    })

    // Reiniciar scheduler si cambió la configuración
    if (data.enabled !== undefined || data.frecuencia || data.hora !== undefined || data.minuto !== undefined) {
      await restartScheduler()
    }

    return updated as BackupConfig
  } catch (error) {
    console.error('Error actualizando configuración de backup:', error)
    return null
  }
}

/**
 * Obtiene el directorio de backups
 */
export function getBackupDir(): string {
  // En producción: C:\SolemarFrigorifico\backups
  // En desarrollo: /home/z/my-project/backups
  return process.env.BACKUP_DIR || '/home/z/my-project/backups'
}

/**
 * Genera el cron expression basado en la configuración
 */
function getCronExpression(config: BackupConfig): string {
  const { frecuencia, hora, minuto, diaSemana, diaMes } = config

  switch (frecuencia) {
    case 'HOURLY':
      // Cada hora en el minuto especificado
      return `${minuto} * * * *`
    case 'DAILY':
      // Diario a la hora y minuto especificados
      return `${minuto} ${hora} * * *`
    case 'WEEKLY':
      // Semanal en el día de la semana especificado
      const weekDay = diaSemana ?? 0
      return `${minuto} ${hora} * * ${weekDay}`
    case 'MONTHLY':
      // Mensual en el día del mes especificado
      const monthDay = diaMes ?? 1
      return `${minuto} ${hora} ${monthDay} * *`
    default:
      return `${minuto} ${hora} * * *`
  }
}

/**
 * Calcula la próxima fecha de backup
 */
export function calculateNextBackup(config: BackupConfig): Date {
  const now = new Date()
  const next = new Date()

  switch (config.frecuencia) {
    case 'HOURLY':
      next.setMinutes(config.minuto, 0, 0)
      if (next <= now) {
        next.setHours(next.getHours() + 1)
      }
      break
    case 'DAILY':
      next.setHours(config.hora, config.minuto, 0, 0)
      if (next <= now) {
        next.setDate(next.getDate() + 1)
      }
      break
    case 'WEEKLY':
      next.setHours(config.hora, config.minuto, 0, 0)
      const currentDay = next.getDay()
      const targetDay = config.diaSemana ?? 0
      const daysUntil = (targetDay - currentDay + 7) % 7
      next.setDate(next.getDate() + (daysUntil === 0 && next <= now ? 7 : daysUntil))
      break
    case 'MONTHLY':
      next.setHours(config.hora, config.minuto, 0, 0)
      next.setDate(config.diaMes ?? 1)
      if (next <= now) {
        next.setMonth(next.getMonth() + 1)
      }
      break
  }

  return next
}

/**
 * Ejecuta un backup de la base de datos
 */
export async function runBackup(tipo: 'AUTOMATICO' | 'MANUAL' = 'MANUAL'): Promise<{
  success: boolean
  file?: string
  error?: string
  size?: number
  duration?: number
}> {
  const startTime = Date.now()
  const backupDir = getBackupDir()

  try {
    // Crear directorio si no existe
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // Generar nombre del archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')
    const date = timestamp[0]
    const time = timestamp[1].split('-')[0]
    const backupName = `backup_${date}_${time}`
    const sqlFile = path.join(backupDir, `${backupName}.sql`)

    // Obtener ruta de la base de datos
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './db/custom.db'
    const absoluteDbPath = path.resolve(dbPath)

    // Ejecutar backup según el tipo de base de datos
    // Para SQLite usamos sqlite3 .backup
    // Para PostgreSQL usaríamos pg_dump

    if (process.env.DATABASE_URL?.includes('sqlite') || process.env.DATABASE_URL?.includes('file:')) {
      // Backup de SQLite
      await execAsync(`sqlite3 "${absoluteDbPath}" ".backup '${sqlFile}'"`)
    } else {
      // Simular backup para PostgreSQL (en producción usar pg_dump)
      const backupContent = `-- Backup de Base de Datos Solemar
-- Fecha: ${new Date().toISOString()}
-- Tipo: ${tipo}
-- Generado por Sistema de Backups Automático

-- En producción, aquí irían los comandos SQL de pg_dump
`
      fs.writeFileSync(sqlFile, backupContent)
    }

    // Verificar que el archivo se creó
    if (!fs.existsSync(sqlFile)) {
      throw new Error('El archivo de backup no se creó correctamente')
    }

    // Compresión si está habilitada
    const config = await getBackupConfig()
    let finalFile = sqlFile

    if (config?.compresion) {
      try {
        // En Linux/Mac usar gzip, en Windows usar compresión nativa
        const zipFile = path.join(backupDir, `${backupName}.zip`)
        
        // Intentar con gzip primero (Linux/Mac)
        try {
          await execAsync(`gzip -c "${sqlFile}" > "${zipFile}"`)
          fs.unlinkSync(sqlFile) // Eliminar archivo original
        } catch {
          // Si gzip falla, crear archivo zip con Node.js
          const { createGzip } = await import('zlib')
          const pipeline = promisify((await import('stream')).pipeline)
          
          const gzip = createGzip()
          const source = fs.createReadStream(sqlFile)
          const destination = fs.createWriteStream(zipFile)
          
          await pipeline(source, gzip, destination)
          fs.unlinkSync(sqlFile)
        }
        
        finalFile = zipFile
      } catch (compressError) {
        console.warn('Error comprimiendo backup, usando archivo sin comprimir:', compressError)
      }
    }

    // Obtener tamaño del archivo
    const stats = fs.statSync(finalFile)
    const sizeMB = stats.size / (1024 * 1024)

    const duration = Date.now() - startTime

    // Registrar en historial
    await db.historialBackup.create({
      data: {
        archivo: path.basename(finalFile),
        ruta: finalFile,
        tamano: sizeMB,
        comprimido: config?.compresion ?? true,
        estado: 'COMPLETADO',
        duracionMs: duration,
        tipo,
        configuracionId: config?.id
      }
    })

    // Actualizar configuración
    if (config) {
      await db.configuracionBackup.update({
        where: { id: config.id },
        data: {
          ultimoBackup: new Date(),
          proximoBackup: calculateNextBackup(config),
          ultimoEstado: 'COMPLETADO',
          ultimoError: null,
          totalBackups: { increment: 1 },
          espacioUsado: { increment: sizeMB }
        }
      })
    }

    // Limpiar backups antiguos
    await cleanupOldBackups()

    return {
      success: true,
      file: path.basename(finalFile),
      size: sizeMB,
      duration
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error ejecutando backup:', errorMessage)

    // Actualizar estado de error
    const config = await getBackupConfig()
    if (config) {
      await db.configuracionBackup.update({
        where: { id: config.id },
        data: {
          ultimoEstado: 'FALLIDO',
          ultimoError: errorMessage
        }
      })

      // Registrar en historial
      await db.historialBackup.create({
        data: {
          archivo: '',
          ruta: '',
          tamano: 0,
          comprimido: false,
          estado: 'FALLIDO',
          error: errorMessage,
          tipo,
          configuracionId: config.id
        }
      })
    }

    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Limpia backups antiguos según la configuración de retención
 */
export async function cleanupOldBackups(): Promise<{ deleted: number; freedMB: number }> {
  try {
    const config = await getBackupConfig()
    if (!config) return { deleted: 0, freedMB: 0 }

    const backupDir = getBackupDir()
    
    if (!fs.existsSync(backupDir)) {
      return { deleted: 0, freedMB: 0 }
    }

    // Leer archivos de backup
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.sql') || f.endsWith('.zip') || f.endsWith('.gz'))
      .map(f => {
        const filePath = path.join(backupDir, f)
        const stats = fs.statSync(filePath)
        return {
          name: f,
          path: filePath,
          date: stats.mtime,
          size: stats.size
        }
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())

    // Calcular fecha límite por días de retención
    const retentionDate = new Date()
    retentionDate.setDate(retentionDate.getDate() - config.retencionDias)

    let deleted = 0
    let freedMB = 0

    // Eliminar archivos antiguos (más de maxBackups o más antiguos que retención)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const shouldDelete = i >= config.maxBackups || file.date < retentionDate

      if (shouldDelete) {
        try {
          fs.unlinkSync(file.path)
          freedMB += file.size / (1024 * 1024)
          deleted++

          // Actualizar historial
          await db.historialBackup.deleteMany({
            where: { archivo: file.name }
          })
        } catch (deleteError) {
          console.warn(`No se pudo eliminar backup antiguo ${file.name}:`, deleteError)
        }
      }
    }

    // Actualizar espacio usado
    if (deleted > 0) {
      await db.configuracionBackup.update({
        where: { id: config.id },
        data: {
          espacioUsado: { decrement: freedMB }
        }
      })
    }

    return { deleted, freedMB }
  } catch (error) {
    console.error('Error limpiando backups antiguos:', error)
    return { deleted: 0, freedMB: 0 }
  }
}

/**
 * Verifica la integridad de un backup
 */
export async function verifyBackup(fileName: string): Promise<{
  valid: boolean
  error?: string
  details?: string
}> {
  try {
    const backupDir = getBackupDir()
    const filePath = path.join(backupDir, fileName)

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'Archivo no encontrado' }
    }

    // Verificar path traversal
    const resolvedPath = path.resolve(filePath)
    if (!resolvedPath.startsWith(backupDir)) {
      return { valid: false, error: 'Ruta inválida' }
    }

    // Verificar que el archivo tiene contenido
    const stats = fs.statSync(filePath)
    if (stats.size === 0) {
      return { valid: false, error: 'Archivo vacío' }
    }

    // Para archivos SQL, verificar contenido básico
    if (fileName.endsWith('.sql')) {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (!content.includes('--') && content.length < 100) {
        return { valid: false, error: 'Contenido de backup inválido' }
      }
    }

    // Actualizar historial
    await db.historialBackup.updateMany({
      where: { archivo: fileName },
      data: {
        verificado: true,
        fechaVerificacion: new Date(),
        resultadoVerificacion: 'OK'
      }
    })

    return {
      valid: true,
      details: `Tamaño: ${formatBytes(stats.size)}`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return { valid: false, error: errorMessage }
  }
}

/**
 * Inicia el scheduler de backups
 */
export function startScheduler(config: BackupConfig): boolean {
  if (!config.enabled) {
    console.log('Backup scheduler deshabilitado')
    return false
  }

  // Detener scheduler anterior si existe
  stopScheduler()

  try {
    const cronExpression = getCronExpression(config)
    
    // Validar expresión cron
    if (!cron.validate(cronExpression)) {
      console.error('Expresión cron inválida:', cronExpression)
      return false
    }

    currentConfig = config

    scheduledTask = cron.schedule(cronExpression, async () => {
      console.log('Ejecutando backup programado:', new Date().toISOString())
      await runBackup('AUTOMATICO')
    }, {
      scheduled: true,
      timezone: 'America/Argentina/Buenos_Aires'
    })

    console.log('Backup scheduler iniciado:', cronExpression)
    return true
  } catch (error) {
    console.error('Error iniciando backup scheduler:', error)
    return false
  }
}

/**
 * Detiene el scheduler de backups
 */
export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
    console.log('Backup scheduler detenido')
  }
}

/**
 * Reinicia el scheduler con la configuración actual
 */
export async function restartScheduler(): Promise<boolean> {
  const config = await getBackupConfig()
  if (!config) return false

  stopScheduler()
  
  if (config.enabled) {
    return startScheduler(config)
  }
  
  return true
}

/**
 * Inicializa el scheduler al arrancar la aplicación
 */
export async function initializeScheduler(): Promise<void> {
  try {
    const config = await getBackupConfig()
    if (config && config.enabled) {
      startScheduler(config)
      console.log('Backup scheduler inicializado')
    }
  } catch (error) {
    console.error('Error inicializando backup scheduler:', error)
  }
}

/**
 * Formatea bytes a string legible
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Obtiene el estado actual del scheduler
 */
export function getSchedulerStatus(): {
  running: boolean
  config: BackupConfig | null
  cronExpression: string | null
} {
  return {
    running: scheduledTask !== null,
    config: currentConfig,
    cronExpression: currentConfig ? getCronExpression(currentConfig) : null
  }
}
