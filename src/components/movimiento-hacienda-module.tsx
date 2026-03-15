'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Beef, Warehouse, Skull, Move, RefreshCw,
  X, ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface TropaEnCorral {
  tropaId: string
  tropaCodigo: string
  cantidad: number
  especie: string
  usuarioFaena: string
}

interface Corral {
  id: string
  nombre: string
  capacidad: number
  stockTotal: number
  disponible: number
  tropas: TropaEnCorral[]
}

interface TropaDetalle {
  tropaId: string
  tropaCodigo: string
  especie: string
  usuarioFaena: string
  cantidadAnimales: number
  animales: { id: string; numero: number; codigo: string; tipoAnimal: string; pesoVivo?: number | null }[]
}

interface Operador {
  id: string
  nombre: string
  rol: string
}

export function MovimientoHaciendaModule({ operador }: { operador: Operador }) {
  const [corrales, setCorrales] = useState<Corral[]>([])
  const [loading, setLoading] = useState(true)
  
  // Corral seleccionado
  const [corralSeleccionado, setCorralSeleccionado] = useState<Corral | null>(null)
  const [tropasEnCorral, setTropasEnCorral] = useState<TropaDetalle[]>([])
  const [loadingTropas, setLoadingTropas] = useState(false)
  
  // Tropa seleccionada para movimiento o baja
  const [tropaSeleccionada, setTropaSeleccionada] = useState<TropaDetalle | null>(null)
  
  // Dialogs
  const [moverOpen, setMoverOpen] = useState(false)
  const [bajaOpen, setBajaOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Movimiento
  const [cantidadMover, setCantidadMover] = useState('')
  const [corralDestinoId, setCorralDestinoId] = useState('')
  
  // Baja
  const [numeroAnimalBaja, setNumeroAnimalBaja] = useState('')
  const [causaMuerte, setCausaMuerte] = useState('')
  const [claveSupervisor, setClaveSupervisor] = useState('')

  // Fetch corrales
  const fetchCorrales = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/corrales')
      const data = await res.json()
      if (data.success) {
        setCorrales(data.data)
      }
    } catch (error) {
      console.error('Error fetching corrales:', error)
      toast.error('Error al cargar corrales')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCorrales()
  }, [fetchCorrales])

  // Fetch tropas del corral seleccionado (con detalle de animales)
  const fetchTropasCorral = async (corralId: string) => {
    setLoadingTropas(true)
    setTropaSeleccionada(null)
    try {
      const res = await fetch(`/api/corrales/animales?corralId=${corralId}`)
      const data = await res.json()
      if (data.success) {
        setTropasEnCorral(data.data.animales)
      } else {
        setTropasEnCorral([])
      }
    } catch (error) {
      console.error('Error fetching tropas:', error)
      toast.error('Error al cargar tropas')
      setTropasEnCorral([])
    } finally {
      setLoadingTropas(false)
    }
  }

  const handleSeleccionarCorral = (corral: Corral) => {
    if (corralSeleccionado?.id === corral.id) {
      setCorralSeleccionado(null)
      setTropasEnCorral([])
      setTropaSeleccionada(null)
    } else {
      setCorralSeleccionado(corral)
      fetchTropasCorral(corral.id)
    }
  }

  // Abrir dialog de movimiento
  const handleAbrirMover = (tropa: TropaDetalle) => {
    setTropaSeleccionada(tropa)
    setCantidadMover('')
    setCorralDestinoId('')
    setMoverOpen(true)
  }

  // Ejecutar movimiento
  const handleMoverAnimales = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    const cantidad = parseInt(cantidadMover)
    
    if (!cantidad || cantidad <= 0) {
      toast.error('Ingrese una cantidad válida')
      return
    }

    if (!tropaSeleccionada || cantidad > tropaSeleccionada.cantidadAnimales) {
      toast.error(`La cantidad no puede ser mayor a ${tropaSeleccionada?.cantidadAnimales} animales`)
      return
    }

    if (!corralDestinoId) {
      toast.error('Seleccione el corral destino')
      return
    }

    if (!corralSeleccionado?.id) {
      toast.error('No hay corral de origen seleccionado')
      return
    }

    const corralDestino = corrales.find(c => c.id === corralDestinoId)
    if (corralDestino && cantidad > corralDestino.disponible) {
      toast.error(`El corral ${corralDestino.nombre} solo tiene ${corralDestino.disponible} lugares disponibles`)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/animales/mover-cantidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tropaId: tropaSeleccionada.tropaId,
          corralOrigenId: corralSeleccionado.id,
          corralDestinoId,
          cantidad,
          operadorId: operador.id
        })
      })

      const data = await res.json()
      
      if (data.success) {
        toast.success(`✅ ${cantidad} animal(es) movido(s) a ${corralDestino?.nombre}`)
        setMoverOpen(false)
        setCantidadMover('')
        setCorralDestinoId('')
        // Recargar datos
        await fetchCorrales()
        if (corralSeleccionado) {
          await fetchTropasCorral(corralSeleccionado.id)
        }
      } else {
        toast.error(data.error || 'Error al mover animales')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // Abrir dialog de baja
  const handleAbrirBaja = (tropa: TropaDetalle) => {
    setTropaSeleccionada(tropa)
    setNumeroAnimalBaja('')
    setCausaMuerte('')
    setClaveSupervisor('')
    setBajaOpen(true)
  }

  // Validar supervisor y ejecutar baja
  const handleRegistrarMuerte = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!numeroAnimalBaja) {
      toast.error('Ingrese el número de animal')
      return
    }

    const numero = parseInt(numeroAnimalBaja)
    const animalExiste = tropaSeleccionada?.animales.find(a => a.numero === numero)
    
    if (!animalExiste) {
      toast.error(`El animal número ${numero} no se encuentra en este corral`)
      return
    }

    if (!causaMuerte.trim()) {
      toast.error('Ingrese la causa de muerte')
      return
    }

    if (!claveSupervisor) {
      toast.error('Ingrese la clave PIN de supervisor')
      return
    }

    setSaving(true)
    try {
      // Validar supervisor
      const resSupervisor = await fetch('/api/auth/supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: claveSupervisor })
      })

      const dataSupervisor = await resSupervisor.json()
      
      if (!dataSupervisor.success) {
        toast.error(dataSupervisor.error || 'Clave de supervisor inválida')
        setSaving(false)
        return
      }

      // Ejecutar baja
      const resBaja = await fetch('/api/animales/baja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animalId: animalExiste.id,
          motivoBaja: causaMuerte.trim(),
          supervisorId: dataSupervisor.data.id
        })
      })

      const dataBaja = await resBaja.json()
      
      if (dataBaja.success) {
        toast.success(`Baja registrada - Animal #${numero}`)
        setBajaOpen(false)
        setNumeroAnimalBaja('')
        setCausaMuerte('')
        setClaveSupervisor('')
        // Recargar datos
        await fetchCorrales()
        if (corralSeleccionado) {
          await fetchTropasCorral(corralSeleccionado.id)
        }
      } else {
        toast.error(dataBaja.error || 'Error al registrar baja')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // Totales
  const totalEnCorrales = corrales.reduce((acc, c) => acc + c.stockTotal, 0)
  const corralesOcupados = corrales.filter(c => c.stockTotal > 0).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-stone-800">Movimiento de Hacienda</h2>
            <p className="text-stone-500">Control de stock y movimientos entre corrales</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => { fetchCorrales(); setCorralSeleccionado(null); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            <Badge variant="outline" className="text-lg px-4 py-2">
              <Beef className="h-4 w-4 mr-2 text-amber-500" />
              {totalEnCorrales} animales en {corralesOcupados} corrales
            </Badge>
          </div>
        </div>

        {/* Layout principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grid de corrales */}
          <div className={corralSeleccionado ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-amber-500" />
                  Stock de Corrales
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {loading ? (
                  <div className="py-12 text-center text-stone-400">Cargando...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {corrales.map((corral) => {
                      const isSelected = corralSeleccionado?.id === corral.id
                      const isEmpty = corral.stockTotal === 0
                      const ocupacion = corral.capacidad > 0 
                        ? Math.round((corral.stockTotal / corral.capacidad) * 100) 
                        : 0

                      return (
                        <div
                          key={corral.id}
                          onClick={() => handleSeleccionarCorral(corral)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50 shadow-md'
                              : isEmpty
                                ? 'border-gray-100 bg-gray-50 opacity-50 hover:opacity-75'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-stone-800">{corral.nombre}</span>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={isEmpty ? 'secondary' : 'default'} 
                                className={isEmpty ? '' : 'bg-green-600'}
                              >
                                {corral.stockTotal} anim.
                              </Badge>
                              <Badge variant="outline">
                                {ocupacion}%
                              </Badge>
                            </div>
                          </div>
                          
                          {isEmpty ? (
                            <div className="text-center py-2 text-stone-400 text-sm">
                              <p>Sin animales</p>
                              <p className="text-xs">Capacidad: {corral.capacidad}</p>
                            </div>
                          ) : (
                            <>
                              {/* Lista de tropas en el corral */}
                              <div className="space-y-2 mb-3">
                                {corral.tropas.map((tropa) => (
                                  <div 
                                    key={`${corral.id}-${tropa.tropaId}`}
                                    className="flex items-center justify-between bg-white rounded px-2 py-1.5 text-sm"
                                  >
                                    <div>
                                      <span className="font-mono font-medium text-stone-700">
                                        {tropa.tropaCodigo}
                                      </span>
                                      <span className="text-stone-400 text-xs ml-2">
                                        {tropa.usuarioFaena}
                                      </span>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {tropa.cantidad}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Barra de ocupación */}
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    ocupacion >= 90 ? 'bg-red-500' : 
                                    ocupacion >= 70 ? 'bg-amber-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(ocupacion, 100)}%` }}
                                />
                              </div>
                              
                              <p className="text-xs text-stone-400 text-center">
                                {corral.disponible} disponibles de {corral.capacidad}
                              </p>
                            </>
                          )}
                          
                          {isSelected && (
                            <div className="mt-3 pt-2 border-t border-amber-200 flex items-center justify-center text-amber-600 text-sm">
                              <ArrowRight className="w-4 h-4 mr-1" />
                              Ver detalles
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panel de tropas del corral seleccionado */}
          {corralSeleccionado && (
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-md sticky top-4">
                <CardHeader className="bg-amber-50 rounded-t-lg pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Beef className="w-5 h-5 text-amber-600" />
                      {corralSeleccionado.nombre}
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => { setCorralSeleccionado(null); setTropasEnCorral([]); }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-stone-500">
                    {tropasEnCorral.reduce((acc, t) => acc + t.cantidadAnimales, 0)} animales en {tropasEnCorral.length} tropa(s)
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingTropas ? (
                    <div className="py-8 text-center text-stone-400">Cargando tropas...</div>
                  ) : tropasEnCorral.length === 0 ? (
                    <div className="py-8 text-center text-stone-400">
                      <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Sin animales en este corral</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {tropasEnCorral.map((tropa) => (
                        <div key={tropa.tropaId} className="p-4 hover:bg-stone-50">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-mono font-bold text-stone-800">{tropa.tropaCodigo}</span>
                              <p className="text-xs text-stone-400">{tropa.usuarioFaena}</p>
                            </div>
                            <Badge variant="outline" className="text-lg">
                              {tropa.cantidadAnimales} anim.
                            </Badge>
                          </div>
                          
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleAbrirMover(tropa)}
                            >
                              <Move className="w-4 h-4 mr-1" />
                              Mover
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleAbrirBaja(tropa)}
                            >
                              <Skull className="w-4 h-4 mr-1" />
                              Muerte
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Dialog Mover Animales */}
      <Dialog open={moverOpen} onOpenChange={setMoverOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="w-5 h-5" />
              Mover Animales
            </DialogTitle>
            <DialogDescription>
              Tropa: <strong>{tropaSeleccionada?.tropaCodigo}</strong> - {tropaSeleccionada?.cantidadAnimales} animales disponibles
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMoverAnimales}>
            <div className="space-y-4 py-4">
              <div className="bg-stone-50 p-3 rounded-lg grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-stone-500">Origen:</span>
                  <p className="font-medium">{corralSeleccionado?.nombre}</p>
                </div>
                <div>
                  <span className="text-stone-500">Disponibles:</span>
                  <p className="font-bold text-lg">{tropaSeleccionada?.cantidadAnimales}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Cantidad a mover *</Label>
                <Input
                  type="number"
                  min="1"
                  max={tropaSeleccionada?.cantidadAnimales}
                  value={cantidadMover}
                  onChange={(e) => setCantidadMover(e.target.value)}
                  placeholder="Ingrese cantidad..."
                />
              </div>

              <div className="space-y-2">
                <Label>Corral Destino *</Label>
                <Select value={corralDestinoId} onValueChange={setCorralDestinoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar corral destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {corrales
                      .filter(c => c.id !== corralSeleccionado?.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre} ({c.disponible} disponibles)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {cantidadMover && corralDestinoId && (
                <div className="bg-amber-50 p-3 rounded-lg flex items-center gap-3">
                  <ArrowRight className="w-5 h-5 text-amber-600" />
                  <div className="text-sm">
                    <span className="font-medium">{cantidadMover}</span> animales de 
                    <span className="font-medium"> {corralSeleccionado?.nombre}</span> a 
                    <span className="font-medium"> {corrales.find(c => c.id === corralDestinoId)?.nombre}</span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMoverOpen(false)}>Cancelar</Button>
              <Button 
                type="submit"
                disabled={saving || !cantidadMover || !corralDestinoId} 
                className="bg-amber-600 hover:bg-amber-700"
              >
                {saving ? 'Moviendo...' : 'Mover Animales'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Baja Animal */}
      <Dialog open={bajaOpen} onOpenChange={setBajaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Skull className="w-5 h-5" />
              Declarar Muerte de Animal
            </DialogTitle>
            <DialogDescription>
              Tropa: <strong>{tropaSeleccionada?.tropaCodigo}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegistrarMuerte}>
            <div className="space-y-4 py-4">
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <p className="text-sm text-red-600">
                  Esta acción requiere autorización de supervisor
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Número de Animal *</Label>
                <Input
                  type="number"
                  min="1"
                  value={numeroAnimalBaja}
                  onChange={(e) => setNumeroAnimalBaja(e.target.value)}
                  placeholder="Ingrese número de animal"
                />
                {numeroAnimalBaja && tropaSeleccionada && (
                  <p className="text-xs text-stone-500">
                    {(() => {
                      const animal = tropaSeleccionada.animales.find(a => a.numero === parseInt(numeroAnimalBaja))
                      if (animal) {
                        return `${animal.codigo} - Tipo: ${animal.tipoAnimal}${animal.pesoVivo ? ` - ${animal.pesoVivo} kg` : ''}`
                      }
                      return <span className="text-red-500">Animal #{numeroAnimalBaja} no se encuentra en este corral</span>
                    })()}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Causa de Muerte *</Label>
                <Textarea
                  value={causaMuerte}
                  onChange={(e) => setCausaMuerte(e.target.value)}
                  placeholder="Describa la causa de muerte..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Clave de Supervisor *</Label>
                <Input
                  type="password"
                  value={claveSupervisor}
                  onChange={(e) => setClaveSupervisor(e.target.value)}
                  placeholder="PIN de supervisor"
                  maxLength={6}
                  className="text-center text-xl tracking-widest"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBajaOpen(false)}>Cancelar</Button>
              <Button 
                type="submit"
                disabled={saving || !numeroAnimalBaja || !causaMuerte.trim() || !claveSupervisor}
                className="bg-red-600 hover:bg-red-700"
              >
                {saving ? 'Registrando...' : 'Registrar Muerte'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MovimientoHaciendaModule
