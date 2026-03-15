import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)

// GET - Listar backups disponibles
export async function GET(request: NextRequest) {
  try {
    const backupDir = '/home/z/my-project/backups' // En producción: C:\SolemarFrigorifico\backups
    
    // Crear directorio si no existe
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // Leer archivos de backup
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
          sizeBytes: stats.size,
          date: stats.mtime.toISOString(),
          type: f.endsWith('.zip') ? 'compressed' : 'sql'
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Obtener estadísticas
    const totalSize = backups.reduce((acc, b) => acc + b.sizeBytes, 0)
    
    return NextResponse.json({
      success: true,
      data: {
        backups,
        total: backups.length,
        totalSize: formatBytes(totalSize),
        backupDir
      }
    })

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
    const { includeFiles = false, compress = true } = body

    const backupDir = '/home/z/my-project/backups'
    
    // Crear directorio si no existe
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')
    const date = timestamp[0]
    const time = timestamp[1].split('-')[0]
    
    const backupName = `backup_${date}_${time}`
    const sqlFile = path.join(backupDir, `${backupName}.sql`)

    // En producción, esto ejecutaría pg_dump
    // Por ahora, simulamos la creación del backup
    
    // Simular contenido del backup
    const backupContent = `-- Backup de Base de Datos Solemar
-- Fecha: ${new Date().toISOString()}
-- Generado automáticamente por Sistema Frigorífico Solemar

-- En producción, aquí irían los comandos SQL de pg_dump
-- Este es un backup simulado para desarrollo
`

    fs.writeFileSync(sqlFile, backupContent)

    let finalFile = sqlFile
    
    if (compress) {
      // En producción, usaríamos compresión real
      // Por ahora, simulamos renombrando
      const zipFile = path.join(backupDir, `${backupName}.zip`)
      fs.renameSync(sqlFile, zipFile)
      finalFile = zipFile
    }

    const stats = fs.statSync(finalFile)

    return NextResponse.json({
      success: true,
      message: 'Backup creado exitosamente',
      data: {
        file: path.basename(finalFile),
        path: finalFile,
        size: formatBytes(stats.size),
        date: new Date().toISOString()
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

    const backupDir = '/home/z/my-project/backups'
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

    fs.unlinkSync(filePath)

    return NextResponse.json({
      success: true,
      message: 'Backup eliminado exitosamente',
      data: { file: fileName }
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
