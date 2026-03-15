'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  TrendingUp,
  Package,
  Truck,
  Calendar,
  Download,
  FileText,
  Loader2,
  Beef,
  Weight,
  Users,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'

// Types
interface Operador {
  id: string
  nombre: string
  rol: string
}

interface KPIs {
  totalKgFaenados: number
  totalCabezas: number
  rindePromedio: number
  comparativaAnterior: {
    kgFaenadosDiff: number
    cabezasDiff: number
    rindeDiff: number
  }
}

interface ProduccionDiaria {
  fecha: string
  kgFaenados: number
  cabezas: number
  rindePromedio: number
}

interface RindeProductor {
  productorId: string | null
  productorNombre: string
  totalCabezas: number
  totalKgVivo: number
  totalKgMedia: number
  rindePromedio: number
  posicion: number
}

interface RindeAnimal {
  tipoAnimal: string
  cantidad: number
  totalKgVivo: number
  totalKgMedia: number
  rindePromedio: number
  rindeMin: number
  rindeMax: number
}

interface StockCamara {
  camaraId: string
  camaraNombre: string
  tipoCamara: string
  totalPiezas: number
  totalKg: number
  capacidad: number
  porcentajeOcupacion: number
}

interface DespachoData {
  clienteId: string
  clienteNombre: string
  totalDespachos: number
  totalKg: number
  totalFacturado: number
}

interface CurvaFaena {
  dia: string
  diaNumero: number
  totalAnimales: number
  totalKg: number
  promedioDiario: number
}

interface Productor {
  id: string
  nombre: string
}

type TipoReporte = 'produccion' | 'rinde-productor' | 'rinde-animal' | 'stock-camaras' | 'despachos' | 'curva-faena'

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const TIPOS_REPORTE: { value: TipoReporte; label: string; icon: typeof TrendingUp }[] = [
  { value: 'produccion', label: 'Producción Diaria', icon: TrendingUp },
  { value: 'rinde-productor', label: 'Rinde por Productor', icon: Users },
  { value: 'rinde-animal', label: 'Rinde por Animal', icon: Beef },
  { value: 'stock-camaras', label: 'Stock Cámaras', icon: Package },
  { value: 'despachos', label: 'Despachos', icon: Truck },
  { value: 'curva-faena', label: 'Curva de Faena', icon: Calendar },
]

interface ReportesAvanzadosProps {
  operador: Operador
}

