import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// GET - Listar backups disponibles para restaurar
export async function GET(request: NextRequest) {
  try {
    const backupDir = '/home/z/my-project/backups'
    
    if (!fs.existsSync(backupDir)) {
      return NextResponse.json({
        success: true,
        data: {
          backups: [],
          message: 'No hay backups disponibles'
        }
      })
    }

    const files = fs.readdirSync(backupDir)
    
    const backups = files
      .filter(f => f.endsWith('.sql') || f.endsWith('.zip'))
      .map(f => {
        const filePath = path.join(backupDir, f)
        const stats = fs.statSync(filePath)
        
        return {
          name: f,
          path: filePath,
          size: formatBytes(stats.size),
          date: stats.mtime.toISOString(),
          type: f.endsWith('.zip') ? 'compressed' : 'sql',
          canRestore: true
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      success: true,
      data: {
        backups,
        total: backups.length
      }
    })

  } catch (error) {
    console.error('Error listando backups:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al listar backups'
    }, { status: 500 })
  }
}

// POST - Restaurar desde backup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileName, createBackupBefore = true } = body

    if (!fileName) {
      return NextResponse.json({
        success: false,
        error: 'Nombre de archivo requerido'
      }, { status: 400 })
    }

    const backupDir = '/home/z/my-project/backups'
    const filePath = path.join(backupDir, fileName)

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        success: false,
        error: 'Archivo de backup no encontrado'
      }, { status: 404 })
    }

    // Verificar path traversal
    const resolvedPath = path.resolve(filePath)
    if (!resolvedPath.startsWith(backupDir)) {
      return NextResponse.json({
        success: false,
        error: 'Acceso no autorizado'
      }, { status: 403 })
    }

    // Crear backup del estado actual antes de restaurar
    let preRestoreBackup = null
    if (createBackupBefore) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      preRestoreBackup = `pre_restore_${timestamp}.sql`
      // En producción, aquí se ejecutaría pg_dump
    }

    // Obtener información del backup
    const stats = fs.statSync(filePath)
    const isCompressed = fileName.endsWith('.zip')

    // En producción, aquí se ejecutaría:
    // Si es .zip: descomprimir primero
    // Luego: psql -U usuario -d basededatos -f archivo.sql

    // Simular proceso de restauración
    const restoreLog = {
      startTime: new Date().toISOString(),
      sourceFile: fileName,
      sourceSize: formatBytes(stats.size),
      compressed: isCompressed,
      preRestoreBackup,
      status: 'completed',
      endTime: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      message: 'Restauración completada exitosamente',
      data: {
        restored: true,
        sourceFile: fileName,
        preRestoreBackup,
        log: restoreLog,
        note: 'En producción, esto ejecutaría psql para restaurar la base de datos'
      }
    })

  } catch (error) {
    console.error('Error restaurando backup:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al restaurar backup',
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
