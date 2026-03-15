'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Scale, RefreshCw, Plus, CheckCircle, AlertCircle,
  Beef, Edit, Trash2, ArrowRight, Minus, AlertTriangle, ClipboardCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

const TIPOS_ANIMALES: Record<string, { codigo: string; label: string }[]> = {
  BOVINO: [
    { codigo: 'TO', label: 'Toro' },
    { codigo: 'VA', label: 'Vaca' },
    { codigo: 'VQ', label: 'Vaquillona' },
    { codigo: 'MEJ', label: 'Torito/Mej' },
    { codigo: 'NO', label: 'Novillo' },
    { codigo: 'NT', label: 'Novillito' },
  ],
  EQUINO: [
    { codigo: 'PADRILLO', label: 'Padrillo' },
    { codigo: 'POTRILLO', label: 'Potrillo/Potranca' },
    { codigo: 'YEGUA', label: 'Yegua' },
    { codigo: 'CABALLO', label: 'Caballo' },
    { codigo: 'BURRO', label: 'Burro' },
    { codigo: 'MULA', label: 'Mula' },
  ]
}

const RAZAS_BOVINO = [
  'Angus', 'Hereford', 'Braford', 'Brangus', 'Charolais', 'Limousin',
  'Santa Gertrudis', 'Nelore', 'Brahman', 'Cebú', 'Cruza', 'Otro'
]

const RAZAS_EQUINO = [
  'Criollo', 'Pura Sangre', 'Cuarto de Milla', 'Percherón', 'Belga',
  'Árabe', 'Silla Argentino', 'Petiso', 'Otro'
]

interface Operador {
  id: string
  nombre: string
}

interface Corral {
  id: string
  nombre: string
  capacidad: number
  stockBovinos: number
  stockEquinos: number
}

interface Tropa {
  id: string
  numero: number
  codigo: string
  especie: string
  cantidadCabezas: number
  estado: string
  corral?: { id: string; nombre: string } | string
  corralId?: string
  pesoNeto?: number
  pesoTotalIndividual?: number
  usuarioFaena?: { nombre: string }
  tiposAnimales?: { tipoAnimal: string; cantidad: number }[]
  observaciones?: string
}

interface Animal {
  id: string
  numero: number
  codigo: string
  tipoAnimal: string
  caravana?: string
  raza?: string
  pesoVivo?: number
  observaciones?: string
  estado: string
}

interface TipoCantidadConfirmada {
  tipoAnimal: string
  cantidadDTE: number
  cantidadConfirmada: number
}