export function ReportesAvanzadosModule({ operador }: ReportesAvanzadosProps) {
  // State
  const [loading, setLoading] = useState(false)
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('produccion')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [especie, setEspecie] = useState<string>('')
  const [productorId, setProductorId] = useState<string>('')
  const [productores, setProductores] = useState<Productor[]>([])

  // Data
  const [data, setData] = useState<ProduccionDiaria[] | RindeProductor[] | RindeAnimal[] | StockCamara[] | DespachoData[] | CurvaFaena[]>([])
  const [kpis, setKpis] = useState<KPIs>({
    totalKgFaenados: 0,
    totalCabezas: 0,
    rindePromedio: 0,
    comparativaAnterior: { kgFaenadosDiff: 0, cabezasDiff: 0, rindeDiff: 0 }
  })

  // Cargar productores
  useEffect(() => {
    const fetchProductores = async () => {
      try {
        const res = await fetch('/api/clientes?esProductor=true')
        const result = await res.json()
        if (result.success) {
          setProductores(result.data)
        }
      } catch (error) {
        console.error('Error fetching productores:', error)
      }
    }
    fetchProductores()
  }, [])

  // Set default dates
  useEffect(() => {
    const hoy = new Date()
    const haceUnMes = new Date(hoy)
    haceUnMes.setMonth(haceUnMes.getMonth() - 1)

    setFechaHasta(hoy.toISOString().split('T')[0])
    setFechaDesde(haceUnMes.toISOString().split('T')[0])
  }, [])

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('tipo', tipoReporte)
      if (fechaDesde) params.append('fechaDesde', fechaDesde)
      if (fechaHasta) params.append('fechaHasta', fechaHasta)
      if (especie) params.append('especie', especie)
      if (productorId) params.append('productor', productorId)

      const res = await fetch(`/api/reportes/avanzados?${params.toString()}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
        setKpis(result.kpis)
      } else {
        toast.error('Error al cargar datos')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [tipoReporte, fechaDesde, fechaHasta, especie, productorId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Export functions
  const exportToExcel = () => {
    if (data.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    const headers = Object.keys(data[0] as Record<string, unknown>)
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(h => {
          const value = (row as Record<string, unknown>)[h]
          return typeof value === 'string' ? `"${value}"` : value
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `reporte_${tipoReporte}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('Archivo exportado')
  }

  const exportToPDF = () => {
    toast.info('Exportando a PDF...')
    window.print()
  }

  // Render KPI cards
  const renderKPICards = () => {
    if (tipoReporte !== 'produccion') return null

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Total KG Faenados</p>
                <p className="text-2xl font-bold text-amber-700">
                  {kpis.totalKgFaenados.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <Weight className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
            {kpis.comparativaAnterior.kgFaenadosDiff !== 0 && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${kpis.comparativaAnterior.kgFaenadosDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.comparativaAnterior.kgFaenadosDiff > 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(kpis.comparativaAnterior.kgFaenadosDiff).toFixed(1)}% vs período anterior
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Total Cabezas</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {kpis.totalCabezas.toLocaleString('es-AR')}
                </p>
              </div>
              <Beef className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
            {kpis.comparativaAnterior.cabezasDiff !== 0 && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${kpis.comparativaAnterior.cabezasDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.comparativaAnterior.cabezasDiff > 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(kpis.comparativaAnterior.cabezasDiff).toFixed(1)}% vs período anterior
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Rinde Promedio</p>
                <p className="text-2xl font-bold text-blue-700">
                  {kpis.rindePromedio.toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
            {kpis.comparativaAnterior.rindeDiff !== 0 && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${kpis.comparativaAnterior.rindeDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.comparativaAnterior.rindeDiff > 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(kpis.comparativaAnterior.rindeDiff).toFixed(1)}% vs período anterior
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">Promedio Diario</p>
                <p className="text-2xl font-bold text-purple-700">
                  {(kpis.totalCabezas / 30).toFixed(0)}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
            <p className="text-xs text-purple-500 mt-2">cabezas/día</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render charts based on report type
  const renderCharts = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      )
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-12 text-stone-400">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hay datos disponibles para el período seleccionado</p>
        </div>
      )
    }

    switch (tipoReporte) {
      case 'produccion':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart - Producción Diaria */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">KG Faenados por Día</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data as ProduccionDiaria[]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => value.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number) => [`${value.toLocaleString()} kg`, 'KG Faenados']}
                    />
                    <Bar dataKey="kgFaenados" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Line Chart - Rinde */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tendencia de Rinde</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data as ProduccionDiaria[]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => value.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Rinde']}
                    />
                    <Line
                      type="monotone"
                      dataKey="rindePromedio"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )

      case 'rinde-productor':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart - Ranking */}
            <Card className="border-0 shadow-md lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking de Productores por Rinde</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={(data as RindeProductor[]).slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="productorNombre"
                      tick={{ fontSize: 10 }}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Rinde']}
                    />
                    <Bar dataKey="rindePromedio" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )

      case 'rinde-animal':
        const animalData = data as RindeAnimal[]
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart - Distribución */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribución por Tipo Animal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={animalData}
                      dataKey="cantidad"
                      nameKey="tipoAnimal"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ tipoAnimal, percent }) => `${tipoAnimal} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {animalData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bar Chart - Rinde */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rinde Promedio por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={animalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="tipoAnimal" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Rinde']}
                    />
                    <Bar dataKey="rindePromedio" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )

      case 'stock-camaras':
        const stockData = data as StockCamara[]
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribución de Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stockData}
                      dataKey="totalKg"
                      nameKey="camaraNombre"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ camaraNombre, percent }) => `${camaraNombre} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {stockData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Stock']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bar Chart */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">KG por Cámara</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stockData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="camaraNombre" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Stock']}
                    />
                    <Bar dataKey="totalKg" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )

      case 'despachos':
        const despachoData = data as DespachoData[]
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <Card className="border-0 shadow-md lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top 10 Clientes por Facturación</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={despachoData.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="clienteNombre"
                      tick={{ fontSize: 10 }}
                      width={150}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Facturado']}
                    />
                    <Bar dataKey="totalFacturado" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )

      case 'curva-faena':
        const curvaData = data as CurvaFaena[]
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <Card className="border-0 shadow-md lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Curva de Faena Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={curvaData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="totalAnimales" name="Animales" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="totalKg" name="KG" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  // Render data table
  const renderTable = () => {
    if (loading || data.length === 0) return null

    const renderTableContent = () => {
      switch (tipoReporte) {
        case 'produccion':
          return (
            <table className="w-full text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2 text-right font-medium">KG Faenados</th>
                  <th className="px-4 py-2 text-right font-medium">Cabezas</th>
                  <th className="px-4 py-2 text-right font-medium">Rinde %</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data as ProduccionDiaria[]).map((row, i) => (
                  <tr key={i} className="hover:bg-stone-50">
                    <td className="px-4 py-2">{row.fecha}</td>
                    <td className="px-4 py-2 text-right">{row.kgFaenados.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{row.cabezas}</td>
                    <td className="px-4 py-2 text-right">{row.rindePromedio.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )

        case 'rinde-productor':
          return (
            <table className="w-full text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-4 py-2 text-center font-medium">#</th>
                  <th className="px-4 py-2 text-left font-medium">Productor</th>
                  <th className="px-4 py-2 text-right font-medium">Cabezas</th>
                  <th className="px-4 py-2 text-right font-medium">KG Vivo</th>
                  <th className="px-4 py-2 text-right font-medium">KG Media</th>
                  <th className="px-4 py-2 text-right font-medium">Rinde %</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data as RindeProductor[]).map((row) => (
                  <tr key={row.productorId || row.posicion} className="hover:bg-stone-50">
                    <td className="px-4 py-2 text-center">
                      <Badge variant={row.posicion <= 3 ? 'default' : 'outline'} className={row.posicion <= 3 ? 'bg-amber-500' : ''}>
                        {row.posicion}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-medium">{row.productorNombre}</td>
                    <td className="px-4 py-2 text-right">{row.totalCabezas}</td>
                    <td className="px-4 py-2 text-right">{row.totalKgVivo.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{row.totalKgMedia.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-bold">{row.rindePromedio.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )

        case 'rinde-animal':
          return (
            <table className="w-full text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-4 py-2 text-right font-medium">KG Vivo</th>
                  <th className="px-4 py-2 text-right font-medium">KG Media</th>
                  <th className="px-4 py-2 text-right font-medium">Rinde Min</th>
                  <th className="px-4 py-2 text-right font-medium">Rinde Prom</th>
                  <th className="px-4 py-2 text-right font-medium">Rinde Max</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data as RindeAnimal[]).map((row, i) => (
                  <tr key={i} className="hover:bg-stone-50">
                    <td className="px-4 py-2 font-medium">{row.tipoAnimal}</td>
                    <td className="px-4 py-2 text-right">{row.cantidad}</td>
                    <td className="px-4 py-2 text-right">{row.totalKgVivo.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{row.totalKgMedia.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-red-600">{row.rindeMin.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right font-bold">{row.rindePromedio.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right text-green-600">{row.rindeMax.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )

        case 'stock-camaras':
          return (
            <table className="w-full text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Cámara</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-right font-medium">Piezas</th>
                  <th className="px-4 py-2 text-right font-medium">KG</th>
                  <th className="px-4 py-2 text-right font-medium">Capacidad</th>
                  <th className="px-4 py-2 text-right font-medium">Ocupación</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data as StockCamara[]).map((row) => (
                  <tr key={row.camaraId} className="hover:bg-stone-50">
                    <td className="px-4 py-2 font-medium">{row.camaraNombre}</td>
                    <td className="px-4 py-2">{row.tipoCamara}</td>
                    <td className="px-4 py-2 text-right">{row.totalPiezas}</td>
                    <td className="px-4 py-2 text-right">{row.totalKg.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{row.capacidad}</td>
                    <td className="px-4 py-2 text-right">
                      <Badge variant={row.porcentajeOcupacion > 80 ? 'destructive' : row.porcentajeOcupacion > 60 ? 'default' : 'outline'} className={row.porcentajeOcupacion > 60 && row.porcentajeOcupacion <= 80 ? 'bg-amber-500' : ''}>
                        {row.porcentajeOcupacion.toFixed(0)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )

        case 'despachos':
          return (
            <table className="w-full text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Cliente</th>
                  <th className="px-4 py-2 text-right font-medium">Despachos</th>
                  <th className="px-4 py-2 text-right font-medium">KG</th>
                  <th className="px-4 py-2 text-right font-medium">Facturado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data as DespachoData[]).map((row) => (
                  <tr key={row.clienteId} className="hover:bg-stone-50">
                    <td className="px-4 py-2 font-medium">{row.clienteNombre}</td>
                    <td className="px-4 py-2 text-right">{row.totalDespachos}</td>
                    <td className="px-4 py-2 text-right">{row.totalKg.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-bold">${row.totalFacturado.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )

        case 'curva-faena':
          return (
            <table className="w-full text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Día</th>
                  <th className="px-4 py-2 text-right font-medium">Total Animales</th>
                  <th className="px-4 py-2 text-right font-medium">Total KG</th>
                  <th className="px-4 py-2 text-right font-medium">Promedio/Día</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data as CurvaFaena[]).map((row) => (
                  <tr key={row.dia} className="hover:bg-stone-50">
                    <td className="px-4 py-2 font-medium">{row.dia}</td>
                    <td className="px-4 py-2 text-right">{row.totalAnimales}</td>
                    <td className="px-4 py-2 text-right">{row.totalKg.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{row.promedioDiario.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )

        default:
          return null
      }
    }

    return (
      <Card className="border-0 shadow-md mt-6">
        <CardHeader className="bg-stone-50 rounded-t-lg py-3">
          <CardTitle className="text-base font-semibold text-stone-800">Datos Detallados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            {renderTableContent()}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800">Reportes Avanzados</h1>
            <p className="text-stone-500 mt-1">Análisis detallado de producción y rendimiento</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel} disabled={loading || data.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={exportToPDF} disabled={loading || data.length === 0}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-md mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Tipo de Reporte */}
              <div className="space-y-2">
                <Label className="text-xs text-stone-500">Tipo de Reporte</Label>
                <Select value={tipoReporte} onValueChange={(v) => setTipoReporte(v as TipoReporte)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_REPORTE.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha Desde */}
              <div className="space-y-2">
                <Label className="text-xs text-stone-500">Desde</Label>
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>

              {/* Fecha Hasta */}
              <div className="space-y-2">
                <Label className="text-xs text-stone-500">Hasta</Label>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>

              {/* Especie */}
              <div className="space-y-2">
                <Label className="text-xs text-stone-500">Especie</Label>
                <Select value={especie} onValueChange={setEspecie}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    <SelectItem value="BOVINO">Bovino</SelectItem>
                    <SelectItem value="EQUINO">Equino</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Productor */}
              <div className="space-y-2">
                <Label className="text-xs text-stone-500">Productor</Label>
                <Select value={productorId} onValueChange={setProductorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {productores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        {renderKPICards()}

        {/* Charts */}
        {renderCharts()}

        {/* Table */}
        {renderTable()}
      </div>
    </div>
  )
}

export default ReportesAvanzadosModule
