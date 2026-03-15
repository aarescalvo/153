import { NextRequest, NextResponse } from 'next/server'

// GET - Verificar actualizaciones disponibles
export async function GET(request: NextRequest) {
  try {
    // Leer configuración del sistema
    const config = await getSistemaConfig()
    
    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'Configuración no encontrada'
      }, { status: 404 })
    }

    const repoUrl = config.GITHUB_REPO_URL || 'https://github.com/aarescalvo/153'
    const branch = config.GITHUB_BRANCH || 'master'
    const token = config.GITHUB_TOKEN

    // Obtener último commit del repositorio
    const repoPath = repoUrl.replace('https://github.com/', '').replace('.git', '')
    const apiUrl = `https://api.github.com/repos/${repoPath}/commits/${branch}`

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Solemar-Updater'
    }

    if (token) {
      headers['Authorization'] = `token ${token}`
    }

    const response = await fetch(apiUrl, { headers })
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar con GitHub',
        details: `Status: ${response.status}`
      }, { status: 500 })
    }

    const data = await response.json()
    
    const latestCommit = {
      sha: data.sha.substring(0, 7),
      message: data.commit.message.split('\n')[0],
      date: data.commit.committer.date,
      author: data.commit.author.name
    }

    // Obtener versión instalada (simulada)
    const installedCommit = 'local-dev'

    // Verificar si hay actualización disponible
    const updateAvailable = installedCommit !== latestCommit.sha

    return NextResponse.json({
      success: true,
      data: {
        installedVersion: installedCommit,
        latestVersion: latestCommit,
        updateAvailable,
        repository: repoUrl,
        branch: branch,
        lastChecked: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error verificando actualizaciones:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Función auxiliar para obtener configuración
async function getSistemaConfig(): Promise<Record<string, string> | null> {
  // En producción, esto leería desde el archivo de configuración
  // Por ahora, retornamos valores por defecto
  return {
    GITHUB_REPO_URL: 'https://github.com/aarescalvo/153',
    GITHUB_BRANCH: 'master',
    GITHUB_TOKEN: ''
  }
}
