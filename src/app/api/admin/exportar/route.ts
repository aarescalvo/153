import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Exportar datos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv' // csv, excel, pdf
    const tipo = searchParams.get('tipo') || 'tropas' // tropas, animales, romaneos, clientes, completo

    // Obtener datos según el tipo
    let data: unknown[] = []
    let headers: string[] = []
    let fileName = ''

    switch (tipo) {
      case 'tropas':
        data = await db.tropa.findMany({
          include: {
            productor: true,
            usuarioFaena: true,
            corral: true
          },
          orderBy: { fechaRecepcion: 'desc' }
        })
        headers = ['Número', 'Código', 'Especie', 'Cabezas', 'Productor', 'Usuario Faena', 'Corral', 'Estado', 'Fecha']
        fileName = `tropas_${new Date().toISOString().split('T')[0]}`
        break

      case 'animales':
        data = await db.animal.findMany({
          include: {
            tropa: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1000 // Limitar para no sobrecargar
        })
        headers = ['Código', 'Tropa', 'Tipo', 'Peso Vivo', 'Estado', 'Corral']
        fileName = `animales_${new Date().toISOString().split('T')[0]}`
        break

      case 'romaneos':
        data = await db.romaneo.findMany({
          include: {
            tipificador: true
          },
          orderBy: { fecha: 'desc' },
          take: 1000
        })
        headers = ['Garrón', 'Tropa', 'Peso Vivo', 'Media Izq', 'Media Der', 'Total', 'Rinde %', 'Tipificador', 'Fecha']
        fileName = `romaneos_${new Date().toISOString().split('T')[0]}`
        break

      case 'clientes':
        data = await db.cliente.findMany({
          orderBy: { nombre: 'asc' }
        })
        headers = ['Nombre', 'CUIT', 'Teléfono', 'Localidad', 'Es Productor', 'Es Usuario Faena']
        fileName = `clientes_${new Date().toISOString().split('T')[0]}`
        break

      case 'completo':
        // Exportar resumen completo
        const [tropas, animales, clientes, corrales] = await Promise.all([
          db.tropa.count(),
          db.animal.count(),
          db.cliente.count(),
          db.corral.count()
        ])
        data = [{
          tropas,
          animales,
          clientes,
          corrales,
          fechaExportacion: new Date().toISOString()
        }]
        headers = ['Métrica', 'Valor']
        fileName = `resumen_${new Date().toISOString().split('T')[0]}`
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Tipo de exportación no válido'
        }, { status: 400 })
    }

    // Formatear datos según el formato solicitado
    let content: string
    let contentType: string
    let fileExtension: string

    switch (format) {
      case 'csv':
        content = generateCSV(data, headers, tipo)
        contentType = 'text/csv'
        fileExtension = 'csv'
        break

      case 'excel':
        // Para Excel, generamos CSV compatible (en producción usaríamos xlsx)
        content = generateCSV(data, headers, tipo)
        contentType = 'application/vnd.ms-excel'
        fileExtension = 'xls'
        break

      case 'pdf':
        // Para PDF, generamos HTML que se puede imprimir
        content = generateHTML(data, headers, tipo)
        contentType = 'text/html'
        fileExtension = 'html'
        break

      case 'json':
        content = JSON.stringify(data, null, 2)
        contentType = 'application/json'
        fileExtension = 'json'
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Formato no válido. Use: csv, excel, pdf, json'
        }, { status: 400 })
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}.${fileExtension}"`
      }
    })

  } catch (error) {
    console.error('Error exportando datos:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al exportar datos',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Función para generar CSV
function generateCSV(data: unknown[], headers: string[], tipo: string): string {
  const rows: string[][] = [headers]

  data.forEach((item: unknown) => {
    const record = item as Record<string, unknown>
    
    switch (tipo) {
      case 'tropas':
        rows.push([
          String(record.numero || ''),
          String(record.codigo || ''),
          String(record.especie || ''),
          String(record.cantidadCabezas || ''),
          String((record.productor as Record<string, unknown>)?.nombre || ''),
          String((record.usuarioFaena as Record<string, unknown>)?.nombre || ''),
          String((record.corral as Record<string, unknown>)?.nombre || ''),
          String(record.estado || ''),
          String(record.fechaRecepcion ? new Date(record.fechaRecepcion as string).toLocaleDateString('es-AR') : '')
        ])
        break

      case 'animales':
        rows.push([
          String(record.codigo || ''),
          String((record.tropa as Record<string, unknown>)?.codigo || ''),
          String(record.tipoAnimal || ''),
          String(record.pesoVivo || ''),
          String(record.estado || ''),
          String(record.corralId || '')
        ])
        break

      case 'romaneos':
        rows.push([
          String(record.garron || ''),
          String(record.tropaCodigo || ''),
          String(record.pesoVivo || ''),
          String(record.pesoMediaIzq || ''),
          String(record.pesoMediaDer || ''),
          String(record.pesoTotal || ''),
          String(record.rinde ? `${record.rinde}%` : ''),
          String((record.tipificador as Record<string, unknown>)?.nombre || ''),
          String(record.fecha ? new Date(record.fecha as string).toLocaleDateString('es-AR') : '')
        ])
        break

      case 'clientes':
        rows.push([
          String(record.nombre || ''),
          String(record.cuit || ''),
          String(record.telefono || ''),
          String(record.localidad || ''),
          String(record.esProductor ? 'Sí' : 'No'),
          String(record.esUsuarioFaena ? 'Sí' : 'No')
        ])
        break

      default:
        rows.push(Object.values(record).map(v => String(v || '')))
    }
  })

  return rows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n')
}

// Función para generar HTML (para PDF)
function generateHTML(data: unknown[], headers: string[], tipo: string): string {
  const title = `Reporte de ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`
  const date = new Date().toLocaleDateString('es-AR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  const rows = (data as Record<string, unknown>[]).map((record) => {
    switch (tipo) {
      case 'tropas':
        return `
          <tr>
            <td>${record.numero || ''}</td>
            <td>${record.codigo || ''}</td>
            <td>${record.especie || ''}</td>
            <td>${record.cantidadCabezas || ''}</td>
            <td>${(record.productor as Record<string, unknown>)?.nombre || '-'}</td>
            <td>${(record.usuarioFaena as Record<string, unknown>)?.nombre || ''}</td>
            <td>${record.estado || ''}</td>
          </tr>
        `
      default:
        return `<tr><td colspan="${headers.length}">Ver datos</td></tr>`
    }
  }).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
    .date { color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f59e0b; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="date">Generado el ${date}</p>
  
  <table>
    <thead>
      <tr>
        ${headers.map(h => `<th>${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  
  <p class="footer">
    Sistema Frigorífico - Solemar Alimentaria
  </p>
  
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
  `
}
