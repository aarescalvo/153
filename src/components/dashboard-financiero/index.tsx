'use client'

import { useState, useEffect } from 'react'
import { 
  DollarSign, TrendingUp, TrendingDown, Users, Package, Scale, 
  Truck, FileText, Calendar, RefreshCw, Loader2, ArrowUpRight,
  BarChart3, PieChart, Activity, AlertCircle, Lock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

interface Operador {
  id: string
  nombre: string
  rol: string
  puedeDashboardFinanciero?: boolean
}

interface DashboardData {
  periodo: { desde: string; hasta: string }
  resumen: {
    totalFacturado: number
    totalPendiente: number
    totalCobrado: number
    clientesActivos: number
    ticketPromedio: number
  }
  faena: {
    totalAnimalesFaenados: number
    pesoTotalFaena: number
    pesoVivoTotal: number
    rindePromedio: number
    pesoPromedioAnimal: number
    totalCabezasRecibidas: number
  }
  pesaje: {
    totalPesajeCamiones: number
    cantidadPesajes: number
  }
  facturacion: {
    porCliente: Array<{ nombre: string; total: number; cantidad: number }>
    porDia: Array<{ fecha: string; total: number; cantidad: number }>
    porEstado: { pendientes: number; emitidas: number; pagadas: number; anuladas: number }
    totalFacturas: number
  }
  indicadores: {
    porcentajeCobrado: number
    porcentajePendiente: number
  }
}

interface Props {
  operador: Operador
}

export function DashboardFinancieroModule({ operador }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Verificar permiso
  const tieneAcceso = operador.puedeDashboardFinanciero === true

  useEffect(() => {
    // Fechas por defecto: mes actual
    const hoy = new Date()
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    setFechaDesde(primerDiaMes.toISOString().split('T')[0])
    setFechaHasta(hoy.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (fechaDesde && fechaHasta && tieneAcceso) {
      fetchData()
    }
  }, [fechaDesde, fechaHasta, tieneAcceso])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        fechaDesde,
        fechaHasta,
        operadorId: operador.id
      })
      const res = await fetch(`/api/dashboard-financiero?${params}`)
      const result = await res.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        toast.error(result.error || 'Error al cargar datos')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (num: number, decimals = 0) => {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const formatWeight = (kg: number) => {
    return `${formatNumber(kg, 0)} kg`
  }

  // Si no tiene acceso, mostrar mensaje
  if (!tieneAcceso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center p-4">
        <Card className="max-w-md border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <Lock className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold text-stone-800 mb-2">Acceso Restringido</h2>
            <p className="text-stone-500 mb-4">
              No tiene permisos para acceder al Dashboard Financiero.
              Esta sección contiene información sensible.
            </p>
            <p className="text-sm text-stone-400">
              Contacte al administrador si requiere acceso.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Pantalla de carga
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
              <DollarSign className="w-8 h-8 text-emerald-600" />
              Dashboard Financiero
            </h1>
            <p className="text-stone-500 mt-1">
              Métricas de facturación y rendimiento - Datos sensibles
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-36"
              />
              <span className="text-stone-400">a</span>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-36"
              />
            </div>
            <Button onClick={fetchData} variant="outline" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 uppercase font-medium">Total Facturado</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {data ? formatCurrency(data.resumen.totalFacturado) : '-'}
                  </p>
                </div>
                <div className="p-2 bg-emerald-200 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-700" />
                </div>
              </div>
              {data && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                  <TrendingUp className="w-3 h-3" />
                  {data.facturacion.totalFacturas} facturas
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 uppercase font-medium">Pendiente Cobro</p>
                  <p className="text-2xl font-bold text-amber-700">
                    {data ? formatCurrency(data.resumen.totalPendiente) : '-'}
                  </p>
                </div>
                <div className="p-2 bg-amber-200 rounded-lg">
                  <FileText className="w-5 h-5 text-amber-700" />
                </div>
              </div>
              {data && (
                <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  {formatCurrency(data.indicadores.porcentajePendiente)}% del total
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 uppercase font-medium">Total Cobrado</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {data ? formatCurrency(data.resumen.totalCobrado) : '-'}
                  </p>
                </div>
                <div className="p-2 bg-blue-200 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-700" />
                </div>
              </div>
              {data && (
                <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                  <ArrowUpRight className="w-3 h-3" />
                  {formatCurrency(data.indicadores.porcentajeCobrado)}% cobrado
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 uppercase font-medium">Ticket Promedio</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {data ? formatCurrency(data.resumen.ticketPromedio) : '-'}
                  </p>
                </div>
                <div className="p-2 bg-purple-200 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-purple-700" />
                </div>
              </div>
              {data && (
                <div className="mt-2 text-xs text-purple-600">
                  {data.resumen.clientesActivos} clientes activos
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Métricas de Faena */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-stone-50 rounded-t-lg">
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-600" />
              Métricas de Faena
            </CardTitle>
            <CardDescription>
              Indicadores de producción del período
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-stone-800">
                  {data ? formatNumber(data.faena.totalAnimalesFaenados) : '-'}
                </p>
                <p className="text-sm text-stone-500">Animales Faenados</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-stone-800">
                  {data ? formatWeight(data.faena.pesoTotalFaena) : '-'}
                </p>
                <p className="text-sm text-stone-500">Peso Total Faena</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-600">
                  {data ? formatNumber(data.faena.rindePromedio, 1) : '-'}%
                </p>
                <p className="text-sm text-stone-500">Rinde Promedio</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-stone-800">
                  {data ? formatWeight(data.faena.pesoPromedioAnimal) : '-'}
                </p>
                <p className="text-sm text-stone-500">Peso Prom. Animal</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-stone-800">
                  {data ? formatNumber(data.faena.totalCabezasRecibidas) : '-'}
                </p>
                <p className="text-sm text-stone-500">Cabezas Recibidas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gráficos y detalles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Clientes */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-stone-50 rounded-t-lg">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                Top 10 Clientes
              </CardTitle>
              <CardDescription>
                Mayor facturación del período
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {data && data.facturacion.porCliente.length > 0 ? (
                <div className="divide-y">
                  {data.facturacion.porCliente.map((cliente, i) => (
                    <div key={cliente.nombre} className="flex items-center justify-between p-3 hover:bg-stone-50">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-medium">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-medium text-stone-800 text-sm">{cliente.nombre}</p>
                          <p className="text-xs text-stone-400">{cliente.cantidad} facturas</p>
                        </div>
                      </div>
                      <p className="font-semibold text-emerald-600 text-sm">
                        {formatCurrency(cliente.total)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-stone-400">
                  No hay datos para mostrar
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estado de Facturas */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-stone-50 rounded-t-lg">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="w-5 h-5 text-amber-600" />
                Estado de Facturas
              </CardTitle>
              <CardDescription>
                Distribución por estado
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {data && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                      <span className="text-sm">Pendientes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {data.facturacion.porEstado.pendientes}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                      <span className="text-sm">Emitidas</span>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {data.facturacion.porEstado.emitidas}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                      <span className="text-sm">Pagadas</span>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {data.facturacion.porEstado.pagadas}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <span className="text-sm">Anuladas</span>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {data.facturacion.porEstado.anuladas}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Facturación Diaria */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-stone-50 rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600" />
              Facturación Diaria (últimos 30 días)
            </CardTitle>
            <CardDescription>
              Evolución de la facturación
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {data && data.facturacion.porDia.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.facturacion.porDia.slice(-15).map((dia) => (
                  <div key={dia.fecha} className="flex items-center gap-4">
                    <span className="text-xs text-stone-400 w-24 font-mono">
                      {new Date(dia.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </span>
                    <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(100, (dia.total / Math.max(...data.facturacion.porDia.map(d => d.total))) * 100)}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-stone-700 w-28 text-right">
                      {formatCurrency(dia.total)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-stone-400">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DashboardFinancieroModule