export function PesajeIndividualModule({ tropas: propTropas, operador }: { tropas?: Tropa[]; operador: Operador }) {
  const [tropas, setTropas] = useState<Tropa[]>(propTropas || [])
  const [tropasPorPesar, setTropasPorPesar] = useState<Tropa[]>([])
  const [tropasPesado, setTropasPesado] = useState<Tropa[]>([])
  const [corrales, setCorrales] = useState<Corral[]>([])
  const [loading, setLoading] = useState(!propTropas)
  const [saving, setSaving] = useState(false)
  
  const [activeTab, setActiveTab] = useState('solicitar')
  const [tropaSeleccionada, setTropaSeleccionada] = useState<Tropa | null>(null)
  const [animales, setAnimales] = useState<Animal[]>([])
  const [animalActual, setAnimalActual] = useState(0)
  const [corralDestinoId, setCorralDestinoId] = useState('')
  
  const [caravana, setCaravana] = useState('')
  const [tipoAnimalSeleccionado, setTipoAnimalSeleccionado] = useState('')
  const [raza, setRaza] = useState('')
  const [pesoActual, setPesoActual] = useState('')
  
  const [validacionDialogOpen, setValidacionDialogOpen] = useState(false)
  const [tiposConfirmados, setTiposConfirmados] = useState<TipoCantidadConfirmada[]>([])
  const [nuevoTipoSeleccionado, setNuevoTipoSeleccionado] = useState('')
  
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null)
  const [editCaravana, setEditCaravana] = useState('')
  const [editTipoAnimal, setEditTipoAnimal] = useState('')
  const [editRaza, setEditRaza] = useState('')
  const [editPeso, setEditPeso] = useState('')

  useEffect(() => {
    if (!propTropas) {
      fetchData()
    }
  }, [propTropas])

  useEffect(() => {
    setTropasPorPesar(tropas.filter(t => 
      t.estado === 'EN_PESAJE' || t.estado === 'RECIBIDO' || t.estado === 'EN_CORRAL'
    ))
    setTropasPesado(tropas.filter(t => t.estado === 'PESADO'))
  }, [tropas])

  const fetchData = async () => {
    try {
      const [tropasRes, corralesRes] = await Promise.all([
        fetch('/api/tropas'),
        fetch('/api/corrales')
      ])
      const tropasData = await tropasRes.json()
      const corralesData = await corralesRes.json()
      
      if (tropasData.success) {
        setTropas(tropasData.data)
      }
      if (corralesData.success) {
        setCorrales(corralesData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const razasActuales = tropaSeleccionada?.especie === 'EQUINO' ? RAZAS_EQUINO : RAZAS_BOVINO

  const tiposDisponiblesParaPesar = useMemo(() => {
    if (tiposConfirmados.length === 0) return []
    const todosTipos = TIPOS_ANIMALES[tropaSeleccionada?.especie || 'BOVINO'] || []
    return todosTipos.filter(t => {
      const confirmado = tiposConfirmados.find(tc => tc.tipoAnimal === t.codigo)
      return confirmado && confirmado.cantidadConfirmada > 0
    })
  }, [tiposConfirmados, tropaSeleccionada?.especie])

  const conteoPesadosPorTipo = useMemo(() => {
    const conteo: Record<string, number> = {}
    animales.filter(a => a.estado === 'PESADO').forEach(a => {
      conteo[a.tipoAnimal] = (conteo[a.tipoAnimal] || 0) + 1
    })
    return conteo
  }, [animales])

  const isTipoDisponible = (tipoCodigo: string): { disponible: boolean; restantes: number; mensaje: string } => {
    const confirmado = tiposConfirmados.find(tc => tc.tipoAnimal === tipoCodigo)
    if (!confirmado || confirmado.cantidadConfirmada === 0) {
      return { disponible: false, restantes: 0, mensaje: 'No declarado' }
    }
    const pesados = conteoPesadosPorTipo[tipoCodigo] || 0
    const restantes = confirmado.cantidadConfirmada - pesados
    if (restantes <= 0) {
      return { disponible: false, restantes: 0, mensaje: 'Límite' }
    }
    return { disponible: true, restantes, mensaje: `${restantes} rest.` }
  }

  const handleSeleccionarTropa = async (tropa: Tropa) => {
    const tiposIniciales: TipoCantidadConfirmada[] = (tropa.tiposAnimales || []).map(t => ({
      tipoAnimal: t.tipoAnimal,
      cantidadDTE: t.cantidad,
      cantidadConfirmada: t.cantidad
    }))
    setTiposConfirmados(tiposIniciales)

    try {
      const res = await fetch(`/api/tropas/${tropa.id}`)
      const data = await res.json()
      if (data.success && data.data.animales && data.data.animales.length > 0) {
        setAnimales(data.data.animales)
        const pendientes = data.data.animales.filter((a: Animal) => a.estado === 'RECIBIDO')
        // Si hay pendientes, setear al primer pendiente; si no, al primero del array
        setAnimalActual(pendientes.length > 0 ? data.data.animales.findIndex((a: Animal) => a.estado === 'RECIBIDO') : 0)
      } else {
        setAnimales([])
        setAnimalActual(0)
      }
    } catch {
      setAnimales([])
      setAnimalActual(0)
    }
    
    if (tropa.corralId) {
      setCorralDestinoId(tropa.corralId)
    } else if (typeof tropa.corral === 'object' && tropa.corral?.id) {
      setCorralDestinoId(tropa.corral.id)
    } else {
      setCorralDestinoId('')
    }
    
    setTropaSeleccionada(tropa)
    resetFormFields()
    setValidacionDialogOpen(true)
  }

  const resetFormFields = () => {
    setCaravana('')
    setTipoAnimalSeleccionado('')
    setRaza('')
    setPesoActual('')
  }

  const ajustarCantidadConfirmada = (tipoAnimal: string, delta: number) => {
    setTiposConfirmados(prev => prev.map(tc => {
      if (tc.tipoAnimal === tipoAnimal) {
        const nuevaCantidad = Math.max(0, tc.cantidadConfirmada + delta)
        return { ...tc, cantidadConfirmada: nuevaCantidad }
      }
      return tc
    }))
  }

  const setCantidadConfirmada = (tipoAnimal: string, cantidad: number) => {
    setTiposConfirmados(prev => prev.map(tc => {
      if (tc.tipoAnimal === tipoAnimal) {
        return { ...tc, cantidadConfirmada: Math.max(0, cantidad) }
      }
      return tc
    }))
  }

  const totalConfirmados = tiposConfirmados.reduce((acc, tc) => acc + tc.cantidadConfirmada, 0)
  const totalDTE = tiposConfirmados.reduce((acc, tc) => acc + tc.cantidadDTE, 0)

  const agregarNuevoTipo = () => {
    if (!nuevoTipoSeleccionado) return
    if (tiposConfirmados.some(tc => tc.tipoAnimal === nuevoTipoSeleccionado)) {
      toast.error('Este tipo de animal ya está en la lista')
      return
    }
    setTiposConfirmados(prev => [...prev, {
      tipoAnimal: nuevoTipoSeleccionado,
      cantidadDTE: 0,
      cantidadConfirmada: 1
    }])
    setNuevoTipoSeleccionado('')
    toast.success('Tipo agregado')
  }
  
  const eliminarTipo = (tipoAnimal: string) => {
    setTiposConfirmados(prev => prev.filter(tc => tc.tipoAnimal !== tipoAnimal))
  }

  const handleConfirmarValidacion = async () => {
    if (totalConfirmados === 0) {
      toast.error('Debe haber al menos un animal confirmado')
      return
    }
    if (!corralDestinoId) {
      toast.error('Seleccione el corral de destino')
      return
    }
    
    setValidacionDialogOpen(false)
    
    if (totalConfirmados !== totalDTE || tiposConfirmados.some(tc => tc.cantidadConfirmada !== tc.cantidadDTE)) {
      try {
        await fetch('/api/tropas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: tropaSeleccionada?.id,
            cantidadCabezas: totalConfirmados,
            tiposAnimales: tiposConfirmados.map(tc => ({
              tipoAnimal: tc.tipoAnimal,
              cantidad: tc.cantidadConfirmada
            }))
          })
        })
        toast.success('Cantidades actualizadas')
      } catch {
        toast.error('Error al actualizar cantidades')
      }
    }
    handleIniciarPesaje()
  }

  const handleIniciarPesaje = async () => {
    if (!tropaSeleccionada) return
    if (!corralDestinoId) {
      toast.error('Seleccione el corral de destino')
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/tropas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tropaSeleccionada.id,
          estado: 'EN_PESAJE',
          corralId: corralDestinoId
        })
      })
      
      if (res.ok) {
        toast.success('Pesaje iniciado')
        setActiveTab('pesar')
        
        if (animales.length === 0) {
          const nuevosAnimales: Animal[] = []
          let num = 1
          const prefijo = tropaSeleccionada.especie === 'BOVINO' ? 'B' : 'E'
          const year = new Date().getFullYear()
          
          for (const tipo of tiposConfirmados) {
            for (let i = 0; i < tipo.cantidadConfirmada; i++) {
              nuevosAnimales.push({
                id: `temp-${num}`,
                numero: num,
                codigo: `${prefijo}${year}${String(tropaSeleccionada.numero).padStart(4, '0')}-${String(num).padStart(3, '0')}`,
                tipoAnimal: tipo.tipoAnimal,
                estado: 'RECIBIDO'
              })
              num++
            }
          }
          setAnimales(nuevosAnimales)
          setAnimalActual(0)
        }
        fetchData()
      } else {
        toast.error('Error al iniciar pesaje')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleRegistrarPeso = async () => {
    if (!pesoActual || !animales[animalActual]) return
    const peso = parseFloat(pesoActual)
    if (isNaN(peso) || peso <= 0) {
      toast.error('Ingrese un peso válido')
      return
    }
    if (!tipoAnimalSeleccionado) {
      toast.error('Seleccione el tipo de animal')
      return
    }

    const tipoDisponible = isTipoDisponible(tipoAnimalSeleccionado)
    if (!tipoDisponible.disponible) {
      toast.error(`No puede asignar más de tipo ${tipoAnimalSeleccionado}`)
      return
    }

    setSaving(true)
    try {
      const animal = animales[animalActual]
      
      const res = await fetch('/api/animales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tropaId: tropaSeleccionada?.id,
          numero: animal.numero,
          codigo: animal.codigo,
          tipoAnimal: tipoAnimalSeleccionado,
          caravana: caravana || null,
          raza: raza || null,
          pesoVivo: peso,
          operadorId: operador.id
        })
      })
      
      if (res.ok) {
        const newAnimal = await res.json()
        
        const animalesActualizados = [...animales]
        animalesActualizados[animalActual] = {
          ...animalesActualizados[animalActual],
          id: newAnimal.id,
          caravana: caravana || undefined,
          raza: raza || undefined,
          tipoAnimal: tipoAnimalSeleccionado,
          pesoVivo: peso,
          estado: 'PESADO'
        }
        setAnimales(animalesActualizados)
        
        imprimirRotulo(animalesActualizados[animalActual])
        
        const nextIndex = animalesActualizados.findIndex((a, i) => a.estado === 'RECIBIDO' && i > animalActual)
        if (nextIndex !== -1) {
          setAnimalActual(nextIndex)
          resetFormFields()
          toast.success(`Animal ${animal.numero} - ${peso} kg`, { duration: 1500 })
        } else {
          const noPesados = animalesActualizados.filter(a => a.estado === 'RECIBIDO')
          if (noPesados.length === 0) {
            toast.success('Pesaje completado')
            handleFinalizarPesaje()
          } else {
            const firstPendiente = animalesActualizados.findIndex(a => a.estado === 'RECIBIDO')
            if (firstPendiente !== -1) {
              setAnimalActual(firstPendiente)
              resetFormFields()
            }
          }
        }
      } else {
        const errorData = await res.json()
        toast.error(errorData.error || 'Error al registrar peso')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleFinalizarPesaje = async () => {
    if (!tropaSeleccionada) return
    
    setSaving(true)
    try {
      const pesoTotal = animales.reduce((acc, a) => acc + (a.pesoVivo || 0), 0)
      
      const res = await fetch('/api/tropas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tropaSeleccionada.id,
          estado: 'PESADO',
          pesoTotalIndividual: pesoTotal
        })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        toast.success('Tropa pesada completamente')
        setTropaSeleccionada(null)
        setAnimales([])
        setAnimalActual(0)
        setTiposConfirmados([])
        setActiveTab('solicitar')
        await fetchData()
      } else {
        toast.error(data.error || 'Error al finalizar pesaje')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // Rótulo de 10x5 cm con código de barras (solo en impresión)
  const imprimirRotulo = (animal: Animal) => {
    try {
      // Usar setTimeout para no bloquear el hilo principal
      setTimeout(() => {
        const printWindow = window.open('', '_blank', 'width=400,height=250,noopener,noreferrer')
        if (printWindow) {
          const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Rótulo ${animal.codigo}</title>
  <style>
    @page { size: 10cm 5cm; margin: 0; }
    body { 
      font-family: Arial, sans-serif; 
      padding: 3mm; 
      width: 10cm;
      height: 5cm;
      box-sizing: border-box;
      margin: 0;
    }
    .rotulo {
      border: 3px solid black;
      padding: 3mm;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header {
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      border-bottom: 2px solid black;
      padding-bottom: 2mm;
    }
    .content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex: 1;
    }
    .numero-animal {
      font-size: 48px;
      font-weight: bold;
      text-align: center;
      line-height: 1;
    }
    .datos {
      text-align: right;
      font-size: 12px;
    }
    .datos div {
      margin: 1mm 0;
    }
    .barcode {
      text-align: center;
      font-family: 'Libre Barcode 39', cursive;
      font-size: 24px;
      letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <div class="rotulo">
    <div class="header">SOLEMAR ALIMENTARIA</div>
    <div class="content">
      <div class="numero-animal">${animal.numero}</div>
      <div class="datos">
        <div><strong>Tropa:</strong> ${tropaSeleccionada?.codigo || ''}</div>
        <div><strong>Tipo:</strong> ${animal.tipoAnimal}</div>
        <div><strong>Peso:</strong> ${animal.pesoVivo?.toLocaleString()} kg</div>
      </div>
    </div>
    <div class="barcode">*${animal.codigo}*</div>
  </div>
  <script>
    (function() {
      setTimeout(function() {
        window.print();
      }, 100);
      window.onafterprint = function() { 
        setTimeout(function() { window.close(); }, 100);
      };
    })();
  </script>
</body>
</html>`
          printWindow.document.write(htmlContent)
          printWindow.document.close()
          // Devolver el foco a la ventana principal
          window.focus()
        }
      }, 50)
    } catch (error) {
      console.error('Error al imprimir rótulo:', error)
      // No interrumpir el flujo principal si hay error de impresión
    }
  }

  const handleEditAnimal = (animal: Animal) => {
    setEditingAnimal(animal)
    setEditCaravana(animal.caravana || '')
    setEditTipoAnimal(animal.tipoAnimal)
    setEditRaza(animal.raza || '')
    setEditPeso(animal.pesoVivo?.toString() || '')
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingAnimal) return
    
    try {
      const res = await fetch('/api/animales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAnimal.id,
          caravana: editCaravana || null,
          tipoAnimal: editTipoAnimal,
          raza: editRaza || null,
          pesoVivo: parseFloat(editPeso) || null
        })
      })
      
      if (res.ok) {
        toast.success('Animal actualizado')
        setEditDialogOpen(false)
        const updated = animales.map(a => {
          if (a.id === editingAnimal.id) {
            return { ...a, caravana: editCaravana || undefined, tipoAnimal: editTipoAnimal, raza: editRaza || undefined, pesoVivo: parseFloat(editPeso) || undefined }
          }
          return a
        })
        setAnimales(updated)
      } else {
        toast.error('Error al actualizar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const handleDeleteAnimal = async (animal: Animal) => {
    if (!confirm(`¿Eliminar animal ${animal.numero}?`)) return
    
    try {
      const res = await fetch(`/api/animales?id=${animal.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Animal eliminado')
        const updated = animales.filter(a => a.id !== animal.id)
        setAnimales(updated)
        if (animalActual >= updated.length) {
          setAnimalActual(Math.max(0, updated.length - 1))
        }
      } else {
        toast.error('Error al eliminar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const animalesPendientes = animales.filter(a => a.estado === 'RECIBIDO')
  const animalesPesados = animales.filter(a => a.estado === 'PESADO')

  if (loading) {
    return (
      <div className="h-screen bg-stone-100 flex items-center justify-center">
        <Scale className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-stone-100 flex flex-col overflow-hidden">
      {/* Header Compacto */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b flex-shrink-0">
        <h2 className="text-lg font-bold text-stone-800">Pesaje Individual</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Badge variant="outline" className="text-sm">
            <Beef className="h-3 w-3 mr-1 text-amber-500" />
            {tropasPorPesar.length} por pesar
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
          <TabsTrigger value="solicitar">Solicitar Tropa</TabsTrigger>
          <TabsTrigger value="pesar" disabled={!tropaSeleccionada}>Pesar</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        {/* SOLICITAR TROPA */}
        <TabsContent value="solicitar" className="flex-1 overflow-auto p-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-amber-50 py-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Tropas Por Pesar ({tropasPorPesar.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {tropasPorPesar.length === 0 ? (
                  <div className="text-center py-6 text-stone-400">
                    <Beef className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay tropas pendientes</p>
                  </div>
                ) : (
                  tropasPorPesar.map((tropa) => (
                    <div key={tropa.id} className="flex items-center justify-between p-3 hover:bg-stone-50">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-sm">{tropa.codigo}</span>
                        <span className="text-sm text-stone-600">{tropa.usuarioFaena?.nombre || '-'}</span>
                        <Badge variant="outline" className="text-xs">{tropa.especie}</Badge>
                        <span className="text-sm font-medium">{tropa.cantidadCabezas} cab</span>
                      </div>
                      <Button size="sm" onClick={() => handleSeleccionarTropa(tropa)} className="bg-amber-500 hover:bg-amber-600">
                        <Scale className="w-3 h-3 mr-1" /> Seleccionar
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-green-50 py-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Tropas Pesadas ({tropasPesado.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {tropasPesado.length === 0 ? (
                  <div className="text-center py-6 text-stone-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay tropas pesadas</p>
                  </div>
                ) : (
                  tropasPesado.map((tropa) => (
                    <div key={tropa.id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-sm">{tropa.codigo}</span>
                        <span className="text-sm text-stone-600">{tropa.usuarioFaena?.nombre || '-'}</span>
                        <span className="text-sm font-medium">{tropa.cantidadCabezas} cab</span>
                        <span className="text-sm font-bold text-green-600">{tropa.pesoTotalIndividual?.toLocaleString() || '-'} kg</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESAR ANIMALES - Layout sin scroll */}
        <TabsContent value="pesar" className="flex-1 overflow-hidden p-4">
          <div className="h-full grid grid-cols-3 gap-4">
            {/* Panel Izquierdo: Formulario de Pesaje */}
            <Card className="col-span-2 border-0 shadow-sm flex flex-col h-full overflow-hidden">
              <CardHeader className="bg-green-50 py-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{tropaSeleccionada?.codigo}</CardTitle>
                  <div className="flex items-center gap-2 text-sm">
                    <span>{animalesPesados.length}/{animales.length}</span>
                    <div className="w-24 h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${(animalesPesados.length / animales.length) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-4 overflow-hidden flex flex-col">
                {animales.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <Scale className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                      <p className="text-stone-500">No hay animales para pesar</p>
                      <p className="text-sm text-stone-400 mt-1">Confirme la validación para generar animales</p>
                    </div>
                  </div>
                ) : animalesPendientes.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                      <p className="text-green-600 font-semibold">Pesaje completado</p>
                      <p className="text-sm text-stone-500 mt-1">Todos los animales han sido pesados</p>
                      <Button 
                        className="mt-4" 
                        onClick={() => handleFinalizarPesaje()}
                      >
                        Finalizar Pesaje
                      </Button>
                    </div>
                  </div>
                ) : animales[animalActual] ? (
                  <div className="flex-1 flex flex-col">
                    {/* NÚMERO DE ANIMAL DESTACADO */}
                    <div className="text-center mb-4">
                      <div className="text-8xl font-black text-stone-800 leading-none">
                        {animales[animalActual].numero}
                      </div>
                      <div className="text-stone-400 text-sm mt-1">de {animales.length} animales</div>
                    </div>

                    {/* Tipos disponibles - Compacto */}
                    <div className="mb-3">
                      <Label className="text-xs font-semibold mb-1 block">Tipo *</Label>
                      <div className="flex flex-wrap gap-1">
                        {tiposDisponiblesParaPesar.map((t) => {
                          const tipoStatus = isTipoDisponible(t.codigo)
                          const isSelected = tipoAnimalSeleccionado === t.codigo
                          return (
                            <button
                              key={t.codigo}
                              type="button"
                              onClick={() => tipoStatus.disponible && setTipoAnimalSeleccionado(t.codigo)}
                              disabled={!tipoStatus.disponible}
                              className={`px-3 py-2 rounded text-sm font-bold transition-all ${
                                isSelected 
                                  ? 'bg-amber-500 text-white' 
                                  : tipoStatus.disponible
                                    ? 'bg-white border hover:border-amber-300'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {t.codigo} <span className="text-xs font-normal">({tipoStatus.restantes})</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Peso y Caravana - Compacto */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label className="text-xs mb-1 block">Peso (kg) *</Label>
                        <Input
                          type="number"
                          value={pesoActual}
                          onChange={(e) => setPesoActual(e.target.value)}
                          className="text-3xl font-bold text-center h-14"
                          placeholder="0"
                          autoFocus
                        />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Caravana</Label>
                        <Input
                          value={caravana}
                          onChange={(e) => setCaravana(e.target.value.toUpperCase())}
                          placeholder="Opcional"
                          className="font-mono h-14"
                        />
                      </div>
                    </div>

                    {/* Raza - Compacto */}
                    <div className="mb-4">
                      <Label className="text-xs mb-1 block">Raza</Label>
                      <Select value={raza} onValueChange={setRaza}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {razasActuales.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Botón Registrar */}
                    <Button
                      onClick={handleRegistrarPeso}
                      disabled={saving || !pesoActual || !tipoAnimalSeleccionado}
                      className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                    >
                      {saving ? 'Guardando...' : (
                        <>
                          <Scale className="w-5 h-5 mr-2" />
                          REGISTRAR <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                      <p className="text-stone-600">Seleccione un animal pendiente</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Panel Derecho: Lista de Animales con scroll */}
            <Card className="border-0 shadow-sm flex flex-col h-full overflow-hidden">
              <CardHeader className="py-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Animales</CardTitle>
                  <div className="text-xs text-stone-500">
                    {animalesPesados.length} pesados, {animalesPendientes.length} pendientes
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                <div className="divide-y">
                  {animales.map((animal, idx) => (
                    <div
                      key={animal.id}
                      onClick={() => setAnimalActual(idx)}
                      className={`flex items-center justify-between p-2 cursor-pointer ${
                        idx === animalActual ? 'bg-amber-100' : 'hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {animal.estado === 'PESADO' ? (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                        <span className={`font-bold ${animal.estado === 'PESADO' ? 'text-green-700' : ''}`}>
                          #{animal.numero}
                        </span>
                        <Badge variant="outline" className="text-xs">{animal.tipoAnimal}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {animal.pesoVivo && (
                          <span className="text-xs text-green-600 font-medium">{animal.pesoVivo}kg</span>
                        )}
                        {animal.estado === 'PESADO' && animal.id && !animal.id.startsWith('temp-') && (
                          <button onClick={(e) => { e.stopPropagation(); handleEditAnimal(animal); }} className="p-1 hover:bg-stone-200 rounded">
                            <Edit className="w-3 h-3 text-stone-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* HISTORIAL */}
        <TabsContent value="historial" className="flex-1 overflow-auto p-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-green-50 py-2">
              <CardTitle className="text-base">Historial de Pesajes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {tropasPesado.length === 0 ? (
                  <div className="text-center py-8 text-stone-400">No hay tropas pesadas</div>
                ) : (
                  tropasPesado.map((tropa) => (
                    <div key={tropa.id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold">{tropa.codigo}</span>
                        <span className="font-bold text-green-600">{tropa.pesoTotalIndividual?.toLocaleString() || '-'} kg</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-stone-500">
                        <span>{tropa.usuarioFaena?.nombre || '-'}</span>
                        <span>{tropa.cantidadCabezas} cabezas</span>
                        {tropa.pesoTotalIndividual && tropa.cantidadCabezas && (
                          <span>_prom: {Math.round(tropa.pesoTotalIndividual / tropa.cantidadCabezas)} kg/cab</span>
                        )}
                      </div>
                      {tropa.tiposAnimales && tropa.tiposAnimales.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tropa.tiposAnimales.map((t, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {t.tipoAnimal}: {t.cantidad}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DE VALIDACIÓN */}
      <Dialog open={validacionDialogOpen} onOpenChange={setValidacionDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="w-5 h-5 text-amber-600" />
              Validar Tropa {tropaSeleccionada?.codigo}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Tabla de validación */}
            <div className="border rounded-lg overflow-hidden text-sm">
              <div className="grid grid-cols-4 gap-2 p-2 bg-stone-100 font-semibold text-xs">
                <div>Tipo</div>
                <div className="text-center">DTE</div>
                <div className="text-center">Recibido</div>
                <div className="text-center">Acción</div>
              </div>
              {tiposConfirmados.map((tc) => {
                const tipoInfo = TIPOS_ANIMALES[tropaSeleccionada?.especie || 'BOVINO']?.find(t => t.codigo === tc.tipoAnimal)
                const diferencia = tc.cantidadConfirmada - tc.cantidadDTE
                const esNuevo = tc.cantidadDTE === 0
                return (
                  <div key={tc.tipoAnimal} className={`grid grid-cols-4 gap-2 p-2 items-center ${esNuevo ? 'bg-blue-50' : diferencia !== 0 ? 'bg-amber-50' : ''}`}>
                    <div className="flex items-center gap-1">
                      <span className="font-bold">{tc.tipoAnimal}</span>
                      {esNuevo && <Badge variant="outline" className="text-xs bg-blue-100">NUEVO</Badge>}
                    </div>
                    <div className="text-center font-mono">{tc.cantidadDTE}</div>
                    <div className="text-center">
                      <Input
                        type="number"
                        value={tc.cantidadConfirmada}
                        onChange={(e) => setCantidadConfirmada(tc.tipoAnimal, parseInt(e.target.value) || 0)}
                        className="w-16 text-center mx-auto h-8"
                        min="0"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => ajustarCantidadConfirmada(tc.tipoAnimal, -1)} disabled={tc.cantidadConfirmada <= 0} className="h-7 w-7 p-0">
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => ajustarCantidadConfirmada(tc.tipoAnimal, 1)} className="h-7 w-7 p-0">
                        <Plus className="w-3 h-3" />
                      </Button>
                      {esNuevo && (
                        <Button variant="ghost" size="sm" onClick={() => eliminarTipo(tc.tipoAnimal)} className="h-7 w-7 p-0 text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Totales */}
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg text-sm">
              <div>
                <span className="text-stone-500">Total DTE: </span>
                <span className="font-bold">{totalDTE}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
              <div>
                <span className="text-stone-500">Total Confirmado: </span>
                <span className={`font-bold ${totalConfirmados !== totalDTE ? 'text-amber-600' : 'text-green-600'}`}>
                  {totalConfirmados}
                </span>
              </div>
            </div>

            {/* Corral */}
            <div>
              <Label className="text-sm font-semibold">Corral de Destino *</Label>
              <Select value={corralDestinoId} onValueChange={setCorralDestinoId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccione corral..." />
                </SelectTrigger>
                <SelectContent>
                  {corrales.map((c) => {
                    const stockActual = tropaSeleccionada?.especie === 'BOVINO' ? c.stockBovinos : c.stockEquinos
                    const disponible = c.capacidad - stockActual
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} - Disp: {disponible}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Agregar tipo nuevo */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Label className="text-xs font-semibold text-blue-800">Agregar tipo no declarado</Label>
              <div className="flex gap-2 mt-1">
                <Select value={nuevoTipoSeleccionado} onValueChange={setNuevoTipoSeleccionado}>
                  <SelectTrigger className="flex-1 h-8">
                    <SelectValue placeholder="Tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_ANIMALES[tropaSeleccionada?.especie || 'BOVINO']
                      ?.filter(t => !tiposConfirmados.some(tc => tc.tipoAnimal === t.codigo))
                      .map(t => (
                        <SelectItem key={t.codigo} value={t.codigo}>{t.codigo} - {t.label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={agregarNuevoTipo} disabled={!nuevoTipoSeleccionado} size="sm" className="bg-blue-600 text-white h-8">
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setValidacionDialogOpen(false); setTropaSeleccionada(null); }} size="sm">
              Cancelar
            </Button>
            <Button onClick={handleConfirmarValidacion} disabled={totalConfirmados === 0 || !corralDestinoId} className="bg-green-600" size="sm">
              <CheckCircle className="w-4 h-4 mr-1" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Animal #{editingAnimal?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Caravana</Label>
              <Input value={editCaravana} onChange={(e) => setEditCaravana(e.target.value.toUpperCase())} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={editTipoAnimal} onValueChange={setEditTipoAnimal}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ANIMALES[tropaSeleccionada?.especie || 'BOVINO']?.map((t) => (
                    <SelectItem key={t.codigo} value={t.codigo}>{t.codigo} - {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Peso (kg)</Label>
              <Input type="number" value={editPeso} onChange={(e) => setEditPeso(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Raza</Label>
              <Select value={editRaza} onValueChange={setEditRaza}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sin definir" />
                </SelectTrigger>
                <SelectContent>
                  {razasActuales.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} size="sm">Cancelar</Button>
            <Button onClick={handleSaveEdit} size="sm">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
