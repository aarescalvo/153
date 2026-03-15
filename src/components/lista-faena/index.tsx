'use client'

import { useState, useEffect } from 'react'
import { 
  ClipboardList, Plus, Calendar, Trash2, 
  CheckCircle, Beef, AlertTriangle, Lock, RefreshCw, Unlock,
  AlertCircle, Printer, Minus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

const ESTADOS_LISTA = [
  { id: 'ABIERTA', label: 'Abierta', color: 'bg-green-100 text-green-700' },
  { id: 'CERRADA', label: 'Cerrada', color: 'bg-gray-100 text-gray-700' },
  { id: 'ANULADA', label: 'Anulada', color: 'bg-red-100 text-red-700' },
]

interface StockPorCorral {
  tropaId: string
  tropaCodigo: string
  tropaEspecie: string
  usuarioFaena: { id: string; nombre: string } | null
  corralId: string | null
  corralNombre: string | null
  totalAnimales: number
  enListaAbierta: number
  faenados: number
  disponibles: number
  cantidadEnLista: number
}

interface TropaEnLista {
  id: string
  codigo: string
  especie: string
  usuarioFaena?: { nombre: string }
  corral?: { id: string; nombre: string }
}

interface ListaFaena {
  id: string
  numero: number
  fecha: string
  estado: string
  cantidadTotal: number
  supervisor?: { nombre: string }
  fechaCierre?: string
  observaciones?: string
  tropas?: { tropa: TropaEnLista; cantidad: number; corralId: string | null; corral?: { id: string; nombre: string } }[]
}

interface Operador {
  id: string
  nombre: string
  nivel: string
}

export function ListaFaenaModule({ operador }: { operador: Operador }) {
  const [listas, setListas] = useState<ListaFaena[]>([])
  const [stockPorCorral, setStockPorCorral] = useState<StockPorCorral[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [activeTab, setActiveTab] = useState('actual')
  const [listaActual, setListaActual] = useState<ListaFaena | null>(null)
  
  // Dialogs
  const [nuevaListaOpen, setNuevaListaOpen] = useState(false)
  const [cerrarListaOpen, setCerrarListaOpen] = useState(false)
  const [reabrirListaOpen, setReabrirListaOpen] = useState(false)
  const [claveSupervisor, setClaveSupervisor] = useState('')
  const [quitarTropaOpen, setQuitarTropaOpen] = useState(false)
  const [tropaAQuitar, setTropaAQuitar] = useState<{id: string; codigo: string; garrones?: number; cantidadActual?: number} | null>(null)
  const [restarCantidadOpen, setRestarCantidadOpen] = useState(false)
  const [tropaARestar, setTropaARestar] = useState<{id: string; codigo: string; cantidadActual: number} | null>(null)
  const [cantidadARestar, setCantidadARestar] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [listasRes, stockRes] = await Promise.all([
        fetch('/api/lista-faena'),
        fetch('/api/tropas/stock-corrales?estado=PESADO,LISTO_FAENA')
      ])
      
      const listasData = await listasRes.json()
      const stockData = await stockRes.json()
      
      if (listasData.success) {
        // Ordenar por número descendente (más reciente primero)
        const sortedListas = listasData.data.sort((a: ListaFaena, b: ListaFaena) => b.numero - a.numero)
        setListas(sortedListas)
        
        // Mostrar la primera lista ABIERTA, o la más reciente si no hay abiertas
        const abierta = sortedListas.find((l: ListaFaena) => l.estado === 'ABIERTA')
        setListaActual(abierta || sortedListas[0] || null)
      }
      
      if (stockData.success) {
        setStockPorCorral(stockData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleCrearLista = async () => {
    // Crear nueva lista sin restricción de cantidad por día
    setSaving(true)
    try {
      const res = await fetch('/api/lista-faena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operadorId: operador.id })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Lista de faena N° ${String(data.data.numero).padStart(4, '0')} creada`)
        setNuevaListaOpen(false)
        fetchData()
      } else {
        toast.error(data.error || 'Error al crear lista')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleAgregarTropa = async (tropaId: string, corralId: string | null, cantidad: number, maxDisponible: number) => {
    if (!listaActual) return

    if (cantidad <= 0) {
      toast.error('Ingrese una cantidad válida')
      return
    }

    if (cantidad > maxDisponible) {
      toast.error(`La cantidad excede el stock disponible (${maxDisponible})`)
      return
    }

    try {
      const res = await fetch('/api/lista-faena/tropas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listaFaenaId: listaActual.id,
          tropaId,
          corralId,
          cantidad
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Agregado a la lista')
        fetchData()
      } else {
        toast.error(data.error || 'Error al agregar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const handleQuitarTropa = async (forzar: boolean = false) => {
    if (!listaActual || !tropaAQuitar) return

    try {
      const res = await fetch(`/api/lista-faena/tropas?listaFaenaId=${listaActual.id}&tropaId=${tropaAQuitar.id}&forzar=${forzar}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      
      if (data.success) {
        if (data.garronesLiberados > 0) {
          toast.success(`Tropa quitada. ${data.garronesLiberados} garrón(es) liberado(s) para reasignación`)
        } else {
          toast.success('Tropa removida de la lista')
        }
        setQuitarTropaOpen(false)
        setTropaAQuitar(null)
        fetchData()
      } else if (data.requiresConfirmation) {
        // Mostrar diálogo de confirmación
        setTropaAQuitar({
          ...tropaAQuitar,
          garrones: data.garronesAsignados
        })
        return // No cerrar el diálogo, esperar confirmación
      } else {
        toast.error(data.error || 'Error al quitar tropa')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const handleRestarCantidad = async () => {
    if (!listaActual || !tropaARestar) return
    
    if (cantidadARestar <= 0 || cantidadARestar >= tropaARestar.cantidadActual) {
      toast.error('La cantidad a restar debe ser mayor a 0 y menor al total asignado')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/lista-faena/tropas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listaFaenaId: listaActual.id,
          tropaId: tropaARestar.id,
          cantidad: tropaARestar.cantidadActual - cantidadARestar
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Se restaron ${cantidadARestar} animales de la tropa`)
        setRestarCantidadOpen(false)
        setTropaARestar(null)
        setCantidadARestar(0)
        fetchData()
      } else {
        toast.error(data.error || 'Error al restar cantidad')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleImprimirLista = () => {
    if (!listaActual) return
    
    const numeroFormateado = String(listaActual.numero).padStart(4, '0')
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Faena N° ${numeroFormateado}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { text-align: center; margin-bottom: 5px; }
          .numero-lista { text-align: center; font-size: 14px; color: #666; margin-bottom: 10px; }
          h2 { text-align: center; color: #666; margin-top: 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; }
          th { background: #f0f0f0; }
          .text-center { text-align: center; }
          .total { font-weight: bold; font-size: 16px; margin-top: 15px; text-align: right; }
          .firmas { margin-top: 60px; display: flex; justify-content: space-between; padding: 0 40px; }
          .firma { text-align: center; width: 200px; }
          .firma-linea { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; font-size: 12px; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>LISTA DE FAENA</h1>
        <div class="numero-lista">N° ${numeroFormateado}</div>
        <h2>Fecha: ${new Date(listaActual.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tropa</th>
              <th>Usuario Faena</th>
              <th class="text-center">Cantidad</th>
              <th>Corral</th>
            </tr>
          </thead>
          <tbody>
            ${listaActual.tropas?.map((t, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td><strong>${t.tropa.codigo}</strong></td>
                <td>${t.tropa.usuarioFaena?.nombre || '-'}</td>
                <td class="text-center">${t.cantidad}</td>
                <td>${t.corral?.nombre || '-'}</td>
              </tr>
            `).join('') || ''}
          </tbody>
        </table>
        <div class="total">Total: ${listaActual.cantidadTotal} animales</div>
        
        <div class="firmas">
          <div class="firma">
            <div class="firma-linea">Firma Solicitante</div>
          </div>
          <div class="firma">
            <div class="firma-linea">Autorización SENASA</div>
          </div>
        </div>
        
        <div class="footer">
          Lista N° ${numeroFormateado} - Generado el ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')}
        </div>
      </body>
      </html>
    `
    
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handleReabrirLista = async () => {
    if (!listaActual) return

    setSaving(true)
    try {
      const res = await fetch('/api/lista-faena', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listaFaenaId: listaActual.id,
          accion: 'reabrir'
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Lista reabierta correctamente')
        setReabrirListaOpen(false)
        fetchData()
      } else {
        toast.error(data.error || 'Error al reabrir lista')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleCerrarLista = async () => {
    if (!claveSupervisor) {
      toast.error('Ingrese la clave de supervisor')
      return
    }

    try {
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: claveSupervisor })
      })
      
      const authData = await authRes.json()
      
      if (!authData.success || (authData.data.rol !== 'SUPERVISOR' && authData.data.rol !== 'ADMINISTRADOR')) {
        toast.error('Clave de supervisor inválida')
        return
      }
    } catch {
      toast.error('Error al verificar clave')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/lista-faena/cerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listaFaenaId: listaActual?.id,
          supervisorId: operador.id
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Lista de faena cerrada')
        setCerrarListaOpen(false)
        setClaveSupervisor('')
        fetchData()
      } else {
        toast.error(data.error || 'Error al cerrar lista')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const est = ESTADOS_LISTA.find(e => e.id === estado)
    return (
      <Badge className={est?.color || 'bg-gray-100'}>
        {est?.label || estado}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <ClipboardList className="w-8 h-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800">Lista de Faena</h1>
            <p className="text-stone-500">Planificación diaria - Asigne tropas y cantidades a faenar</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            {operador.nivel !== 'OPERADOR' && (
              <Button onClick={() => setNuevaListaOpen(true)} className="bg-amber-500 hover:bg-amber-600">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Lista
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="actual">Lista Actual</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          {/* LISTA ACTUAL */}
          <TabsContent value="actual" className="space-y-6">
            {!listaActual ? (
              <Card className="border-0 shadow-md">
                <CardContent className="p-12 text-center">
                  <ClipboardList className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                  <p className="text-lg text-stone-600 mb-2">No hay lista de faena</p>
                  <p className="text-stone-400 mb-4">Cree una nueva lista para comenzar</p>
                  {operador.nivel !== 'OPERADOR' && (
                    <Button onClick={() => setNuevaListaOpen(true)} className="bg-amber-500 hover:bg-amber-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Lista de Faena
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Info de la lista */}
                <Card className="border-0 shadow-md">
                  <CardHeader className="bg-stone-50 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-amber-600" />
                          Lista N° {String(listaActual.numero).padStart(4, '0')} - {new Date(listaActual.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </CardTitle>
                        <CardDescription>
                          Total planificado: {listaActual.cantidadTotal} animales
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getEstadoBadge(listaActual.estado)}
                        {listaActual.estado === 'ABIERTA' && operador.nivel !== 'OPERADOR' && (
                          <Button onClick={() => setCerrarListaOpen(true)} className="bg-green-600 hover:bg-green-700">
                            <Lock className="w-4 h-4 mr-2" />
                            Cerrar
                          </Button>
                        )}
                        {listaActual.estado === 'CERRADA' && (
                          <>
                            <Button onClick={handleImprimirLista} variant="outline" className="border-blue-300 text-blue-600">
                              <Printer className="w-4 h-4 mr-2" />
                              Imprimir
                            </Button>
                            {operador.nivel !== 'OPERADOR' && (
                              <Button onClick={() => setReabrirListaOpen(true)} variant="outline" className="border-amber-300 text-amber-600">
                                <Unlock className="w-4 h-4 mr-2" />
                                Reabrir
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {/* Tropas en la lista */}
                    <div className="mb-6">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Beef className="w-4 h-4 text-amber-600" />
                        Tropas Asignadas a Faena
                      </h4>
                      {listaActual.tropas && listaActual.tropas.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 text-center">#</TableHead>
                              <TableHead>Tropa</TableHead>
                              <TableHead>Usuario Faena</TableHead>
                              <TableHead className="text-center">Cantidad</TableHead>
                              <TableHead>Corral</TableHead>
                              {listaActual.estado === 'ABIERTA' && <TableHead className="text-center">Acciones</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {listaActual.tropas.map((t, i) => (
                              <TableRow key={`${t.tropa.id}-${t.corralId || 'sin-corral'}`}>
                                <TableCell className="text-center font-bold text-stone-500">
                                  {i + 1}
                                </TableCell>
                                <TableCell className="font-mono font-bold">{t.tropa.codigo}</TableCell>
                                <TableCell>{t.tropa.usuarioFaena?.nombre || '-'}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="text-lg font-bold">
                                    {t.cantidad}
                                  </Badge>
                                </TableCell>
                                <TableCell>{t.corral?.nombre || '-'}</TableCell>
                                {listaActual.estado === 'ABIERTA' && (
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => {
                                          setTropaARestar({ 
                                            id: t.tropa.id, 
                                            codigo: t.tropa.codigo, 
                                            cantidadActual: t.cantidad 
                                          })
                                          setRestarCantidadOpen(true)
                                        }}
                                        className="text-amber-600 hover:bg-amber-50"
                                        title="Restar cantidad"
                                      >
                                        <Minus className="w-4 h-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => {
                                          setTropaAQuitar({ id: t.tropa.id, codigo: t.tropa.codigo })
                                          handleQuitarTropa(false)
                                        }}
                                        className="text-red-600 hover:bg-red-50"
                                        title="Quitar tropa completa"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-stone-400">No hay tropas asignadas</p>
                      )}
                    </div>

                    {/* Agregar tropas - solo si está ABIERTA */}
                    {listaActual.estado === 'ABIERTA' && stockPorCorral.filter(s => s.disponibles > 0).length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3">Agregar Stock por Corral</h4>
                        <ScrollArea className="h-[280px]">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-4">
                            {stockPorCorral
                              .filter(s => s.disponibles > 0)
                              .map((stock) => {
                                const enLista = listaActual.tropas?.find(lt => 
                                  lt.tropa.id === stock.tropaId && lt.corralId === stock.corralId
                                )
                                const inputId = `cant-${stock.tropaId}-${stock.corralId || 'sin-corral'}`
                                return (
                                  <div key={inputId} className="p-3 border rounded-lg bg-white">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-mono font-bold">{stock.tropaCodigo}</span>
                                      <Badge variant="outline">{stock.tropaEspecie}</Badge>
                                    </div>
                                    <p className="text-sm text-stone-500 mb-1">
                                      {stock.usuarioFaena?.nombre || '-'}
                                    </p>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className="text-xs">
                                        Corral: {stock.corralNombre || 'Sin asignar'}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs mb-2">
                                      <span className="text-green-600 font-medium">
                                        ✓ {stock.disponibles} disponibles
                                      </span>
                                    </div>
                                    {enLista && (
                                      <Badge className="bg-blue-100 text-blue-700 mb-2">
                                        Ya en lista: {enLista.cantidad}
                                      </Badge>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                      <Input
                                        type="number"
                                        className="w-20"
                                        min="1"
                                        max={stock.disponibles}
                                        defaultValue={stock.disponibles}
                                        id={inputId}
                                      />
                                      <Button 
                                        size="sm"
                                        onClick={() => {
                                          const input = document.getElementById(inputId) as HTMLInputElement
                                          const cant = parseInt(input?.value) || 0
                                          handleAgregarTropa(stock.tropaId, stock.corralId, cant, stock.disponibles)
                                        }}
                                        className="bg-green-600 hover:bg-green-700"
                                      >
                                        <Plus className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>


              </>
            )}
          </TabsContent>

          {/* HISTORIAL */}
          <TabsContent value="historial">
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg">
                <CardTitle className="text-lg">Listas de Faena Anteriores</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {listas.length === 0 ? (
                  <div className="p-8 text-center text-stone-400">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay listas</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listas.map((lista) => (
                        <TableRow key={lista.id} className={lista.id === listaActual?.id ? 'bg-amber-50' : ''}>
                          <TableCell>
                            {new Date(lista.fecha).toLocaleDateString('es-AR')}
                          </TableCell>
                          <TableCell>{lista.cantidadTotal} animales</TableCell>
                          <TableCell>{getEstadoBadge(lista.estado)}</TableCell>
                          <TableCell>
                            {lista.estado === 'CERRADA' && operador.nivel !== 'OPERADOR' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setListaActual(lista)
                                  setReabrirListaOpen(true)
                                }}
                                className="text-amber-600"
                              >
                                <Unlock className="w-4 h-4 mr-1" />
                                Reabrir
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog Nueva Lista */}
        <Dialog open={nuevaListaOpen} onOpenChange={setNuevaListaOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Lista de Faena</DialogTitle>
              <DialogDescription>
                Se creará una nueva lista para el día de hoy
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-stone-600">
                Esta acción creará una lista de faena con fecha {new Date().toLocaleDateString('es-AR')}.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNuevaListaOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCrearLista} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
                {saving ? 'Creando...' : 'Crear Lista'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Reabrir Lista */}
        <Dialog open={reabrirListaOpen} onOpenChange={setReabrirListaOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <Unlock className="w-5 h-5" />
                Reabrir Lista de Faena
              </DialogTitle>
              <DialogDescription>
                La lista pasará a estado ABIERTA y podrá ser modificada
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 mb-2" />
                <p className="text-sm text-amber-700 mb-2">
                  Al reabrir la lista:
                </p>
                <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                  <li>Los garrones ya asignados se mantienen</li>
                  <li>Los datos de romaneo se conservan</li>
                  <li>Puede agregar más tropas o animales</li>
                  <li>Puede quitar tropas (con advertencia si hay garrones)</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReabrirListaOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleReabrirLista} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
                {saving ? 'Reabriendo...' : 'Reabrir Lista'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Quitar Tropa con Garrones */}
        <Dialog open={quitarTropaOpen} onOpenChange={setQuitarTropaOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Confirmar Eliminación de Tropa
              </DialogTitle>
              <DialogDescription>
                Esta tropa tiene garrones ya asignados
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />
                <p className="text-sm text-red-700 mb-2">
                  <strong>Advertencia:</strong> La tropa {tropaAQuitar?.codigo} tiene{' '}
                  <strong>{tropaAQuitar?.garrones || 0} garrón(es)</strong> ya asignado(s).
                </p>
                <p className="text-sm text-red-700">
                  Si continúa, los garrones quedarán liberados para reasignación. 
                  Deberá asignarlos nuevamente a los animales correctos desde Ingreso a Cajón.
                </p>
              </div>
              <div className="p-3 bg-stone-100 rounded-lg">
                <p className="text-sm text-stone-600">
                  <strong>Procedimiento correcto:</strong>
                </p>
                <ol className="text-sm text-stone-600 list-decimal list-inside mt-1">
                  <li>Quitar esta tropa (los garrones quedan huérfanos)</li>
                  <li>Agregar la tropa correcta</li>
                  <li>En Ingreso a Cajón, reasignar los garrones a los animales correctos</li>
                  <li>Los pesos de romaneo ya cargados se mantienen</li>
                </ol>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setQuitarTropaOpen(false)
                setTropaAQuitar(null)
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={() => handleQuitarTropa(true)} 
                disabled={saving}
                variant="destructive"
              >
                {saving ? 'Quitando...' : 'Quitar tropa y liberar garrones'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Cerrar Lista */}
        <Dialog open={cerrarListaOpen} onOpenChange={setCerrarListaOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <Lock className="w-5 h-5" />
                Cerrar Lista de Faena
              </DialogTitle>
              <DialogDescription>
                Se requiere autorización de supervisor para cerrar la lista
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mb-2" />
                <p className="text-sm text-green-700">
                  Una vez cerrada, la lista estará lista para Ingreso a Cajón y Romaneo.
                  Podrá reabrirla si necesita hacer correcciones.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Clave de Supervisor</Label>
                <Input
                  type="password"
                  value={claveSupervisor}
                  onChange={(e) => setClaveSupervisor(e.target.value)}
                  placeholder="••••••"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCerrarListaOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCerrarLista} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? 'Cerrando...' : 'Cerrar Lista'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Restar Cantidad */}
        <Dialog open={restarCantidadOpen} onOpenChange={setRestarCantidadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <Minus className="w-5 h-5" />
                Restar Animales de Tropa
              </DialogTitle>
              <DialogDescription>
                Reduzca la cantidad de animales de esta tropa en la lista
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-stone-50 border rounded-lg">
                <p className="text-sm text-stone-600 mb-2">
                  <strong>Tropa:</strong> {tropaARestar?.codigo}
                </p>
                <p className="text-sm text-stone-600">
                  <strong>Cantidad actual:</strong> {tropaARestar?.cantidadActual} animales
                </p>
              </div>
              <div className="space-y-2">
                <Label>Cantidad a restar</Label>
                <Input
                  type="number"
                  min="1"
                  max={tropaARestar ? tropaARestar.cantidadActual - 1 : 1}
                  value={cantidadARestar}
                  onChange={(e) => setCantidadARestar(parseInt(e.target.value) || 0)}
                  placeholder="Ingrese cantidad"
                />
                <p className="text-xs text-stone-400">
                  La cantidad restante será de {tropaARestar ? tropaARestar.cantidadActual - cantidadARestar : 0} animales
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 inline mr-2" />
                <span className="text-sm text-amber-700">
                  Los animales restados volverán a estar disponibles para agregar a esta u otra lista.
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setRestarCantidadOpen(false)
                setTropaARestar(null)
                setCantidadARestar(0)
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={handleRestarCantidad} 
                disabled={saving || cantidadARestar <= 0 || (tropaARestar ? cantidadARestar >= tropaARestar.cantidadActual : true)}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {saving ? 'Guardando...' : 'Restar Cantidad'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default ListaFaenaModule
