import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import {
  runBackup,
  verifyBackup,
  cleanupOldBackups,
  getBackupConfig,
  calculateNextBackup,
  getBackupDir
} from '@/lib/backup-scheduler'

const execAsync = promisify(exec)

// GET - Listar backups disponibles con información adicional
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeHistory = searchParams.get('history') === 'true'
    const includeStats = searchParams.get('stats') === 'true'

    const backupDir = getBackupDir()
    
    // Crear directorio si no existe
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // Leer archivos de backup
    const files = fs.readdirSync(backupDir)
    
    const backups = files
      .filter(f => f.endsWith('.sql') || f.endsWith('.zip') || f.endsWith('.gz'))
      .map(f => {
        const filePath = path.join(backupDir, f)
        const stats = fs.statSync(filePath)
        
        return {
          name: f,
          path: filePath,
          size: formatBytes(stats.size),
          sizeBytes: stats.size,
          date: stats.mtime.toISOString(),
          type: f.endsWith('.zip') || f.endsWith('.gz') ? 'compressed' : 'sql'
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Estadísticas
    const totalSize = backups.reduce((acc, b) => acc + b.sizeBytes, 0)
    
    // Obtener configuración
    const config = await getBackupConfig()
    
    // Preparar respuesta
    const response: Record<string, unknown> = {
      success: true,
      data: {
        backups,
        total: backups.length,
        totalSize: formatBytes(totalSize),
        totalSizeBytes: totalSize,
        backupDir,
        config: config ? {
          enabled: config.enabled,
          frecuencia: config.frecuencia,
          hora: config.hora,
          minuto: config.minuto,
          ultimoBackup: config.ultimoBackup?.toISOString() || null,
          proximoBackup: config ? calculateNextBackup(config).toISOString() : null,
          ultimoEstado: config.ultimoEstado,
          ultimoError: config.ultimoError
        } : null
      }
    }

    // Incluir historial de la base de datos
    if (includeHistory) {
      const historial = await db.historialBackup.findMany({
        orderBy: { fecha: 'desc' },
        take: 50
      })
      response.data = {
        ...response.data as object,
        historial
      }
    }

    // Incluir estadísticas detalladas
    if (includeStats) {
      const statsData = {
        totalBackups: backups.length,
        totalSizeBytes: totalSize,
        totalSizeMB: totalSize / (1024 * 1024),
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].date : null,
        newestBackup: backups.length > 0 ? backups[0].date : null,
        avgBackupSize: backups.length > 0 ? totalSize / backups.length : 0,
        backupsHoy: backups.filter(b => {
          const backupDate = new Date(b.date)
          const today = new Date()
          return backupDate.toDateString() === today.toDateString()
        }).length,
        backupsEstaSemana: backups.filter(b => {
          const backupDate = new Date(b.date)
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          return backupDate >= weekAgo
        }).length
      }
      response.data = {
        ...response.data as object,
        stats: statsData
      }
    }
    
    return NextResponse.json(response)

  } catch (error) {
    console.error('Error listando backups:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al listar backups',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Crear nuevo backup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { includeFiles = false, compress = true, verify = false } = body

    // Ejecutar backup
    const result = await runBackup('MANUAL')

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Error al crear backup'
      }, { status: 500 })
    }

    // Verificar integridad si se solicitó
    let verification = null
    if (verify && result.file) {
      verification = await verifyBackup(result.file)
    }

    return NextResponse.json({
      success: true,
      message: 'Backup creado exitosamente',
      data: {
        file: result.file,
        size: result.size,
        sizeFormatted: result.size ? formatBytes(result.size * 1024 * 1024) : null,
        duration: result.duration,
        durationFormatted: result.duration ? `${result.duration}ms` : null,
        verification
      }
    })

  } catch (error) {
    console.error('Error creando backup:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear backup',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE - Eliminar backup
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('file')

    if (!fileName) {
      return NextResponse.json({
        success: false,
        error: 'Nombre de archivo requerido'
      }, { status: 400 })
    }

    const backupDir = getBackupDir()
    const filePath = path.join(backupDir, fileName)

    // Verificar que el archivo existe y está en el directorio de backups
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        success: false,
        error: 'Archivo no encontrado'
      }, { status: 404 })
    }

    // Verificar que no es un path traversal
    const resolvedPath = path.resolve(filePath)
    if (!resolvedPath.startsWith(backupDir)) {
      return NextResponse.json({
        success: false,
        error: 'Acceso no autorizado'
      }, { status: 403 })
    }

    // Obtener tamaño antes de eliminar
    const stats = fs.statSync(filePath)
    const sizeMB = stats.size / (1024 * 1024)

    fs.unlinkSync(filePath)

    // Eliminar del historial
    await db.historialBackup.deleteMany({
      where: { archivo: fileName }
    })

    // Actualizar espacio usado en configuración
    const config = await getBackupConfig()
    if (config) {
      await db.configuracionBackup.update({
        where: { id: config.id },
        data: {
          espacioUsado: Math.max(0, config.espacioUsado - sizeMB)
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Backup eliminado exitosamente',
      data: { 
        file: fileName,
        freedMB: sizeMB
      }
    })

  } catch (error) {
    console.error('Error eliminando backup:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar backup',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Función auxiliar para formatear bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
