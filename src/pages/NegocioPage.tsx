import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  Plus, Trash2, Check, DollarSign, AlertTriangle, ShieldAlert, ShieldCheck,
  Search, RefreshCw, Percent, Pencil, Save, X, Download,
  Users, Briefcase, ClipboardList, Calendar, TrendingUp, Clock, CalendarClock,
  Eye, EyeOff, Wallet, MessageCircle, Target, BarChart3, History,
  Award, Flame, Activity, Sparkles, Crown, ArrowUpRight, ArrowDownRight,
  Layers, CircleDollarSign, List, Zap, FileText, ChevronDown, ArrowUpDown, Link2
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { META_MENSUAL_NEGOCIO, COLORES_RANKING } from '../utils/constants';
import { 
  formatearDinero, formatearDineroCorto, getColombiaDateOnly, 
  getColombiaISO, getColombiaDateDisplay, obtenerHoraColombiana,
  calcularDiasRestantesGarantia
} from '../utils/helpers';
import type { Factura, HistorialAbono, PagoRevendedor, DistribucionPago } from '../utils/types';

// Tipo para el desglose de ganancias
interface DetalleGanancia {
  facturaId: number;
  cliente: string;
  empresa: string;
  revendedor: string;
  monto: number;
  tipo: 'abono' | 'pago_completo';
  fecha: string;
}

// =============================================
// OPTIMIZED ANIMATION VARIANTS (Simpler, no infinite loops)
// =============================================

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.2 }
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } }
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } }
};

// =============================================
// MEMOIZED SIMPLE COMPONENTS
// =============================================
const MagneticButton = memo(({ children, className, onClick, disabled, ...props }: any) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    className={className}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    transition={{ duration: 0.15 }}
    {...props}
  >
    {children}
  </motion.button>
));
MagneticButton.displayName = 'MagneticButton';

// Static background - NO animations
const StaticBackground = memo(() => (
  <div className="fixed inset-0 pointer-events-none">
    <div 
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }}
    />
    {/* Static orbs - no animation, just CSS */}
    <div className="absolute w-[400px] h-[400px] rounded-full bg-purple-600/20 blur-[100px] top-[10%] left-[20%]" />
    <div className="absolute w-[300px] h-[300px] rounded-full bg-indigo-600/15 blur-[80px] top-[50%] right-[10%]" />
  </div>
));
StaticBackground.displayName = 'StaticBackground';

// Simple card wrapper - no useInView per card
const SimpleCard = memo(({ children, className }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    className={className}
  >
    {children}
  </motion.div>
));
SimpleCard.displayName = 'SimpleCard';

// =============================================
// MEMOIZED FACTURA CARD
// =============================================
interface FacturaCardProps {
  factura: Factura;
  isEditing: boolean;
  editValues: { porcentaje: number; cobro: number; monto: number };
  isOculta: boolean;
  onTogglePago: (id: number) => void;
  onIniciarCobro: (f: Factura) => void;
  onEnviarRecordatorio: (f: Factura) => void;
  onAplicarGarantia: (id: number) => void;
  onIniciarEdicion: (f: Factura) => void;
  onGuardarEdicion: () => void;
  onCancelarEdicion: () => void;
  onEliminar: (id: number) => void;
  onAbrirHistorial: (f: Factura) => void;
  onEditPorcentaje: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEditCobro: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEditMonto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleOcultar: (id: number) => void;
  onAbonoProveedor: (f: Factura) => void;
}

const FacturaCard = memo(({ 
  factura: f, 
  isEditing, 
  editValues,
  isOculta,
  onTogglePago,
  onIniciarCobro,
  onEnviarRecordatorio,
  onAplicarGarantia,
  onIniciarEdicion,
  onGuardarEdicion,
  onCancelarEdicion,
  onEliminar,
  onAbrirHistorial,
  onEditPorcentaje,
  onEditCobro,
  onEditMonto,
  onToggleOcultar,
  onAbonoProveedor
}: FacturaCardProps) => {
  const getEstadoGarantia = (fecha: string, pagadoProveedor: boolean) => {
    const dias = calcularDiasRestantesGarantia(fecha);
    // Si no se ha pagado al proveedor, la garantía no está activa
    if (!pagadoProveedor) return { texto: 'Sin Activar', color: 'text-gray-600', bg: 'bg-gray-800/50', icon: Clock, estado: 'inactiva' };
    // Si ya pasaron los 30 días
    if (dias < 0) return { texto: '✓ Cubierta', color: 'text-emerald-400', bg: 'bg-emerald-900/20', icon: ShieldCheck, estado: 'cubierta' };
    // Si está por vencer (5 días o menos)
    if (dias <= 5) return { texto: `${dias}d (¡Casi!)`, color: 'text-orange-400', bg: 'bg-orange-900/30', icon: ShieldAlert, estado: 'porvencer' };
    // Garantía activa normal
    return { texto: `${dias}d garantía`, color: 'text-purple-400', bg: 'bg-purple-900/30', icon: ShieldCheck, estado: 'activa' };
  };

  const getEstadoPromesaPago = (fechaPromesa: string | null) => {
    if (!fechaPromesa) return null;
    const hoy = getColombiaDateOnly();
    const promesa = new Date(fechaPromesa).toISOString().slice(0, 10);
    if (promesa < hoy) return { texto: 'Vencido (Cobrar YA)', color: 'text-red-500', bg: 'bg-red-900/20' };
    if (promesa === hoy) return { texto: 'Cobrar HOY', color: 'text-orange-400', bg: 'bg-orange-900/20' };
    return { texto: `Pagan el ${promesa.slice(8,10)}/${promesa.slice(5,7)}`, color: 'text-blue-400', bg: 'bg-blue-900/20' };
  };

  const garantia = getEstadoGarantia(f.fechaISO, f.pagadoAProveedor);
  const IconGarantia = garantia.icon;
  const pendienteDeCobro = f.pagadoAProveedor && !f.cobradoACliente;
  const saldoPendiente = f.cobroCliente - (f.abono || 0);
  const promesa = getEstadoPromesaPago(f.fechaPromesa);
  
  // Variables para abono al proveedor
  const abonoProveedorActual = f.abonoProveedor || 0;
  const tieneAbonoProveedor = abonoProveedorActual > 0 && !f.pagadoAProveedor;
  
  // Indicador de prioridad: Ya te pagaron pero no has pagado al proveedor
  const esPrioritaria = !f.pagadoAProveedor && (f.cobradoACliente || (f.abono || 0) > 0);

  return (
    <div className={`relative bg-gradient-to-br from-[#1a1f33] via-[#151929] to-[#0f1219] rounded-2xl border overflow-hidden transition-all ${
      isOculta ? 'opacity-40 border-gray-800/30' : 
      isEditing ? 'border-purple-500' : 
      esPrioritaria ? 'border-red-500/50 shadow-lg shadow-red-500/10' :
      pendienteDeCobro ? 'border-orange-500/40' : 
      'border-gray-800/50 hover:border-gray-700'
    }`}>
      {isOculta && (
        <div className="absolute top-2 left-2 z-10 bg-gray-900/90 text-gray-400 text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
          <EyeOff size={10} /> Oculta
        </div>
      )}
      
      {/* Badge de prioridad: Ya te pagaron */}
      {esPrioritaria && !isOculta && (
        <div className="absolute top-0 left-0 z-10 bg-red-500/90 text-white text-[9px] font-bold px-3 py-1.5 rounded-br-xl uppercase flex items-center gap-1">
          <AlertTriangle size={10} /> {f.cobradoACliente ? '¡YA TE PAGARON!' : 'Tiene abono'}
        </div>
      )}
      
      {isEditing ? (
        <div className="p-5 bg-purple-900/20">
          <p className="text-xs text-purple-400 font-bold mb-3 uppercase flex items-center gap-2">
            <Pencil size={12} /> Editando: {f.cliente}
          </p>
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-500">Valor Factura</label>
                <input 
                  type="tel" 
                  className="w-full bg-[#0a0d14] border border-blue-500/30 rounded-xl p-3 text-blue-400 font-bold font-mono" 
                  value={editValues.monto} 
                  onChange={onEditMonto} 
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-500">Porcentaje</label>
                <input 
                  type="tel" 
                  className="w-full bg-[#0a0d14] border border-gray-700 rounded-xl p-3 text-white font-mono" 
                  value={editValues.porcentaje} 
                  onChange={onEditPorcentaje} 
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-500">Cobro</label>
                <input 
                  type="tel" 
                  className="w-full bg-[#0a0d14] border border-emerald-500/30 rounded-xl p-3 text-emerald-400 font-bold font-mono" 
                  value={editValues.cobro} 
                  onChange={onEditCobro} 
                />
              </div>
            </div>
            <div className="flex gap-2">
              <MagneticButton onClick={onGuardarEdicion} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded-xl font-bold">
                <Save size={18} className="mx-auto" />
              </MagneticButton>
              <MagneticButton onClick={onCancelarEdicion} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl">
                <X size={18} className="mx-auto" />
              </MagneticButton>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="relative p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {pendienteDeCobro && !isOculta && (
              <div className="absolute top-0 right-0 flex gap-1">
                {promesa && (
                  <div className={`text-[9px] font-bold px-3 py-1.5 rounded-bl-xl uppercase flex items-center gap-1 ${promesa.bg} ${promesa.color}`}>
                    <CalendarClock size={10} /> {promesa.texto}
                  </div>
                )}
                <div className="bg-orange-500/20 text-orange-400 text-[9px] font-bold px-3 py-1.5 rounded-bl-xl uppercase">
                  Por Cobrar
                </div>
              </div>
            )}

            <div className="flex items-start gap-4 flex-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-indigo-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-purple-500/20 text-white flex-shrink-0">
                {f.empresa.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-bold text-lg truncate">{f.cliente}</h3>
                  <span className="text-xs bg-gray-800/80 text-gray-300 px-2.5 py-1 rounded-lg border border-gray-700/50">{f.empresa}</span>
                </div>
                <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
                  <Briefcase size={12} className="text-purple-400"/>
                  <span className="text-purple-400 font-medium">{f.revendedor}</span>
                  <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                  {f.fechaDisplay}
                </p>
                {f.fechaPagoReal && (
                  <p className="text-[10px] text-emerald-500/70 mt-1.5 flex items-center gap-1">
                    <Clock size={10}/> Pagado {f.fechaPagoReal}
                  </p>
                )}
                {f.historialAbonos && f.historialAbonos.length > 0 && (
                  <button 
                    onClick={() => onAbrirHistorial(f)} 
                    className="mt-2 text-left hover:bg-blue-500/10 p-2 rounded-lg w-full transition-colors border border-transparent hover:border-blue-500/30"
                  >
                    <p className="text-[10px] text-blue-400 font-medium flex items-center gap-1">
                      <History size={10}/> Ver historial ({f.historialAbonos.length} abonos)
                    </p>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
              {/* Botón de pago al proveedor con soporte para abonos */}
              <div className="flex flex-col items-center">
                {!f.pagadoAProveedor ? (
                  <div className="flex gap-1">
                    <MagneticButton 
                      onClick={() => onTogglePago(f.id)} 
                      className="p-3 rounded-xl border transition-colors bg-gray-800/50 border-gray-700/50 text-gray-500 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                      title="Marcar como pagado completo"
                    >
                      <Check size={20} />
                    </MagneticButton>
                    <MagneticButton 
                      onClick={() => onAbonoProveedor(f)} 
                      className="p-3 rounded-xl border transition-colors bg-gray-800/50 border-gray-700/50 text-gray-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10"
                      title="Registrar abono parcial"
                    >
                      <DollarSign size={20} />
                    </MagneticButton>
                  </div>
                ) : (
                  <MagneticButton 
                    onClick={() => onTogglePago(f.id)} 
                    className="p-3 rounded-xl border transition-colors bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-500 text-white shadow-lg shadow-blue-500/30"
                    title="Desmarcar pago"
                  >
                    <DollarSign size={20} />
                  </MagneticButton>
                )}
                {/* Progreso de pago al proveedor */}
                {tieneAbonoProveedor && (
                  <div className="mt-2 w-full">
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${(abonoProveedorActual / f.montoFactura) * 100}%` }}
                      />
                    </div>
                    <p className="text-[8px] text-yellow-400 text-center mt-0.5">
                      {formatearDinero(abonoProveedorActual)} / {formatearDinero(f.montoFactura)}
                    </p>
                  </div>
                )}
              </div>
              
              {!f.cobradoACliente && (
                <MagneticButton 
                  onClick={() => onEnviarRecordatorio(f)} 
                  className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors"
                >
                  <MessageCircle size={20} />
                </MagneticButton>
              )}

              <MagneticButton 
                onClick={() => onIniciarCobro(f)} 
                className={`px-5 py-3 rounded-xl flex items-center gap-2 font-bold text-sm border transition-colors ${f.cobradoACliente ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50'}`}
              >
                {f.cobradoACliente ? <Check size={18} /> : <span>Cobrar</span>}
              </MagneticButton>

              <div className="text-right ml-2 min-w-[100px]">
                <p className="text-[10px] text-gray-500 uppercase font-bold">Ganancia</p>
                <p className="text-2xl font-bold font-mono text-white">{formatearDinero(f.cobroCliente)}</p>
                {f.abono > 0 && !f.cobradoACliente && (
                  <div className="mt-2">
                    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                        style={{ width: `${(f.abono / f.cobroCliente) * 100}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-orange-400 text-right mt-1">Resta: {formatearDinero(saldoPendiente)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#060810] border-t border-gray-800/50 p-3 flex flex-wrap gap-4 items-center justify-between text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Estado de garantía */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border ${garantia.bg} ${garantia.color} border-white/5`}>
                <IconGarantia size={12} />{garantia.texto}
              </div>
              
              {/* Botón de garantía - toggle */}
              {f.pagadoAProveedor && calcularDiasRestantesGarantia(f.fechaISO) >= 0 && (
                <button 
                  onClick={() => onAplicarGarantia(f.id)} 
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors border ${
                    f.usoGarantia && f.garantiaResuelta
                      ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/60'
                      : f.usoGarantia 
                        ? 'bg-red-900/40 text-red-400 border-red-500/30 hover:bg-red-900/60' 
                        : 'text-gray-500 hover:text-orange-400 border-transparent hover:bg-orange-500/10 hover:border-orange-500/20'
                  }`}
                  title={
                    f.usoGarantia && f.garantiaResuelta 
                      ? 'Garantía resuelta - Clic para quitar' 
                      : f.usoGarantia 
                        ? 'Clic para resolver garantía' 
                        : 'Reportar problema/garantía'
                  }
                >
                  {f.usoGarantia && f.garantiaResuelta ? (
                    <><ShieldCheck size={12} /> Resuelta ✓</>
                  ) : f.usoGarantia ? (
                    <><RefreshCw size={12} /> Pendiente</>
                  ) : (
                    <><RefreshCw size={12} /> Falla</>
                  )}
                </button>
              )}
              
              {/* Info de garantía usada */}
              {f.usoGarantia && (
                <span className={`text-[10px] flex items-center gap-1 ${f.garantiaResuelta ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                  {f.garantiaResuelta ? (
                    <>Resuelta el {f.fechaResolucionGarantia}</>
                  ) : (
                    <>
                      {f.fechaGarantia && <span>Reportada: {f.fechaGarantia}</span>}
                      {f.costoGarantia && f.costoGarantia > 0 && <span className="text-red-300">• Devuelto: {formatearDineroCorto(f.costoGarantia)}</span>}
                    </>
                  )}
                </span>
              )}
              
              {/* Indicador de garantía cubierta */}
              {garantia.estado === 'cubierta' && !f.usoGarantia && (
                <span className="text-emerald-500/70 text-[10px] flex items-center gap-1">
                  <ShieldCheck size={10} /> Sin incidentes
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-gray-500 font-mono ml-auto">
              <span>Fac: {formatearDinero(f.montoFactura)}</span>
              <button 
                onClick={() => onToggleOcultar(f.id)} 
                className={`p-2 rounded-lg transition-colors ${isOculta ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10' : 'text-gray-600 hover:text-gray-400 hover:bg-gray-500/10'}`}
                title={isOculta ? 'Mostrar factura' : 'Ocultar factura'}
              >
                {isOculta ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button 
                onClick={() => onIniciarEdicion(f)} 
                className="text-blue-400 hover:text-blue-300 p-2 rounded-lg hover:bg-blue-500/10 transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button 
                onClick={() => onEliminar(f.id)} 
                className="text-gray-600 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
FacturaCard.displayName = 'FacturaCard';

// =============================================
// MAIN COMPONENT
// =============================================
const NegocioPage = () => {
  const { facturas, setFacturas, revendedoresOcultos, setRevendedoresOcultos, pagosRevendedores, setPagosRevendedores, facturasOcultas, setFacturasOcultas } = useData();

  // Toggle para mostrar/ocultar facturas ocultas en la lista
  const [mostrarOcultas, setMostrarOcultas] = useState(false);

  // =============================================
  // ESTADOS UI
  // =============================================
  const [form, setForm] = useState({
    cliente: '', telefono: '', revendedor: '', empresa: '',
    montoFactura: '', porcentajeCobro: 50, cobroCliente: '',
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ porcentaje: 0, cobro: 0, monto: 0 });
  
  const [modalAbono, setModalAbono] = useState({ visible: false, id: null as number | null, saldoPendiente: 0, total: 0 });
  const [datosAbono, setDatosAbono] = useState({ monto: '', fechaPromesa: '', fechaAbono: '' });

  // Modal para abono al proveedor (pagos parciales)
  const [modalAbonoProveedor, setModalAbonoProveedor] = useState<{
    visible: boolean;
    factura: Factura | null;
  }>({ visible: false, factura: null });
  const [montoAbonoProveedor, setMontoAbonoProveedor] = useState('');
  const [fechaAbonoProveedor, setFechaAbonoProveedor] = useState('');

  const [modalRevendedor, setModalRevendedor] = useState({ visible: false, nombre: '', deudaTotal: 0 });
  const [montoAbonoRevendedor, setMontoAbonoRevendedor] = useState('');
  const [fechaAbonoRevendedor, setFechaAbonoRevendedor] = useState('');
  const [modalHistorialPagos, setModalHistorialPagos] = useState({ visible: false, nombre: '' });

  const [vistaEstadisticas, setVistaEstadisticas] = useState(false);
  const [vistaRevendedores, setVistaRevendedores] = useState(false);

  // Buscador de revendedores
  const [busquedaRevendedor, setBusquedaRevendedor] = useState('');

  // Modal para gestionar garantía
  const [modalGarantia, setModalGarantia] = useState<{
    visible: boolean;
    factura: Factura | null;
    modo: 'reportar' | 'resolver';
  }>({ visible: false, factura: null, modo: 'reportar' });
  const [formGarantia, setFormGarantia] = useState({
    motivo: '',
    costoDevolucion: '',
    fechaResolucion: getColombiaDateOnly()
  });

  const [filtro, setFiltro] = useState('porPagar'); 
  const [busqueda, setBusqueda] = useState('');
  
  const [mesEstadistica, setMesEstadistica] = useState(getColombiaDateOnly().slice(0, 7));
  const [diaEstadistica, setDiaEstadistica] = useState(getColombiaDateOnly());

  // Estado para ordenamiento de facturas
  const [ordenFacturas, setOrdenFacturas] = useState<'reciente' | 'antiguo' | 'servicio' | 'revendedor' | 'monto'>('reciente');

  // Referencia para rastrear el día del sistema (no la selección del usuario)
  const ultimoDiaSistema = useRef(getColombiaDateOnly());

  // Efecto para actualizar automáticamente solo cuando cambia el día del SISTEMA (medianoche)
  useEffect(() => {
    const verificarCambioDia = () => {
      const hoy = getColombiaDateOnly();
      // Solo resetear si el día del SISTEMA cambió (ej: pasó la medianoche)
      if (ultimoDiaSistema.current !== hoy) {
        ultimoDiaSistema.current = hoy;
        setDiaEstadistica(hoy);
        setMesEstadistica(hoy.slice(0, 7));
      }
    };

    // Verificar cada minuto
    const intervalo = setInterval(verificarCambioDia, 60000);
    
    // También verificar cuando la ventana recupera el foco (útil para cuando vuelves al PC)
    const handleFocus = () => verificarCambioDia();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const [modalHistorial, setModalHistorial] = useState({ 
    visible: false, 
    facturaId: null as number | null, 
    historial: [] as HistorialAbono[], 
    cliente: '' 
  });

  // Modal para ver estado de cuenta detallado
  const [modalEstadoCuenta, setModalEstadoCuenta] = useState<{
    visible: boolean;
    nombre: string;
    facturas: Factura[];
  }>({ visible: false, nombre: '', facturas: [] });

  // Modal para ver desglose de ganancias del día
  const [modalDesgloseGanancia, setModalDesgloseGanancia] = useState<{
    visible: boolean;
    fecha: string;
    detalles: DetalleGanancia[];
    total: number;
  }>({ visible: false, fecha: '', detalles: [], total: 0 });

  // =============================================
  // NORMALIZACIÓN DE HISTORIAL DE ABONOS
  // =============================================
  // Esta función asegura que todas las facturas con abono tengan historialAbonos
  // Si una factura tiene abono > 0 pero historialAbonos vacío, crea un abono migrado
  const getHistorialNormalizado = useCallback((f: Factura): HistorialAbono[] => {
    // Si ya tiene historial, usarlo
    if (f.historialAbonos && f.historialAbonos.length > 0) {
      return f.historialAbonos;
    }
    
    // Si tiene abono pero no historial, crear uno migrado
    if (f.abono && f.abono > 0) {
      // Determinar la mejor fecha disponible
      let fechaMigrada = f.fechaISO.split('T')[0]; // Default: fecha de creación
      
      // Si tiene fechaPagoReal, intentar parsearla
      if (f.fechaPagoReal) {
        const partes = f.fechaPagoReal.split(' ');
        if (partes.length >= 2) {
          const dia = partes[0].padStart(2, '0');
          const meses: Record<string, string> = { 
            'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06', 
            'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12' 
          };
          const mes = meses[partes[1].toLowerCase()];
          if (mes) {
            const año = f.fechaISO.split('-')[0];
            fechaMigrada = `${año}-${mes}-${dia}`;
          }
        }
      }
      
      return [{
        fecha: fechaMigrada,
        monto: f.abono,
        tipo: 'abono_parcial',
        migrated: true
      }];
    }
    
    return [];
  }, []);

  // Función helper para obtener la fecha ISO de un abono (para cálculos)
  const getFechaAbonoISO = useCallback((abono: HistorialAbono, factura: Factura): string => {
    // Si el abono ya tiene fecha en formato ISO (YYYY-MM-DD), usarla
    if (abono.fecha && abono.fecha.match(/^\d{4}-\d{2}-\d{2}/)) {
      return abono.fecha;
    }
    // Fallback a fecha de la factura
    return factura.fechaISO.split('T')[0];
  }, []);

  // =============================================
  // EFECTOS (optimizados)
  // =============================================
  useEffect(() => {
    if (form.montoFactura && form.porcentajeCobro) {
      const montoStr = String(form.montoFactura).replace(/[^0-9]/g, '');
      const monto = parseFloat(montoStr);
      const porcent = parseFloat(String(form.porcentajeCobro));
      if (!isNaN(monto) && !isNaN(porcent)) {
        const calculo = Math.round(monto * (porcent / 100));
        setForm(prev => ({ ...prev, cobroCliente: String(calculo) }));
      }
    }
  }, [form.montoFactura, form.porcentajeCobro]);

  // =============================================
  // HELPERS LOCALES (memoizados)
  // =============================================

  // Toggle ocultar factura individual
  const toggleOcultarFactura = useCallback((id: number) => {
    setFacturasOcultas(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  }, []);

  // =============================================
  // MEMOS Y CÁLCULOS
  // =============================================
  const sugerenciasRevendedores = useMemo(() => {
    const counts: Record<string, number> = {};
    facturas.forEach(f => {
      const nombre = f.revendedor?.trim();
      if (nombre) counts[nombre] = (counts[nombre] || 0) + 1;
    });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [facturas]);

  const sugerenciasClientes = useMemo(() => {
    const counts: Record<string, number> = {};
    facturas.forEach(f => {
      const nombre = f.cliente?.trim();
      if (nombre) counts[nombre] = (counts[nombre] || 0) + 1;
    });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [facturas]);

  // Sugerencias de servicios basadas en uso histórico
  const sugerenciasServicios = useMemo(() => {
    const counts: Record<string, number> = {};
    facturas.forEach(f => {
      const servicio = f.empresa?.trim();
      if (servicio) counts[servicio] = (counts[servicio] || 0) + 1;
    });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [facturas]);

  const todosRevendedores = useMemo(() => {
    const nombres = new Set<string>();
    facturas.forEach(f => {
      if (f.revendedor && f.revendedor !== 'Directo' && f.revendedor !== 'Yo') {
        nombres.add(f.revendedor);
      }
    });
    return Array.from(nombres).sort();
  }, [facturas]);

  const revendedoresConDeuda = useMemo(() => {
    const resumen: Record<string, { nombre: string; deudaTotal: number; facturasPendientes: number }> = {};
    facturas.forEach(f => {
      if (!f.revendedor || f.revendedor === 'Directo' || f.revendedor === 'Yo') return;
      if (!resumen[f.revendedor]) resumen[f.revendedor] = { nombre: f.revendedor, deudaTotal: 0, facturasPendientes: 0 };
      
      const abonado = f.abono || 0;
      const saldo = f.cobroCliente - abonado;

      // Solo contar facturas que NO están ocultas
      if (f.pagadoAProveedor && !f.cobradoACliente && saldo > 0 && !facturasOcultas.includes(f.id)) {
        resumen[f.revendedor].deudaTotal += saldo;
        resumen[f.revendedor].facturasPendientes += 1;
      }
    });
    return Object.values(resumen).filter(r => r.deudaTotal > 0).sort((a, b) => b.deudaTotal - a.deudaTotal);
  }, [facturas, facturasOcultas]);

  const gananciaNetaMensual = useMemo(() => {
    let ganancia = 0;
    
    facturas.forEach(f => {
      // Obtener historial normalizado (incluye abonos migrados si no hay historial)
      const historial = getHistorialNormalizado(f);
      
      // Sumar abonos que se hicieron en este mes
      historial.forEach(abono => {
        const fechaAbono = getFechaAbonoISO(abono, f);
        if (fechaAbono.startsWith(mesEstadistica)) {
          ganancia += abono.monto;
        }
      });
      
      // Restar costos de garantía si se pagó al proveedor este mes
      if (f.pagadoAProveedor && f.fechaPagoReal) {
        const partes = f.fechaPagoReal.split(' ');
        if (partes.length >= 2) {
          const meses: Record<string, string> = { 'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12' };
          const mes = meses[partes[1].toLowerCase()] || '01';
          const año = mesEstadistica.split('-')[0];
          const fechaFormateada = `${año}-${mes}`;
          
          if (fechaFormateada === mesEstadistica && f.costoGarantia > 0) {
            ganancia -= f.costoGarantia;
          }
        }
      }
    });
    
    return ganancia;
  }, [facturas, mesEstadistica, getHistorialNormalizado, getFechaAbonoISO]);

  const gananciaDiaria = useMemo(() => {
    let ganancia = 0;
    
    facturas.forEach(f => {
      // Obtener historial normalizado
      const historial = getHistorialNormalizado(f);
      
      // Sumar abonos que se hicieron en este día
      historial.forEach(abono => {
        const fechaAbono = getFechaAbonoISO(abono, f);
        if (fechaAbono === diaEstadistica) {
          ganancia += abono.monto;
        }
      });
    });
    
    return ganancia;
  }, [facturas, diaEstadistica, getHistorialNormalizado, getFechaAbonoISO]);

  // Desglose detallado de ganancias del día
  const desgloseGananciaDiaria = useMemo(() => {
    const detalles: DetalleGanancia[] = [];
    
    facturas.forEach(f => {
      const historial = getHistorialNormalizado(f);
      
      historial.forEach(abono => {
        const fechaAbono = getFechaAbonoISO(abono, f);
        if (fechaAbono === diaEstadistica) {
          detalles.push({
            facturaId: f.id,
            cliente: f.cliente,
            empresa: f.empresa,
            revendedor: f.revendedor,
            monto: abono.monto,
            tipo: abono.tipo === 'pago_completo' ? 'pago_completo' : 'abono',
            fecha: fechaAbono
          });
        }
      });
    });
    
    // Ordenar por monto descendente
    return detalles.sort((a, b) => b.monto - a.monto);
  }, [facturas, diaEstadistica, getHistorialNormalizado, getFechaAbonoISO]);

  // Agrupar desglose por revendedor
  const desgloseGananciaPorRevendedor = useMemo(() => {
    const porRevendedor: Record<string, { total: number; detalles: DetalleGanancia[] }> = {};
    
    desgloseGananciaDiaria.forEach(detalle => {
      if (!porRevendedor[detalle.revendedor]) {
        porRevendedor[detalle.revendedor] = { total: 0, detalles: [] };
      }
      porRevendedor[detalle.revendedor].total += detalle.monto;
      porRevendedor[detalle.revendedor].detalles.push(detalle);
    });
    
    return Object.entries(porRevendedor)
      .map(([revendedor, data]) => ({ revendedor, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [desgloseGananciaDiaria]);

  const dineroPendienteCobro = useMemo(() => {
    return facturas
      .filter(f => f.pagadoAProveedor && !f.cobradoACliente)
      .filter(f => !revendedoresOcultos.includes(f.revendedor))
      .filter(f => !facturasOcultas.includes(f.id))
      .reduce((acc, f) => acc + (f.cobroCliente - (f.abono || 0)), 0);
  }, [facturas, revendedoresOcultos, facturasOcultas]);

  const facturasFiltradas = useMemo(() => {
    const busquedaLower = busqueda.toLowerCase();
    
    // Función de ordenamiento
    const aplicarOrdenamiento = (a: Factura, b: Factura): number => {
      switch (ordenFacturas) {
        case 'reciente':
          return b.id - a.id; // Más reciente primero
        case 'antiguo':
          return a.id - b.id; // Más antiguo primero
        case 'servicio':
          return a.empresa.localeCompare(b.empresa); // Alfabético por servicio
        case 'revendedor':
          return a.revendedor.localeCompare(b.revendedor); // Alfabético por revendedor
        case 'monto':
          return b.montoFactura - a.montoFactura; // Mayor monto primero
        default:
          return b.id - a.id;
      }
    };
    
    let resultado = facturas.filter(f => {
      // Filtrar ocultas si no se quieren mostrar
      if (!mostrarOcultas && facturasOcultas.includes(f.id)) return false;
      
      const matchBusqueda = 
        f.cliente.toLowerCase().includes(busquedaLower) || 
        f.empresa.toLowerCase().includes(busquedaLower) ||
        f.revendedor.toLowerCase().includes(busquedaLower);
      
      if (!matchBusqueda) return false;
      
      if (filtro === 'porPagar') return !f.pagadoAProveedor;
      if (filtro === 'porCobrar') return f.pagadoAProveedor && !f.cobradoACliente;
      if (filtro === 'finalizados') return f.cobradoACliente;
      if (filtro === 'garantias') return f.usoGarantia && !f.garantiaResuelta; // Solo garantías pendientes
      if (filtro === 'ocultas') return facturasOcultas.includes(f.id);
      
      return true;
    });

    // MEJORA #3: En "Por Pagar", priorizar facturas donde ya te pagaron (cobradoACliente = true)
    // para que no se te olvide pagar al proveedor
    if (filtro === 'porPagar') {
      resultado = resultado.sort((a, b) => {
        // Las que ya te pagaron van primero (prioridad alta)
        if (a.cobradoACliente && !b.cobradoACliente) return -1;
        if (!a.cobradoACliente && b.cobradoACliente) return 1;
        // Luego las que tienen abonos parciales del cliente
        const abonoA = a.abono || 0;
        const abonoB = b.abono || 0;
        if (abonoA > 0 && abonoB === 0) return -1;
        if (abonoA === 0 && abonoB > 0) return 1;
        // Aplicar ordenamiento secundario seleccionado
        return aplicarOrdenamiento(a, b);
      });
    } else {
      // Para otras vistas, aplicar ordenamiento seleccionado
      resultado = resultado.sort(aplicarOrdenamiento);
    }

    return resultado;
  }, [facturas, filtro, busqueda, facturasOcultas, mostrarOcultas, ordenFacturas]);

  const cantidadOcultas = useMemo(() => facturasOcultas.length, [facturasOcultas]);

  const porcentajeMeta = useMemo(() => 
    Math.min((gananciaNetaMensual / META_MENSUAL_NEGOCIO) * 100, 100)
  , [gananciaNetaMensual]);

  const estadisticasAvanzadas = useMemo(() => {
    const mesActual = mesEstadistica;
    const [year, month] = mesActual.split('-').map(Number);
    const mesAnterior = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;

    let gananciaActual = 0, gananciaAnterior = 0;
    const facturasActualSet = new Set<number>(); // Para contar facturas únicas
    const facturasAnteriorSet = new Set<number>();
    const diasConVentas = new Set<string>();
    let mejorDia = { fecha: '', ganancia: 0 };
    const gananciaPorDia: Record<string, number> = {};

    facturas.forEach(f => {
      // Obtener historial normalizado
      const historial = getHistorialNormalizado(f);
      
      // Contar ganancias basadas en fecha de cobro (abonos)
      historial.forEach(abono => {
        const fechaAbono = getFechaAbonoISO(abono, f);
        
        if (fechaAbono.startsWith(mesActual)) {
          gananciaActual += abono.monto;
          facturasActualSet.add(f.id); // Contar factura única
          diasConVentas.add(fechaAbono);
          gananciaPorDia[fechaAbono] = (gananciaPorDia[fechaAbono] || 0) + abono.monto;
        }
        
        if (fechaAbono.startsWith(mesAnterior)) {
          gananciaAnterior += abono.monto;
          facturasAnteriorSet.add(f.id); // Contar factura única
        }
      });
    });

    const facturasActual = facturasActualSet.size;
    const facturasAnterior = facturasAnteriorSet.size;

    Object.entries(gananciaPorDia).forEach(([fecha, ganancia]) => {
      if (ganancia > mejorDia.ganancia) mejorDia = { fecha, ganancia };
    });

    const crecimiento = gananciaAnterior > 0 ? ((gananciaActual - gananciaAnterior) / gananciaAnterior) * 100 : 0;
    const promedioDiario = diasConVentas.size > 0 ? gananciaActual / diasConVentas.size : 0;
    const promedioFactura = facturasActual > 0 ? gananciaActual / facturasActual : 0;
    const diasDelMes = new Date(year, month, 0).getDate();
    const proyeccion = promedioDiario * diasDelMes;

    return { gananciaActual, gananciaAnterior, crecimiento, facturasActual, facturasAnterior, diasConVentas: diasConVentas.size, promedioDiario, promedioFactura, mejorDia, proyeccion };
  }, [facturas, mesEstadistica, getHistorialNormalizado, getFechaAbonoISO]);

  const datosGrafica = useMemo(() => {
    const datosPorEmpresa: Record<string, { valor: number; facturas: Set<number> }> = {};
    let totalMes = 0;

    facturas.forEach(f => {
      // Obtener historial normalizado
      const historial = getHistorialNormalizado(f);
      
      // Contar ganancias basadas en fecha de cobro
      historial.forEach(abono => {
        const fechaAbono = getFechaAbonoISO(abono, f);
        if (fechaAbono.startsWith(mesEstadistica)) {
          const empresa = f.empresa || 'Otros';
          if (!datosPorEmpresa[empresa]) datosPorEmpresa[empresa] = { valor: 0, facturas: new Set() };
          datosPorEmpresa[empresa].valor += abono.monto;
          datosPorEmpresa[empresa].facturas.add(f.id); // Contar factura única
          totalMes += abono.monto;
        }
      });
    });

    return Object.entries(datosPorEmpresa)
      .map(([empresa, data]) => ({
        empresa, valor: data.valor, facturas: data.facturas.size,
        porcentaje: totalMes > 0 ? (data.valor / totalMes) * 100 : 0,
        promedioFactura: data.facturas.size > 0 ? data.valor / data.facturas.size : 0
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [facturas, mesEstadistica, getHistorialNormalizado, getFechaAbonoISO]);

  // =============================================
  // HANDLERS (memoizados)
  // =============================================
  const handleMoneyInput = useCallback((e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    setForm(prev => ({ ...prev, [field]: rawValue }));
  }, []);

  const handleEditCobro = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    const monto = parseFloat(String(editValues.monto));
    const cobro = parseFloat(rawValue);
    if (!isNaN(monto) && !isNaN(cobro) && monto > 0) {
      const nuevoPorcentaje = (cobro * 100) / monto;
      setEditValues(prev => ({ ...prev, cobro: Number(rawValue), porcentaje: Number(nuevoPorcentaje.toFixed(1)) }));
    } else {
      setEditValues(prev => ({ ...prev, cobro: Number(rawValue) }));
    }
  }, [editValues.monto]);

  const handleEditPorcentaje = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditValues(prev => {
      const newState = { ...prev, porcentaje: Number(val) };
      const monto = parseFloat(String(prev.monto));
      const porc = parseFloat(val);
      if (!isNaN(monto) && !isNaN(porc)) {
        newState.cobro = Math.round(monto * (porc / 100));
      }
      return newState;
    });
  }, []);

  const handleEditMonto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    const nuevoMonto = parseFloat(rawValue) || 0;
    setEditValues(prev => {
      const nuevoCobro = Math.round(nuevoMonto * (prev.porcentaje / 100));
      return { ...prev, monto: nuevoMonto, cobro: nuevoCobro };
    });
  }, []);

  const agregarFactura = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente || !form.montoFactura || !form.empresa) return;

    const monto = parseFloat(String(form.montoFactura).replace(/[^0-9]/g, ''));
    const cobro = parseFloat(String(form.cobroCliente).replace(/[^0-9]/g, '')); 
    
    const item: Factura = {
      id: Date.now(),
      cliente: form.cliente,
      telefono: form.telefono,
      revendedor: form.revendedor || 'Directo',
      empresa: form.empresa,
      montoFactura: monto,
      porcentajeAplicado: form.porcentajeCobro,
      costoInicial: 0,
      costoGarantia: 0,
      cobroCliente: cobro,
      abono: 0,
      historialAbonos: [],
      fechaPromesa: null,
      pagadoAProveedor: false,
      cobradoACliente: false,
      usoGarantia: false,
      fechaISO: getColombiaISO(),
      fechaDisplay: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
      fechaPagoReal: null
    };

    setFacturas(prev => [item, ...prev]);
    setForm(prev => ({ ...prev, cliente: '', telefono: '', montoFactura: '', cobroCliente: '', empresa: '' }));
  }, [form, setFacturas]);

  const iniciarEdicion = useCallback((factura: Factura) => {
    setEditingId(factura.id);
    setEditValues({ porcentaje: factura.porcentajeAplicado, cobro: factura.cobroCliente, monto: factura.montoFactura });
  }, []);

  const guardarEdicion = useCallback(() => {
    setFacturas(prev => prev.map(f => {
      if (f.id === editingId) {
        return { ...f, montoFactura: editValues.monto, porcentajeAplicado: editValues.porcentaje, cobroCliente: editValues.cobro };
      }
      return f;
    }));
    setEditingId(null);
  }, [editingId, editValues, setFacturas]);

  const cancelarEdicion = useCallback(() => {
    setEditingId(null);
  }, []);

  // Abrir modal para reportar o resolver garantía
  const aplicarGarantia = useCallback((id: number) => {
    const factura = facturas.find(f => f.id === id);
    if (!factura) return;
    
    // Si ya tiene garantía activa y no está resuelta, abrir modal para resolver
    if (factura.usoGarantia && !factura.garantiaResuelta) {
      setFormGarantia({
        motivo: factura.motivoGarantia || '',
        costoDevolucion: (factura.costoGarantia || 0).toString(),
        fechaResolucion: getColombiaDateOnly()
      });
      setModalGarantia({ visible: true, factura, modo: 'resolver' });
      return;
    }
    
    // Si ya está resuelta, preguntar si quiere quitar todo
    if (factura.usoGarantia && factura.garantiaResuelta) {
      if (window.confirm('Esta garantía ya fue resuelta. ¿Quitar la garantía completamente?')) {
        setFacturas(prev => prev.map(f => {
          if (f.id === id) {
            return { 
              ...f, 
              usoGarantia: false, 
              costoGarantia: 0,
              fechaGarantia: null,
              garantiaResuelta: false,
              fechaResolucionGarantia: null,
              motivoGarantia: null
            };
          }
          return f;
        }));
      }
      return;
    }
    
    // Abrir modal para reportar garantía nueva
    setFormGarantia({
      motivo: '',
      costoDevolucion: '0',
      fechaResolucion: getColombiaDateOnly()
    });
    setModalGarantia({ visible: true, factura, modo: 'reportar' });
  }, [facturas, setFacturas]);

  // Guardar reporte de garantía
  const guardarReporteGarantia = useCallback(() => {
    if (!modalGarantia.factura) return;
    
    const montoDevuelto = parseInt(formGarantia.costoDevolucion.replace(/[^0-9]/g, '')) || 0;
    
    setFacturas(prev => prev.map(f => {
      if (f.id === modalGarantia.factura!.id) {
        return { 
          ...f, 
          usoGarantia: true, 
          costoGarantia: montoDevuelto,
          fechaGarantia: getColombiaDateOnly(),
          garantiaResuelta: false,
          fechaResolucionGarantia: null,
          motivoGarantia: formGarantia.motivo || null
        };
      }
      return f;
    }));
    
    setModalGarantia({ visible: false, factura: null, modo: 'reportar' });
  }, [modalGarantia.factura, formGarantia, setFacturas]);

  // Marcar garantía como resuelta
  const resolverGarantia = useCallback(() => {
    if (!modalGarantia.factura) return;
    
    setFacturas(prev => prev.map(f => {
      if (f.id === modalGarantia.factura!.id) {
        return { 
          ...f, 
          garantiaResuelta: true,
          fechaResolucionGarantia: formGarantia.fechaResolucion
        };
      }
      return f;
    }));
    
    setModalGarantia({ visible: false, factura: null, modo: 'reportar' });
  }, [modalGarantia.factura, formGarantia.fechaResolucion, setFacturas]);

  const eliminarFactura = useCallback((id: number) => {
    if (window.confirm('¿Borrar registro?')) {
      setFacturas(prev => prev.filter(f => f.id !== id));
      // También eliminar de ocultas si estaba
      setFacturasOcultas(prev => prev.filter(fId => fId !== id));
    }
  }, [setFacturas, setFacturasOcultas]);

  const togglePagoProveedor = useCallback((id: number) => {
    setFacturas(prev => prev.map(f => {
      if (f.id === id) {
        const nuevoEstado = !f.pagadoAProveedor;
        return { ...f, pagadoAProveedor: nuevoEstado, fechaPagoReal: nuevoEstado ? obtenerHoraColombiana() : null };
      }
      return f;
    }));
  }, [setFacturas]);

  // Iniciar abono al proveedor
  const iniciarAbonoProveedor = useCallback((factura: Factura) => {
    setModalAbonoProveedor({ visible: true, factura });
    setMontoAbonoProveedor('');
    setFechaAbonoProveedor(getColombiaDateOnly());
  }, []);

  // Guardar abono al proveedor
  const guardarAbonoProveedor = useCallback((tipo: 'total' | 'parcial') => {
    const factura = modalAbonoProveedor.factura;
    if (!factura) return;

    setFacturas(prev => prev.map(f => {
      if (f.id === factura.id) {
        const historialPrevio = f.historialAbonosProveedor || [];
        const abonoActual = f.abonoProveedor || 0;
        const fechaAbono = fechaAbonoProveedor || getColombiaDateOnly();

        if (tipo === 'total') {
          // Pagar todo lo que falta
          const saldoPendiente = f.montoFactura - abonoActual;
          const nuevoHistorial = [...historialPrevio, { monto: saldoPendiente, fecha: fechaAbono }];
          return { 
            ...f, 
            abonoProveedor: f.montoFactura,
            historialAbonosProveedor: nuevoHistorial,
            pagadoAProveedor: true, 
            fechaPagoReal: obtenerHoraColombiana() 
          };
        } else {
          // Abono parcial
          const montoAbono = parseFloat(montoAbonoProveedor.replace(/[^0-9]/g, '')) || 0;
          if (montoAbono <= 0) return f;
          
          const nuevoTotalAbonado = abonoActual + montoAbono;
          const nuevoHistorial = [...historialPrevio, { monto: montoAbono, fecha: fechaAbono }];
          const estaPagadoCompleto = nuevoTotalAbonado >= f.montoFactura;
          
          return { 
            ...f, 
            abonoProveedor: nuevoTotalAbonado,
            historialAbonosProveedor: nuevoHistorial,
            pagadoAProveedor: estaPagadoCompleto,
            fechaPagoReal: estaPagadoCompleto ? obtenerHoraColombiana() : f.fechaPagoReal
          };
        }
      }
      return f;
    }));
    
    setModalAbonoProveedor({ visible: false, factura: null });
  }, [modalAbonoProveedor.factura, montoAbonoProveedor, fechaAbonoProveedor, setFacturas]);

  const iniciarCobro = useCallback((factura: Factura) => {
    if (factura.cobradoACliente) {
      if (window.confirm("¿Marcar como NO cobrado?")) {
        setFacturas(prev => prev.map(f => f.id === factura.id ? { ...f, cobradoACliente: false, abono: 0, historialAbonos: [], fechaPromesa: null } : f));
      }
    } else {
      setModalAbono({ visible: true, id: factura.id, saldoPendiente: factura.cobroCliente - (factura.abono || 0), total: factura.cobroCliente });
      setDatosAbono({ monto: '', fechaPromesa: '', fechaAbono: getColombiaDateOnly() });
    }
  }, [setFacturas]);

  const guardarCobro = useCallback((tipo: 'total' | 'parcial') => {
    setFacturas(prev => prev.map(f => {
      if (f.id === modalAbono.id) {
        const historial = [...(f.historialAbonos || [])];
        const fechaAbono = datosAbono.fechaAbono || getColombiaDateOnly();
        
        if (tipo === 'total') {
          const saldoPendiente = f.cobroCliente - (f.abono || 0);
          historial.push({ monto: saldoPendiente, fecha: fechaAbono, tipo: 'pago_completo' });
          return { ...f, cobradoACliente: true, abono: f.cobroCliente, fechaPromesa: null, historialAbonos: historial };
        } else {
          const abonoNuevo = parseFloat(datosAbono.monto.replace(/[^0-9]/g, '')) || 0;
          historial.push({ monto: abonoNuevo, fecha: fechaAbono, tipo: 'abono_parcial' });
          const totalAbonado = (f.abono || 0) + abonoNuevo;
          const esTotal = totalAbonado >= f.cobroCliente;
          return { ...f, abono: totalAbonado, cobradoACliente: esTotal, fechaPromesa: esTotal ? null : datosAbono.fechaPromesa, historialAbonos: historial };
        }
      }
      return f;
    }));
    setModalAbono({ visible: false, id: null, saldoPendiente: 0, total: 0 });
  }, [modalAbono.id, datosAbono, setFacturas]);

  const toggleVisibilidadRevendedor = useCallback((nombre: string) => {
    if (revendedoresOcultos.includes(nombre)) {
      setRevendedoresOcultos(prev => prev.filter(r => r !== nombre));
    } else {
      setRevendedoresOcultos(prev => [...prev, nombre]);
    }
  }, [revendedoresOcultos, setRevendedoresOcultos]);

  const abrirHistorialAbonos = useCallback((factura: Factura) => {
    setModalHistorial({ visible: true, facturaId: factura.id, historial: factura.historialAbonos || [], cliente: factura.cliente });
  }, []);

  const eliminarAbono = useCallback((indexAbono: number) => {
    if (!window.confirm('¿Eliminar este abono?')) return;
    
    setFacturas(prev => prev.map(f => {
      if (f.id === modalHistorial.facturaId) {
        const nuevoHistorial = [...(f.historialAbonos || [])];
        nuevoHistorial.splice(indexAbono, 1);
        const nuevoTotalAbono = nuevoHistorial.reduce((acc, a) => acc + a.monto, 0);
        const estaPagado = nuevoTotalAbono >= f.cobroCliente;
        return { ...f, historialAbonos: nuevoHistorial, abono: nuevoTotalAbono, cobradoACliente: estaPagado };
      }
      return f;
    }));

    setModalHistorial(prev => {
      const nuevoHistorial = [...prev.historial];
      nuevoHistorial.splice(indexAbono, 1);
      return { ...prev, historial: nuevoHistorial };
    });
  }, [modalHistorial.facturaId, setFacturas]);

  // FIX #3: Solo abrir modal de pago (no cerrar revendedores)
  const iniciarPagoRevendedor = useCallback((nombre: string, deuda: number) => {
    setModalRevendedor({ visible: true, nombre, deudaTotal: deuda });
    setMontoAbonoRevendedor('');
    setFechaAbonoRevendedor(getColombiaDateOnly());
  }, []);

  const aplicarPagoRevendedor = useCallback(() => {
    const monto = parseFloat(montoAbonoRevendedor.replace(/[^0-9]/g, '')) || 0;
    if (monto <= 0) return;

    const fechaAbono = fechaAbonoRevendedor || getColombiaDateOnly();
    let remanente = monto;
    const distribucion: DistribucionPago[] = [];
    
    setFacturas(prev => {
      const nuevasFacturas = prev.map(f => ({ ...f }));
      const facturasPendientesIndices = nuevasFacturas
        .map((f, index) => ({ ...f, originalIndex: index }))
        .filter(f => f.revendedor === modalRevendedor.nombre && f.pagadoAProveedor && !f.cobradoACliente)
        .sort((a, b) => a.id - b.id);

      for (const fTemp of facturasPendientesIndices) {
        if (remanente <= 0) break;

        const f = nuevasFacturas[fTemp.originalIndex];
        const saldoAnterior = f.cobroCliente - (f.abono || 0);
        
        if (!f.historialAbonos) f.historialAbonos = [];
        
        if (remanente >= saldoAnterior) {
          f.historialAbonos.push({ monto: saldoAnterior, fecha: fechaAbono, tipo: 'pago_completo' });
          f.abono = f.cobroCliente;
          f.cobradoACliente = true;
          f.fechaPromesa = null;
          
          distribucion.push({
            facturaId: f.id,
            cliente: f.cliente,
            empresa: f.empresa,
            montoAplicado: saldoAnterior,
            saldoAnterior: saldoAnterior,
            saldoNuevo: 0,
            completada: true
          });
          
          remanente -= saldoAnterior;
        } else {
          f.historialAbonos.push({ monto: remanente, fecha: fechaAbono, tipo: 'abono_parcial' });
          const saldoNuevo = saldoAnterior - remanente;
          f.abono = (f.abono || 0) + remanente;
          f.cobradoACliente = false;
          
          distribucion.push({
            facturaId: f.id,
            cliente: f.cliente,
            empresa: f.empresa,
            montoAplicado: remanente,
            saldoAnterior: saldoAnterior,
            saldoNuevo: saldoNuevo,
            completada: false
          });
          
          remanente = 0;
        }
      }
      return nuevasFacturas;
    });
    
    // Guardar registro del pago
    const nuevoPago: PagoRevendedor = {
      id: Date.now(),
      revendedor: modalRevendedor.nombre,
      montoTotal: monto,
      fecha: fechaAbono,
      fechaRegistro: getColombiaISO(),
      distribucion: distribucion
    };
    
    setPagosRevendedores(prev => [nuevoPago, ...prev]);
    
    setModalRevendedor({ visible: false, nombre: '', deudaTotal: 0 });
  }, [montoAbonoRevendedor, fechaAbonoRevendedor, modalRevendedor.nombre, setFacturas, setPagosRevendedores]);

  const enviarRecordatorio = useCallback((f: Factura) => {
    const saldo = f.cobroCliente - (f.abono || 0);
    const mensaje = `Hola ${f.cliente}, te escribo de Seya Shop para recordarte el saldo pendiente de ${formatearDinero(saldo)} por el servicio de ${f.empresa}. Quedo atento/a, gracias!`;
    const url = f.telefono ? `https://wa.me/57${f.telefono}?text=${encodeURIComponent(mensaje)}` : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }, []);

  // =============================================
  // FUNCIÓN MEJORADA: DESCARGAR ESTADO DE CUENTA
  // =============================================
  const descargarEstadoCuenta = useCallback((nombreRevendedor: string, incluirOcultas: boolean = false) => {
    const facturasRev = facturas.filter(f => f.revendedor === nombreRevendedor);
    
    // Clasificar facturas
    const facturasPorPagar: Factura[] = [];
    const facturasPorCobrar: Factura[] = [];
    const facturasCompletadas: Factura[] = [];
    const facturasOcultasList: Factura[] = [];
    
    let totalVendido = 0;
    let totalComisiones = 0;
    let deudaPendiente = 0;
    let pendientePagarProveedor = 0;
    let totalCobrado = 0;

    facturasRev.forEach(f => {
      const isOculta = facturasOcultas.includes(f.id);
      
      if (isOculta) {
        facturasOcultasList.push(f);
        if (!incluirOcultas) return;
      }
      
      totalVendido += f.montoFactura;
      totalComisiones += f.cobroCliente;
      
      if (f.cobradoACliente) {
        facturasCompletadas.push(f);
        totalCobrado += f.cobroCliente;
      } else if (f.pagadoAProveedor) {
        const saldo = f.cobroCliente - (f.abono || 0);
        if (!isOculta) {
          deudaPendiente += saldo;
        }
        facturasPorCobrar.push(f);
      } else {
        facturasPorPagar.push(f);
        pendientePagarProveedor += f.montoFactura;
      }
    });

    const fechaGeneracion = getColombiaDateDisplay();
    const horaGeneracion = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estado de Cuenta - ${nombreRevendedor}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: linear-gradient(135deg, #0a0d14 0%, #111827 50%, #0f1219 100%);
      color: #e5e7eb;
      min-height: 100vh;
      padding: 24px;
      line-height: 1.5;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    
    .header {
      background: linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #4f46e5 100%);
      border-radius: 20px;
      padding: 32px;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 300px;
      height: 300px;
      background: rgba(255,255,255,0.1);
      border-radius: 50%;
    }
    
    .header-content {
      position: relative;
      z-index: 1;
    }
    
    .logo {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 3px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    
    .title {
      font-size: 32px;
      font-weight: 800;
      margin-bottom: 4px;
    }
    
    .subtitle {
      font-size: 18px;
      opacity: 0.9;
    }
    
    .date-info {
      margin-top: 16px;
      font-size: 13px;
      opacity: 0.8;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .stat-card {
      background: linear-gradient(135deg, #1a1f33 0%, #151929 100%);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--accent);
    }
    
    .stat-card.purple { --accent: linear-gradient(90deg, #a855f7, #6366f1); }
    .stat-card.green { --accent: linear-gradient(90deg, #10b981, #14b8a6); }
    .stat-card.orange { --accent: linear-gradient(90deg, #f97316, #fb923c); }
    .stat-card.blue { --accent: linear-gradient(90deg, #3b82f6, #06b6d4); }
    .stat-card.red { --accent: linear-gradient(90deg, #ef4444, #f87171); }
    
    .stat-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    
    .stat-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px;
      font-weight: 700;
      color: #fff;
    }
    
    .stat-value.green { color: #34d399; }
    .stat-value.orange { color: #fb923c; }
    .stat-value.blue { color: #60a5fa; }
    .stat-value.red { color: #f87171; }
    
    .section {
      background: linear-gradient(135deg, #1a1f33 0%, #151929 100%);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    
    .section-header {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .section-title .icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    
    .icon.orange { background: rgba(249, 115, 22, 0.2); }
    .icon.green { background: rgba(16, 185, 129, 0.2); }
    .icon.gray { background: rgba(107, 114, 128, 0.2); }
    .icon.purple { background: rgba(139, 92, 246, 0.2); }
    
    .section-badge {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 20px;
      background: rgba(255,255,255,0.1);
    }
    
    .section-badge.orange { background: rgba(249, 115, 22, 0.2); color: #fb923c; }
    .section-badge.green { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .section-badge.gray { background: rgba(107, 114, 128, 0.2); color: #9ca3af; }
    
    .section-body {
      padding: 0;
    }
    
    .factura-item {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    
    .factura-item:last-child {
      border-bottom: none;
    }
    
    .factura-item.oculta {
      opacity: 0.5;
      background: rgba(107, 114, 128, 0.1);
    }
    
    .factura-info {
      flex: 1;
      min-width: 0;
    }
    
    .factura-cliente {
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .factura-empresa {
      font-size: 12px;
      color: #9ca3af;
      background: rgba(255,255,255,0.06);
      padding: 2px 8px;
      border-radius: 6px;
      display: inline-block;
    }
    
    .factura-meta {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
    
    .factura-monto {
      text-align: right;
      flex-shrink: 0;
    }
    
    .factura-valor {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 700;
    }
    
    .factura-valor.pendiente { color: #fb923c; }
    .factura-valor.cobrado { color: #34d399; }
    .factura-valor.porpagar { color: #60a5fa; }
    
    .factura-saldo {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }
    
    .abono-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      margin-left: 8px;
    }
    
    .progress-bar {
      height: 4px;
      background: #374151;
      border-radius: 2px;
      margin-top: 6px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #06b6d4);
      border-radius: 2px;
    }
    
    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: #6b7280;
    }
    
    .empty-state .emoji {
      font-size: 32px;
      margin-bottom: 12px;
    }
    
    .footer {
      text-align: center;
      padding: 24px;
      color: #6b7280;
      font-size: 12px;
    }
    
    .footer-logo {
      font-weight: 700;
      color: #a855f7;
      margin-bottom: 4px;
    }
    
    .oculta-tag {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(107, 114, 128, 0.3);
      color: #9ca3af;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    @media print {
      body { background: #fff; color: #111; padding: 0; }
      .header { background: #7c3aed !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .stat-card, .section { border-color: #e5e7eb; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-content">
        <div class="logo">✦ Seya Shop</div>
        <h1 class="title">Estado de Cuenta</h1>
        <p class="subtitle">${nombreRevendedor}</p>
        <p class="date-info">📅 Generado: ${fechaGeneracion} a las ${horaGeneracion}</p>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card purple">
        <div class="stat-label">Total Facturado</div>
        <div class="stat-value">${formatearDinero(totalVendido)}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Total Comisiones</div>
        <div class="stat-value green">${formatearDinero(totalComisiones)}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Deuda Pendiente</div>
        <div class="stat-value orange">${formatearDinero(deudaPendiente)}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Ya Cobrado</div>
        <div class="stat-value blue">${formatearDinero(totalCobrado)}</div>
      </div>
    </div>
    
    ${facturasPorCobrar.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="icon orange">⏳</span>
          Facturas Por Cobrar
        </div>
        <span class="section-badge orange">${facturasPorCobrar.filter(f => !facturasOcultas.includes(f.id)).length} pendientes</span>
      </div>
      <div class="section-body">
        ${facturasPorCobrar.map(f => {
          const saldo = f.cobroCliente - (f.abono || 0);
          const progreso = f.abono > 0 ? (f.abono / f.cobroCliente) * 100 : 0;
          const isOculta = facturasOcultas.includes(f.id);
          return `
          <div class="factura-item ${isOculta ? 'oculta' : ''}">
            <div class="factura-info">
              <div class="factura-cliente">
                ${f.cliente}
                <span class="factura-empresa">${f.empresa}</span>
                ${isOculta ? '<span class="oculta-tag">Oculta</span>' : ''}
                ${f.abono > 0 ? `<span class="abono-badge">Abonado: ${formatearDinero(f.abono)}</span>` : ''}
              </div>
              <div class="factura-meta">
                📆 ${f.fechaDisplay} • Factura: ${formatearDinero(f.montoFactura)}
                ${f.fechaPromesa ? ` • 🗓️ Promesa: ${f.fechaPromesa.slice(8,10)}/${f.fechaPromesa.slice(5,7)}` : ''}
              </div>
              ${progreso > 0 ? `
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progreso}%"></div>
              </div>
              ` : ''}
            </div>
            <div class="factura-monto">
              <div class="factura-valor pendiente">${formatearDinero(saldo)}</div>
              ${f.abono > 0 ? `<div class="factura-saldo">de ${formatearDinero(f.cobroCliente)}</div>` : ''}
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}
    
    ${facturasPorPagar.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="icon purple">📋</span>
          Pendientes de Pagar al Proveedor
        </div>
        <span class="section-badge gray">${facturasPorPagar.length} facturas</span>
      </div>
      <div class="section-body">
        ${facturasPorPagar.map(f => `
          <div class="factura-item">
            <div class="factura-info">
              <div class="factura-cliente">
                ${f.cliente}
                <span class="factura-empresa">${f.empresa}</span>
              </div>
              <div class="factura-meta">📆 ${f.fechaDisplay}</div>
            </div>
            <div class="factura-monto">
              <div class="factura-valor porpagar">${formatearDinero(f.montoFactura)}</div>
              <div class="factura-saldo">Cobro: ${formatearDinero(f.cobroCliente)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    ${facturasCompletadas.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="icon green">✓</span>
          Facturas Completadas
        </div>
        <span class="section-badge green">${facturasCompletadas.length} cobradas</span>
      </div>
      <div class="section-body">
        ${facturasCompletadas.slice(0, 10).map(f => `
          <div class="factura-item">
            <div class="factura-info">
              <div class="factura-cliente">
                ${f.cliente}
                <span class="factura-empresa">${f.empresa}</span>
              </div>
              <div class="factura-meta">📆 ${f.fechaDisplay} ${f.fechaPagoReal ? `• ✓ Pagado ${f.fechaPagoReal}` : ''}</div>
            </div>
            <div class="factura-monto">
              <div class="factura-valor cobrado">${formatearDinero(f.cobroCliente)}</div>
            </div>
          </div>
        `).join('')}
        ${facturasCompletadas.length > 10 ? `
          <div class="empty-state">
            <p>... y ${facturasCompletadas.length - 10} facturas más</p>
          </div>
        ` : ''}
      </div>
    </div>
    ` : ''}
    
    ${facturasOcultasList.length > 0 && incluirOcultas ? `
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="icon gray">👁️</span>
          Facturas Ocultas
        </div>
        <span class="section-badge gray">${facturasOcultasList.length} ocultas</span>
      </div>
      <div class="section-body">
        ${facturasOcultasList.map(f => {
          const saldo = f.cobroCliente - (f.abono || 0);
          return `
          <div class="factura-item oculta">
            <div class="factura-info">
              <div class="factura-cliente">
                ${f.cliente}
                <span class="factura-empresa">${f.empresa}</span>
              </div>
              <div class="factura-meta">📆 ${f.fechaDisplay} • ${f.cobradoACliente ? '✓ Cobrado' : f.pagadoAProveedor ? '⏳ Por cobrar' : '📋 Por pagar'}</div>
            </div>
            <div class="factura-monto">
              <div class="factura-valor" style="color: #6b7280">${formatearDinero(f.cobradoACliente ? f.cobroCliente : saldo)}</div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}
    
    <div class="footer">
      <div class="footer-logo">✦ Seya Shop</div>
      <p>Sistema de Gestión de Facturas</p>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Estado_${nombreRevendedor.replace(/\s+/g, '_')}_${getColombiaDateOnly()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [facturas, facturasOcultas]);

  // Abrir modal de estado de cuenta detallado
  const abrirEstadoCuenta = useCallback((nombreRevendedor: string) => {
    const facturasRev = facturas.filter(f => f.revendedor === nombreRevendedor);
    setModalEstadoCuenta({ visible: true, nombre: nombreRevendedor, facturas: facturasRev });
  }, [facturas]);

  const enviarResumenWhatsApp = useCallback((nombreRevendedor: string) => {
    const facturasRev = facturas.filter(f => f.revendedor === nombreRevendedor);
    
    let deudaPendiente = 0;
    const pendientes: string[] = [];

    facturasRev.forEach(f => {
      if (f.pagadoAProveedor && !f.cobradoACliente && !facturasOcultas.includes(f.id)) {
        const saldo = f.cobroCliente - (f.abono || 0);
        deudaPendiente += saldo;
        const fechaPago = f.fechaPagoReal ? f.fechaPagoReal.split(' ')[0] : f.fechaDisplay;
        pendientes.push(`${f.cliente} - ${f.empresa}\n   Factura: ${formatearDinero(f.montoFactura)} | Debes: ${formatearDinero(saldo)} | Fecha: ${fechaPago}`);
      }
    });

    let mensaje = `ESTADO DE CUENTA - SEYA SHOP\n${nombreRevendedor}\n${getColombiaDateDisplay()}\n\n`;
    mensaje += `TOTAL PENDIENTE: ${formatearDinero(deudaPendiente)}\n\n`;
    
    if (pendientes.length > 0) {
      mensaje += `DETALLE:\n\n${pendientes.join('\n\n')}`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  }, [facturas, facturasOcultas]);

  const closeModalHistorial = useCallback(() => {
    setModalHistorial({ visible: false, facturaId: null, historial: [], cliente: '' });
  }, []);

  const closeModalAbono = useCallback(() => {
    setModalAbono({ visible: false, id: null, saldoPendiente: 0, total: 0 });
  }, []);

  const closeModalRevendedor = useCallback(() => {
    setModalRevendedor({ visible: false, nombre: '', deudaTotal: 0 });
  }, []);

  const abrirHistorialPagos = useCallback((nombre: string) => {
    setModalHistorialPagos({ visible: true, nombre });
  }, []);

  const copiarLinkPortal = useCallback((nombre: string) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/v/${encodeURIComponent(nombre.toLowerCase())}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Link copiado:\n${url}`);
    }).catch(() => {
      prompt('Copia este link:', url);
    });
  }, []);

  const eliminarPagoRevendedor = useCallback((pagoId: number) => {
    if (window.confirm('¿Eliminar este registro de pago? (Las facturas no se modificarán)')) {
      setPagosRevendedores(prev => prev.filter(p => p.id !== pagoId));
    }
  }, [setPagosRevendedores]);

  // Pagos filtrados del revendedor actual
  const pagosDelRevendedor = useMemo(() => {
    if (!modalHistorialPagos.nombre) return [];
    return pagosRevendedores
      .filter(p => p.revendedor === modalHistorialPagos.nombre)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pagosRevendedores, modalHistorialPagos.nombre]);

  const closeModalEstadoCuenta = useCallback(() => {
    setModalEstadoCuenta({ visible: false, nombre: '', facturas: [] });
  }, []);

  // Abrir modal de desglose de ganancias
  const abrirDesgloseGanancia = useCallback(() => {
    setModalDesgloseGanancia({
      visible: true,
      fecha: diaEstadistica,
      detalles: desgloseGananciaDiaria,
      total: gananciaDiaria
    });
  }, [diaEstadistica, desgloseGananciaDiaria, gananciaDiaria]);

  const closeModalDesgloseGanancia = useCallback(() => {
    setModalDesgloseGanancia({ visible: false, fecha: '', detalles: [], total: 0 });
  }, []);

  // =============================================
  // RENDER
  // =============================================
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#060810] relative">
        <StaticBackground />

        {/* Modal Historial */}
        <AnimatePresence>
          {modalHistorial.visible && (
            <motion.div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="absolute inset-0 bg-black/70" onClick={closeModalHistorial} />
              <motion.div 
                className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-blue-500/20 shadow-2xl p-6"
                variants={modalVariants}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
                      <History size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Historial de Abonos</h3>
                      <p className="text-sm text-gray-400">{modalHistorial.cliente}</p>
                    </div>
                  </div>
                  <button onClick={closeModalHistorial} className="p-2 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                {modalHistorial.historial.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <History size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No hay abonos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                    {modalHistorial.historial.map((abono, index) => (
                      <div 
                        key={index} 
                        className="bg-[#0a0d14] p-4 rounded-xl border border-gray-700/30 flex items-center justify-between group hover:border-blue-500/30 transition-colors"
                      >
                        <div>
                          <p className="text-white font-mono font-bold text-lg">{formatearDinero(abono.monto)}</p>
                          <p className="text-xs text-gray-500">{abono.fecha} • {abono.tipo === 'pago_completo' ? '✓ Pago completo' : '◐ Abono parcial'}</p>
                        </div>
                        <button 
                          onClick={() => eliminarAbono(index)} 
                          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-gray-700/50">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total abonado:</span>
                    <span className="text-2xl text-white font-mono font-bold">
                      {formatearDinero(modalHistorial.historial.reduce((acc, a) => acc + a.monto, 0))}
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Estado de Cuenta Detallado */}
        <AnimatePresence>
          {modalEstadoCuenta.visible && (
            <motion.div 
              className="fixed inset-0 z-[150] flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="absolute inset-0 bg-black/80" onClick={closeModalEstadoCuenta} />
              <motion.div 
                className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-3xl rounded-2xl border border-purple-500/20 shadow-2xl max-h-[90vh] overflow-hidden"
                variants={modalVariants}
              >
                <div className="p-6 border-b border-gray-700/30 flex justify-between items-center sticky top-0 bg-[#1a1f33]/95 backdrop-blur-sm z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg">
                      {modalEstadoCuenta.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{modalEstadoCuenta.nombre}</h2>
                      <p className="text-gray-400 text-sm">Estado de cuenta detallado</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => descargarEstadoCuenta(modalEstadoCuenta.nombre, true)} 
                      className="p-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Download size={18} />
                      <span className="text-sm font-medium hidden sm:inline">Descargar</span>
                    </button>
                    <button onClick={closeModalEstadoCuenta} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                  {/* Resumen */}
                  {(() => {
                    const facturasRev = modalEstadoCuenta.facturas;
                    const porPagar = facturasRev.filter(f => !f.pagadoAProveedor);
                    const porCobrar = facturasRev.filter(f => f.pagadoAProveedor && !f.cobradoACliente && !facturasOcultas.includes(f.id));
                    const completadas = facturasRev.filter(f => f.cobradoACliente);
                    const ocultas = facturasRev.filter(f => facturasOcultas.includes(f.id));
                    
                    const deudaTotal = porCobrar.reduce((acc, f) => acc + (f.cobroCliente - (f.abono || 0)), 0);
                    const totalCobrado = completadas.reduce((acc, f) => acc + f.cobroCliente, 0);
                    
                    return (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Por Pagar</p>
                            <p className="text-xl text-blue-400 font-mono font-bold">{porPagar.length}</p>
                          </div>
                          <div className="bg-orange-900/20 rounded-xl p-4 border border-orange-500/20">
                            <p className="text-[10px] text-orange-400/80 uppercase font-bold">Por Cobrar</p>
                            <p className="text-xl text-orange-400 font-mono font-bold">{formatearDineroCorto(deudaTotal)}</p>
                          </div>
                          <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-500/20">
                            <p className="text-[10px] text-emerald-400/80 uppercase font-bold">Cobrado</p>
                            <p className="text-xl text-emerald-400 font-mono font-bold">{formatearDineroCorto(totalCobrado)}</p>
                          </div>
                          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Ocultas</p>
                            <p className="text-xl text-gray-400 font-mono font-bold">{ocultas.length}</p>
                          </div>
                        </div>
                        
                        {/* Por Cobrar */}
                        {porCobrar.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-orange-400 uppercase mb-3 flex items-center gap-2">
                              <AlertTriangle size={14} /> Facturas Por Cobrar ({porCobrar.length})
                            </h3>
                            <div className="space-y-2">
                              {porCobrar.map(f => {
                                const saldo = f.cobroCliente - (f.abono || 0);
                                return (
                                  <div key={f.id} className="bg-[#0a0d14] p-4 rounded-xl border border-orange-500/20 flex items-center justify-between">
                                    <div>
                                      <p className="text-white font-medium">{f.cliente}</p>
                                      <p className="text-xs text-gray-500">{f.empresa} • {f.fechaDisplay}</p>
                                      {f.abono > 0 && (
                                        <p className="text-[10px] text-blue-400 mt-1">Abonado: {formatearDinero(f.abono)}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <p className="text-orange-400 font-mono font-bold">{formatearDinero(saldo)}</p>
                                      <button 
                                        onClick={() => toggleOcultarFactura(f.id)}
                                        className="p-2 text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                                        title="Ocultar factura"
                                      >
                                        <EyeOff size={14} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Por Pagar al Proveedor */}
                        {porPagar.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-blue-400 uppercase mb-3 flex items-center gap-2">
                              <ClipboardList size={14} /> Pendientes de Pagar ({porPagar.length})
                            </h3>
                            <div className="space-y-2">
                              {porPagar.map(f => (
                                <div key={f.id} className="bg-[#0a0d14] p-4 rounded-xl border border-blue-500/20 flex items-center justify-between">
                                  <div>
                                    <p className="text-white font-medium">{f.cliente}</p>
                                    <p className="text-xs text-gray-500">{f.empresa} • {f.fechaDisplay}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-blue-400 font-mono font-bold">{formatearDinero(f.montoFactura)}</p>
                                    <p className="text-[10px] text-gray-500">Cobro: {formatearDinero(f.cobroCliente)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Completadas */}
                        {completadas.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-emerald-400 uppercase mb-3 flex items-center gap-2">
                              <Check size={14} /> Facturas Cobradas ({completadas.length})
                            </h3>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                              {completadas.slice(0, 10).map(f => (
                                <div key={f.id} className="bg-[#0a0d14] p-3 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                                  <div>
                                    <p className="text-white font-medium text-sm">{f.cliente}</p>
                                    <p className="text-xs text-gray-500">{f.empresa} • {f.fechaDisplay}</p>
                                  </div>
                                  <p className="text-emerald-400 font-mono font-bold">{formatearDinero(f.cobroCliente)}</p>
                                </div>
                              ))}
                              {completadas.length > 10 && (
                                <p className="text-center text-gray-500 text-sm py-2">... y {completadas.length - 10} más</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Ocultas */}
                        {ocultas.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                              <EyeOff size={14} /> Facturas Ocultas ({ocultas.length})
                            </h3>
                            <div className="space-y-2">
                              {ocultas.map(f => {
                                const saldo = f.cobroCliente - (f.abono || 0);
                                return (
                                  <div key={f.id} className="bg-[#0a0d14]/50 p-3 rounded-xl border border-gray-700/30 flex items-center justify-between opacity-60">
                                    <div>
                                      <p className="text-white font-medium text-sm">{f.cliente}</p>
                                      <p className="text-xs text-gray-500">
                                        {f.empresa} • {f.fechaDisplay} • 
                                        {f.cobradoACliente ? ' ✓ Cobrado' : f.pagadoAProveedor ? ' ⏳ Por cobrar' : ' 📋 Por pagar'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <p className="text-gray-400 font-mono">{formatearDinero(f.cobradoACliente ? f.cobroCliente : saldo)}</p>
                                      <button 
                                        onClick={() => toggleOcultarFactura(f.id)}
                                        className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                                        title="Mostrar factura"
                                      >
                                        <Eye size={14} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Estadísticas - Lazy render */}
        <AnimatePresence>
          {vistaEstadisticas && (
            <motion.div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="absolute inset-0 bg-black/80" onClick={() => setVistaEstadisticas(false)} />
              <motion.div 
                className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-4xl rounded-2xl border border-purple-500/20 shadow-2xl max-h-[95vh] overflow-hidden"
                variants={modalVariants}
              >
                <div className="p-6 border-b border-gray-700/30 flex justify-between items-center sticky top-0 bg-[#1a1f33]/95 backdrop-blur-sm z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl">
                      <BarChart3 size={28} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Centro de Análisis</h2>
                      <p className="text-gray-400 text-sm">Dashboard de rendimiento</p>
                    </div>
                  </div>
                  <button onClick={() => setVistaEstadisticas(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(95vh-100px)]">
                  <div className="flex items-center gap-4 justify-center">
                    <span className="text-gray-400 text-sm">Analizando:</span>
                    <input 
                      type="month" 
                      value={mesEstadistica} 
                      onChange={e => setMesEstadistica(e.target.value)} 
                      className="bg-[#0a0d14] border border-purple-500/30 rounded-xl px-4 py-2 text-white focus:border-purple-500 transition-colors"
                    />
                  </div>

                  {/* KPIs Grid - Static colors instead of dynamic */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-emerald-900/30 border border-emerald-500/20 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                          <CircleDollarSign size={18} className="text-emerald-400" />
                        </div>
                        <span className="text-emerald-400/80 text-xs font-bold uppercase">Ganancia</span>
                      </div>
                      <p className="text-2xl font-bold text-white font-mono">{formatearDineroCorto(estadisticasAvanzadas.gananciaActual)}</p>
                      <div className="flex items-center gap-1 mt-2">
                        {estadisticasAvanzadas.crecimiento >= 0 ? <ArrowUpRight size={14} className="text-emerald-400" /> : <ArrowDownRight size={14} className="text-red-400" />}
                        <span className={`text-xs ${estadisticasAvanzadas.crecimiento >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {Math.abs(estadisticasAvanzadas.crecimiento).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-blue-900/30 border border-blue-500/20 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-blue-500/20 rounded-lg">
                          <Layers size={18} className="text-blue-400" />
                        </div>
                        <span className="text-blue-400/80 text-xs font-bold uppercase">Facturas</span>
                      </div>
                      <p className="text-2xl font-bold text-white font-mono">{estadisticasAvanzadas.facturasActual}</p>
                    </div>
                    
                    <div className="bg-purple-900/30 border border-purple-500/20 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-purple-500/20 rounded-lg">
                          <Activity size={18} className="text-purple-400" />
                        </div>
                        <span className="text-purple-400/80 text-xs font-bold uppercase">Promedio</span>
                      </div>
                      <p className="text-2xl font-bold text-white font-mono">{formatearDineroCorto(estadisticasAvanzadas.promedioFactura)}</p>
                    </div>
                    
                    <div className="bg-orange-900/30 border border-orange-500/20 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-orange-500/20 rounded-lg">
                          <Flame size={18} className="text-orange-400" />
                        </div>
                        <span className="text-orange-400/80 text-xs font-bold uppercase">Diario</span>
                      </div>
                      <p className="text-2xl font-bold text-white font-mono">{formatearDineroCorto(estadisticasAvanzadas.promedioDiario)}</p>
                    </div>
                  </div>

                  {/* Meta Progress */}
                  <div className="bg-gradient-to-r from-[#1a1f33] via-purple-900/20 to-[#1a1f33] border border-purple-500/20 rounded-xl p-6">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                          <Target size={32} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">Meta Mensual</h3>
                          <p className="text-gray-400 text-sm">{formatearDinero(gananciaNetaMensual)} de {formatearDinero(META_MENSUAL_NEGOCIO)}</p>
                        </div>
                      </div>
                      <div className="flex-1 max-w-md w-full">
                        <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-emerald-400 transition-all duration-1000"
                            style={{ width: `${porcentajeMeta}%` }}
                          />
                        </div>
                        <p className="text-center mt-2 text-gray-400">{Math.round(porcentajeMeta)}% completado</p>
                      </div>
                    </div>
                  </div>

                  {/* Ranking */}
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Award className="text-purple-400" /> Ranking de Servicios
                    </h3>
                    {datosGrafica.length === 0 ? (
                      <div className="text-center py-16 bg-[#0a0d14]/50 rounded-xl border border-gray-800">
                        <Sparkles size={48} className="mx-auto mb-4 text-gray-700" />
                        <p className="text-gray-500">No hay datos este mes</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {datosGrafica.slice(0, 10).map((item, index) => {
                          const colorScheme = COLORES_RANKING[Math.min(index, COLORES_RANKING.length - 1)];
                          const isTop3 = index < 3;
                          
                          return (
                            <div 
                              key={index} 
                              className={`bg-[#0a0d14] rounded-xl p-4 border transition-colors ${isTop3 ? colorScheme.border : 'border-gray-800'}`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${isTop3 ? `${colorScheme.bg} text-white` : 'bg-gray-800 text-gray-400'}`}>
                                  {index === 0 ? <Crown size={20} /> : index + 1}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-bold text-white">{item.empresa}</h4>
                                  <p className="text-xs text-gray-500">{item.facturas} facturas</p>
                                </div>
                                <div className="text-right">
                                  <p className={`font-bold font-mono ${isTop3 ? colorScheme.text : 'text-white'}`}>{formatearDinero(item.valor)}</p>
                                  <p className="text-xs text-gray-500">{item.porcentaje.toFixed(1)}%</p>
                                </div>
                              </div>
                              <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${isTop3 ? colorScheme.bg : 'bg-gray-600'}`}
                                  style={{ width: `${item.porcentaje}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Cobro */}
        <AnimatePresence>
          {modalAbono.visible && (
            <motion.div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="absolute inset-0 bg-black/70" onClick={closeModalAbono} />
              <motion.div 
                className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-emerald-500/30 shadow-2xl p-6"
                variants={modalVariants}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
                    <Wallet size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Registrar Cobro</h3>
                    <p className="text-gray-400 text-sm">Saldo pendiente: <span className="text-orange-400 font-mono text-lg font-bold">{formatearDinero(modalAbono.saldoPendiente)}</span></p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <MagneticButton 
                    onClick={() => guardarCobro('total')} 
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg"
                  >
                    <Check size={22}/> Pago Total ({formatearDinero(modalAbono.saldoPendiente)})
                  </MagneticButton>
                  
                  <div className="relative flex items-center py-3">
                    <div className="flex-grow border-t border-gray-700"></div>
                    <span className="mx-4 text-gray-500 text-xs uppercase bg-[#151929] px-2">O abono parcial</span>
                    <div className="flex-grow border-t border-gray-700"></div>
                  </div>
                  
                  <div className="bg-[#0a0d14] p-5 rounded-xl border border-gray-700/30 space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-2 font-medium">Monto del abono</label>
                      <input 
                        type="tel" 
                        className="w-full bg-[#1a1f33] border border-gray-600 rounded-xl p-3.5 text-white font-mono text-lg focus:border-emerald-500/50 transition-colors outline-none" 
                        placeholder="$ 0" 
                        value={datosAbono.monto} 
                        onChange={(e) => setDatosAbono({...datosAbono, monto: e.target.value.replace(/[^0-9]/g, '')})} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-2 font-medium">Fecha abono</label>
                        <input 
                          type="date" 
                          className="w-full bg-[#1a1f33] border border-gray-600 rounded-xl p-3 text-white focus:border-emerald-500/50 transition-colors outline-none" 
                          value={datosAbono.fechaAbono} 
                          onChange={(e) => setDatosAbono({...datosAbono, fechaAbono: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-2 font-medium">Promesa</label>
                        <input 
                          type="date" 
                          className="w-full bg-[#1a1f33] border border-gray-600 rounded-xl p-3 text-white focus:border-emerald-500/50 transition-colors outline-none" 
                          value={datosAbono.fechaPromesa} 
                          onChange={(e) => setDatosAbono({...datosAbono, fechaPromesa: e.target.value})} 
                        />
                      </div>
                    </div>
                    <MagneticButton 
                      onClick={() => guardarCobro('parcial')} 
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-colors disabled:opacity-50" 
                      disabled={!datosAbono.monto}
                    >
                      Guardar Abono
                    </MagneticButton>
                  </div>
                </div>
                
                <button onClick={closeModalAbono} className="mt-5 w-full text-gray-500 text-sm hover:text-white transition-colors py-2">
                  Cancelar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Abono al Proveedor */}
        <AnimatePresence>
          {modalAbonoProveedor.visible && modalAbonoProveedor.factura && (
            <motion.div 
              className="fixed inset-0 z-[145] flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="absolute inset-0 bg-black/70" onClick={() => setModalAbonoProveedor({ visible: false, factura: null })} />
              <motion.div 
                className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-yellow-500/30 shadow-2xl p-6"
                variants={modalVariants}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl">
                    <DollarSign size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Pago al Proveedor</h3>
                    <p className="text-gray-400 text-sm">{modalAbonoProveedor.factura.cliente} - {modalAbonoProveedor.factura.empresa}</p>
                  </div>
                </div>
                
                {/* Resumen del pago */}
                <div className="bg-[#0a0d14] p-4 rounded-xl border border-gray-700/30 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm">Valor factura:</span>
                    <span className="text-white font-mono font-bold">{formatearDinero(modalAbonoProveedor.factura.montoFactura)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm">Ya abonado:</span>
                    <span className="text-yellow-400 font-mono font-bold">{formatearDinero(modalAbonoProveedor.factura.abonoProveedor || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
                    <span className="text-gray-300 text-sm font-medium">Por pagar:</span>
                    <span className="text-orange-400 font-mono font-bold text-lg">{formatearDinero(modalAbonoProveedor.factura.montoFactura - (modalAbonoProveedor.factura.abonoProveedor || 0))}</span>
                  </div>
                  
                  {/* Barra de progreso */}
                  {(modalAbonoProveedor.factura.abonoProveedor || 0) > 0 && (
                    <div className="mt-3">
                      <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500"
                          style={{ width: `${((modalAbonoProveedor.factura.abonoProveedor || 0) / modalAbonoProveedor.factura.montoFactura) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 text-center mt-1">
                        {Math.round(((modalAbonoProveedor.factura.abonoProveedor || 0) / modalAbonoProveedor.factura.montoFactura) * 100)}% pagado
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Botón pagar todo */}
                <MagneticButton 
                  onClick={() => guardarAbonoProveedor('total')} 
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors mb-4"
                >
                  <Check size={20} /> Pagar Todo ({formatearDinero(modalAbonoProveedor.factura.montoFactura - (modalAbonoProveedor.factura.abonoProveedor || 0))})
                </MagneticButton>
                
                {/* Sección de abono parcial */}
                <div className="bg-[#0a0d14] p-4 rounded-xl border border-blue-500/20 space-y-3">
                  <p className="text-blue-400 font-medium text-sm flex items-center gap-2">
                    <Wallet size={14} /> O registrar abono parcial
                  </p>
                  <div>
                    <label className="text-xs text-gray-400 block mb-2 font-medium">¿Cuánto abonaste?</label>
                    <input 
                      type="tel" 
                      className="w-full bg-[#1a1f33] border border-gray-600 rounded-xl p-4 text-white font-mono text-xl font-bold focus:border-blue-500/50 transition-colors outline-none text-center" 
                      placeholder="$ 0" 
                      value={montoAbonoProveedor} 
                      onChange={(e) => setMontoAbonoProveedor(e.target.value.replace(/[^0-9]/g, ''))} 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-2 font-medium">Fecha del abono</label>
                    <input 
                      type="date" 
                      className="w-full bg-[#1a1f33] border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500/50 transition-colors outline-none" 
                      value={fechaAbonoProveedor} 
                      onChange={(e) => setFechaAbonoProveedor(e.target.value)} 
                    />
                  </div>
                  <MagneticButton 
                    onClick={() => guardarAbonoProveedor('parcial')} 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50" 
                    disabled={!montoAbonoProveedor}
                  >
                    <DollarSign size={18} /> Guardar Abono
                  </MagneticButton>
                </div>
                
                <button onClick={() => setModalAbonoProveedor({ visible: false, factura: null })} className="mt-5 w-full text-gray-500 text-sm hover:text-white transition-colors py-2">
                  Cancelar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Garantía */}
        <AnimatePresence>
          {modalGarantia.visible && modalGarantia.factura && (
            <motion.div 
              className="fixed inset-0 z-[130] flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="absolute inset-0 bg-black/70" onClick={() => setModalGarantia({ visible: false, factura: null, modo: 'reportar' })} />
              <motion.div 
                className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-red-500/30 shadow-2xl p-6"
                variants={modalVariants}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className={`p-3 rounded-xl ${modalGarantia.modo === 'reportar' ? 'bg-gradient-to-br from-red-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                    {modalGarantia.modo === 'reportar' ? <ShieldAlert size={24} className="text-white" /> : <ShieldCheck size={24} className="text-white" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {modalGarantia.modo === 'reportar' ? 'Reportar Garantía' : 'Resolver Garantía'}
                    </h3>
                    <p className="text-gray-400 text-sm">{modalGarantia.factura.cliente} - {modalGarantia.factura.empresa}</p>
                  </div>
                </div>
                
                {modalGarantia.modo === 'reportar' ? (
                  <div className="bg-[#0a0d14] p-5 rounded-xl border border-gray-700/30 space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-2 font-medium">¿Cuál es el problema?</label>
                      <textarea 
                        className="w-full bg-[#1a1f33] border border-gray-600 rounded-xl p-3 text-white focus:border-red-500/50 transition-colors outline-none resize-none" 
                        placeholder="Describe el problema..."
                        rows={3}
                        value={formGarantia.motivo}
                        onChange={(e) => setFormGarantia(prev => ({ ...prev, motivo: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-2 font-medium">¿Devolviste dinero al cliente? (0 si no)</label>
                      <input 
                        type="tel" 
                        className="w-full bg-[#1a1f33] border border-gray-600 rounded-xl p-3 text-white font-mono focus:border-red-500/50 transition-colors outline-none" 
                        placeholder="$ 0" 
                        value={formGarantia.costoDevolucion} 
                        onChange={(e) => setFormGarantia(prev => ({ ...prev, costoDevolucion: e.target.value.replace(/[^0-9]/g, '') }))} 
                      />
                    </div>
                    <MagneticButton 
                      onClick={guardarReporteGarantia} 
                      className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <ShieldAlert size={18} /> Reportar Garantía
                    </MagneticButton>
                  </div>
                ) : (
                  <div className="bg-[#0a0d14] p-5 rounded-xl border border-gray-700/30 space-y-4">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                      <p className="text-xs text-red-400 font-medium mb-1">Problema reportado:</p>
                      <p className="text-white">{modalGarantia.factura.motivoGarantia || 'Sin descripción'}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Reportado el {modalGarantia.factura.fechaGarantia}
                        {modalGarantia.factura.costoGarantia ? ` • Devolución: ${formatearDinero(modalGarantia.factura.costoGarantia)}` : ''}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-2 font-medium">Fecha de resolución</label>
                      <input 
                        type="date" 
                        className="w-full bg-[#1a1f33] border border-gray-600 rounded-xl p-3 text-white focus:border-emerald-500/50 transition-colors outline-none" 
                        value={formGarantia.fechaResolucion} 
                        onChange={(e) => setFormGarantia(prev => ({ ...prev, fechaResolucion: e.target.value }))} 
                      />
                    </div>
                    <MagneticButton 
                      onClick={resolverGarantia} 
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <ShieldCheck size={18} /> Marcar como Resuelta
                    </MagneticButton>
                  </div>
                )}
                
                <button onClick={() => setModalGarantia({ visible: false, factura: null, modo: 'reportar' })} className="mt-5 w-full text-gray-500 text-sm hover:text-white transition-colors py-2">
                  Cancelar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Pago Revendedor - z-index más alto */}
        <AnimatePresence>
          {modalRevendedor.visible && (
            <motion.div 
              className="fixed inset-0 z-[150] flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="absolute inset-0 bg-black/70" onClick={closeModalRevendedor} />
              <motion.div 
                className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-purple-500/30 shadow-2xl p-6"
                variants={modalVariants}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                    <Users size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Pago de {modalRevendedor.nombre}</h3>
                    <p className="text-gray-400 text-sm">Deuda: <span className="text-orange-400 font-mono text-lg font-bold">{formatearDinero(modalRevendedor.deudaTotal)}</span></p>
                  </div>
                </div>
                
                <div className="bg-[#0a0d14] p-5 rounded-xl border border-gray-700/30 space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-2 font-medium">¿Cuánto pagó?</label>
                    <input 
                      type="tel" 
                      className="w-full bg-[#1a1f33] border border-gray-600 rounded-xl p-4 text-white font-mono text-2xl font-bold focus:border-emerald-500/50 transition-colors outline-none text-center" 
                      placeholder="$ 0" 
                      value={montoAbonoRevendedor} 
                      onChange={(e) => setMontoAbonoRevendedor(e.target.value.replace(/[^0-9]/g, ''))} 
                      autoFocus 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-2 font-medium">Fecha del pago</label>
                    <input 
                      type="date" 
                      className="w-full bg-[#1a1f33] border border-gray-600 rounded-xl p-3.5 text-white focus:border-emerald-500/50 transition-colors outline-none" 
                      value={fechaAbonoRevendedor} 
                      onChange={(e) => setFechaAbonoRevendedor(e.target.value)} 
                    />
                  </div>
                  <MagneticButton 
                    onClick={aplicarPagoRevendedor} 
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50" 
                    disabled={!montoAbonoRevendedor}
                  >
                    <Check size={20} /> Aplicar Pago
                  </MagneticButton>
                </div>
                
                <button onClick={closeModalRevendedor} className="mt-5 w-full text-gray-500 text-sm hover:text-white transition-colors py-2">
                  Cancelar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Historial de Pagos */}
        <AnimatePresence>
          {modalHistorialPagos.visible && (
            <motion.div 
              className="fixed inset-0 z-[160] flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="absolute inset-0 bg-black/80" onClick={() => setModalHistorialPagos({ visible: false, nombre: '' })} />
              <motion.div 
                className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-2xl rounded-2xl border border-amber-500/30 shadow-2xl max-h-[90vh] overflow-hidden"
                variants={modalVariants}
              >
                <div className="p-6 border-b border-gray-700/30 flex justify-between items-center sticky top-0 bg-[#1a1f33]/95 backdrop-blur-sm z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
                      <History size={22} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Historial de Pagos</h2>
                      <p className="text-amber-400 text-sm font-medium">{modalHistorialPagos.nombre}</p>
                    </div>
                  </div>
                  <button onClick={() => setModalHistorialPagos({ visible: false, nombre: '' })} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-100px)]">
                  {pagosDelRevendedor.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      <History size={56} className="mx-auto mb-4 opacity-30" />
                      <p>No hay pagos registrados para este revendedor.</p>
                      <p className="text-sm mt-2 text-gray-600">Los pagos futuros aparecerán aquí.</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-[#0a0d14] p-4 rounded-xl border border-gray-800 flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Total de pagos registrados:</span>
                        <span className="text-white font-bold text-lg">{pagosDelRevendedor.length}</span>
                      </div>
                      
                      <div className="space-y-4">
                        {pagosDelRevendedor.map((pago) => (
                          <motion.div 
                            key={pago.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#0a0d14] rounded-xl border border-gray-800 overflow-hidden"
                          >
                            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                                  <DollarSign size={18} className="text-emerald-400" />
                                </div>
                                <div>
                                  <p className="text-emerald-400 font-mono font-bold text-xl">{formatearDinero(pago.montoTotal)}</p>
                                  <p className="text-gray-500 text-xs flex items-center gap-1">
                                    <Calendar size={10} />
                                    {new Date(pago.fecha + 'T12:00:00').toLocaleDateString('es-CO', { 
                                      weekday: 'long', 
                                      day: 'numeric', 
                                      month: 'long', 
                                      year: 'numeric' 
                                    })}
                                  </p>
                                </div>
                              </div>
                              <button 
                                onClick={() => eliminarPagoRevendedor(pago.id)}
                                className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Eliminar registro"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            
                            {pago.distribucion && pago.distribucion.length > 0 && (
                              <div className="p-4 space-y-2">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-3">Distribución del pago:</p>
                                {pago.distribucion.map((dist, idx) => (
                                  <div 
                                    key={idx}
                                    className={`flex items-center justify-between p-3 rounded-lg ${dist.completada ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-gray-800/50 border border-gray-700/30'}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {dist.completada ? (
                                        <Check size={14} className="text-emerald-400" />
                                      ) : (
                                        <Clock size={14} className="text-orange-400" />
                                      )}
                                      <div>
                                        <p className="text-white text-sm font-medium">{dist.cliente}</p>
                                        <p className="text-gray-500 text-xs">{dist.empresa}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`font-mono font-bold ${dist.completada ? 'text-emerald-400' : 'text-orange-400'}`}>
                                        {formatearDinero(dist.montoAplicado)}
                                      </p>
                                      {!dist.completada && (
                                        <p className="text-xs text-gray-500">
                                          Queda: {formatearDinero(dist.saldoNuevo)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vista Revendedores */}
        <AnimatePresence>
          {vistaRevendedores && (
            <motion.div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="absolute inset-0 bg-black/80" onClick={() => setVistaRevendedores(false)} />
              <motion.div 
                className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-2xl rounded-2xl border border-gray-700/30 shadow-2xl max-h-[90vh] overflow-hidden"
                variants={modalVariants}
              >
                <div className="p-6 border-b border-gray-700/30 sticky top-0 bg-[#1a1f33]/95 backdrop-blur-sm z-10 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                        <Users size={22} className="text-white" />
                      </div>
                      <h2 className="text-xl font-bold text-white">Cuentas por Cobrar</h2>
                    </div>
                    <button onClick={() => setVistaRevendedores(false)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  {/* Buscador de revendedores */}
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Buscar revendedor..." 
                      className="w-full bg-[#0a0d14] border border-gray-700/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-300 focus:border-purple-500/50 transition-colors outline-none" 
                      value={busquedaRevendedor} 
                      onChange={e => setBusquedaRevendedor(e.target.value)} 
                    />
                  </div>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-160px)]">
                  {revendedoresConDeuda.filter(r => 
                    !busquedaRevendedor || r.nombre.toLowerCase().includes(busquedaRevendedor.toLowerCase())
                  ).length > 0 && (
                    <>
                      <h3 className="text-sm font-bold text-orange-400 uppercase flex items-center gap-2">
                        <AlertTriangle size={14} /> Con Deuda
                      </h3>
                      <div className="space-y-4">
                        {revendedoresConDeuda
                          .filter(r => !busquedaRevendedor || r.nombre.toLowerCase().includes(busquedaRevendedor.toLowerCase()))
                          .map((rev, idx) => {
                          const isHidden = revendedoresOcultos.includes(rev.nombre);
                          return (
                            <div 
                              key={idx} 
                              className={`bg-[#0a0d14] p-5 rounded-xl border flex flex-col gap-4 transition-colors ${isHidden ? 'border-gray-800 opacity-60' : 'border-orange-500/30'}`}
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg">
                                    {rev.nombre.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-bold text-white text-lg">{rev.nombre}</h3>
                                      <button
                                        onClick={() => copiarLinkPortal(rev.nombre)}
                                        className="p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 transition-colors"
                                        title="Copiar link del portal"
                                      >
                                        <Link2 size={14} />
                                      </button>
                                    </div>
                                    <p className="text-sm text-gray-500">{rev.facturasPendientes} facturas</p>
                                  </div>
                                </div>
                                <p className="text-2xl font-mono font-bold text-orange-400">
                                  {formatearDinero(rev.deudaTotal)}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-800">
                                <button 
                                  onClick={() => toggleVisibilidadRevendedor(rev.nombre)} 
                                  className="p-2.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition-colors"
                                >
                                  {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                                <button 
                                  onClick={() => abrirEstadoCuenta(rev.nombre)} 
                                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 font-medium transition-colors"
                                >
                                  <FileText size={14} /> Ver Detalle
                                </button>
                                <button 
                                  onClick={() => descargarEstadoCuenta(rev.nombre, false)} 
                                  className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 font-medium transition-colors"
                                >
                                  <Download size={14} /> Descargar
                                </button>
                                <button 
                                  onClick={() => enviarResumenWhatsApp(rev.nombre)} 
                                  className="bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 font-medium transition-colors"
                                >
                                  <MessageCircle size={14} /> WA
                                </button>
                                <button 
                                  onClick={() => abrirHistorialPagos(rev.nombre)} 
                                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 font-medium transition-colors"
                                >
                                  <History size={14} /> Pagos
                                </button>
                                <button 
                                  onClick={() => iniciarPagoRevendedor(rev.nombre, rev.deudaTotal)} 
                                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm ml-auto flex items-center gap-2 shadow-lg"
                                >
                                  <Wallet size={16} /> Pago
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  
                  {todosRevendedores
                    .filter(n => !revendedoresConDeuda.find(r => r.nombre === n))
                    .filter(n => !busquedaRevendedor || n.toLowerCase().includes(busquedaRevendedor.toLowerCase()))
                    .length > 0 && (
                    <>
                      <h3 className="text-sm font-bold text-emerald-400 uppercase mt-6 pt-4 border-t border-gray-800 flex items-center gap-2">
                        <Check size={14} /> Sin Deuda
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {todosRevendedores
                          .filter(n => !revendedoresConDeuda.find(r => r.nombre === n))
                          .filter(n => !busquedaRevendedor || n.toLowerCase().includes(busquedaRevendedor.toLowerCase()))
                          .map((nombre, idx) => (
                          <div 
                            key={idx} 
                            className="bg-[#0a0d14] p-4 rounded-xl border border-gray-800 hover:border-emerald-500/30 flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 text-gray-400 flex items-center justify-center font-bold">
                                {nombre.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-white font-medium">{nombre}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => abrirHistorialPagos(nombre)} 
                                className="p-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl transition-colors"
                                title="Historial de pagos"
                              >
                                <History size={14} />
                              </button>
                              <button 
                                onClick={() => abrirEstadoCuenta(nombre)} 
                                className="p-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl transition-colors"
                              >
                                <FileText size={14} />
                              </button>
                              <button 
                                onClick={() => descargarEstadoCuenta(nombre, false)} 
                                className="p-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl transition-colors"
                              >
                                <Download size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {todosRevendedores.length === 0 && (
                    <div className="text-center py-16 text-gray-500">
                      <Users size={56} className="mx-auto mb-4 opacity-30" />
                      <p>No tienes revendedores registrados.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Desglose de Ganancias del Día */}
        <AnimatePresence>
          {modalDesgloseGanancia.visible && (
            <motion.div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="absolute inset-0 bg-black/70" onClick={closeModalDesgloseGanancia} />
              <motion.div 
                className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-lg rounded-2xl border border-emerald-500/20 shadow-2xl p-6 max-h-[85vh] overflow-hidden flex flex-col"
                variants={modalVariants}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
                      <TrendingUp size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Desglose de Ganancias</h3>
                      <p className="text-sm text-gray-400">
                        {new Date(modalDesgloseGanancia.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                  </div>
                  <button onClick={closeModalDesgloseGanancia} className="p-2 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>

                {/* Total del día */}
                <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 p-4 rounded-xl border border-emerald-500/20 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-400 font-medium">Total del día</span>
                    <span className="text-2xl font-bold text-white font-mono">{formatearDinero(modalDesgloseGanancia.total)}</span>
                  </div>
                  {desgloseGananciaPorRevendedor.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{desgloseGananciaDiaria.length} cobros de {desgloseGananciaPorRevendedor.length} revendedor{desgloseGananciaPorRevendedor.length > 1 ? 'es' : ''}</p>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {modalDesgloseGanancia.detalles.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <TrendingUp size={48} className="mx-auto mb-4 opacity-30" />
                      <p>No hay ganancias registradas este día</p>
                      <p className="text-xs mt-2 text-gray-600">Los cobros aparecerán aquí cuando registres abonos</p>
                    </div>
                  ) : (
                    <>
                      {/* Desglose por revendedor */}
                      {desgloseGananciaPorRevendedor.map((grupo, idx) => (
                        <div key={idx} className="bg-[#0a0d14] rounded-xl border border-gray-700/30 overflow-hidden">
                          <div className="bg-gray-800/30 px-4 py-3 flex justify-between items-center border-b border-gray-700/30">
                            <div className="flex items-center gap-2">
                              <Users size={14} className="text-purple-400" />
                              <span className="font-bold text-white">{grupo.revendedor}</span>
                            </div>
                            <span className="text-emerald-400 font-mono font-bold">{formatearDinero(grupo.total)}</span>
                          </div>
                          <div className="divide-y divide-gray-800/50">
                            {grupo.detalles.map((detalle, dIdx) => (
                              <div key={dIdx} className="px-4 py-3 flex justify-between items-center hover:bg-white/5 transition-colors">
                                <div>
                                  <p className="text-white text-sm font-medium">{detalle.cliente}</p>
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Briefcase size={10} /> {detalle.empresa}
                                    <span className="mx-1">•</span>
                                    <span className={detalle.tipo === 'pago_completo' ? 'text-emerald-500' : 'text-blue-400'}>
                                      {detalle.tipo === 'pago_completo' ? '✓ Pago completo' : '◐ Abono'}
                                    </span>
                                  </p>
                                </div>
                                <span className="text-white font-mono font-bold">{formatearDinero(detalle.monto)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="relative max-w-6xl mx-auto px-4 py-8 pb-24 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna Izquierda - Formulario */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <SimpleCard className="relative bg-gradient-to-br from-[#1a1f33] via-[#151929] to-[#0f1219] rounded-2xl p-6 border border-gray-800/50 shadow-2xl overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px]" />
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl shadow-lg">
                      <Plus size={20} className="text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Registrar Venta</h2>
                  </div>
                  
                  <form onSubmit={agregarFactura} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cliente</label>
                      <input 
                        type="text"
                        list="sugerencias-clientes"
                        className="w-full bg-[#0a0d14] border border-gray-700/50 rounded-xl p-3.5 text-sm text-white focus:border-purple-500/50 outline-none transition-colors placeholder:text-gray-600"
                        placeholder="Nombre del cliente"
                        value={form.cliente}
                        onChange={e => setForm({...form, cliente: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Teléfono</label>
                      <input 
                        type="tel"
                        className="w-full bg-[#0a0d14] border border-gray-700/50 rounded-xl p-3.5 text-sm text-white focus:border-purple-500/50 outline-none transition-colors placeholder:text-gray-600"
                        placeholder="3001234567"
                        value={form.telefono}
                        onChange={e => setForm({...form, telefono: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Revendedor</label>
                      <input 
                        type="text"
                        list="sugerencias-revendedores"
                        className="w-full bg-[#0a0d14] border border-gray-700/50 rounded-xl p-3.5 text-sm text-white focus:border-purple-500/50 outline-none transition-colors placeholder:text-gray-600"
                        placeholder="Origen de la venta"
                        value={form.revendedor}
                        onChange={e => setForm({...form, revendedor: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Servicio</label>
                      <input 
                        type="text"
                        list="servicios-sugeridos"
                        className="w-full bg-[#0a0d14] border border-gray-700/50 rounded-xl p-3.5 text-sm text-white focus:border-purple-500/50 outline-none transition-colors placeholder:text-gray-600"
                        placeholder="Netflix, Wom..."
                        value={form.empresa}
                        onChange={e => setForm({...form, empresa: e.target.value})}
                        required
                      />
                    </div>
                    
                    <datalist id="sugerencias-clientes">{sugerenciasClientes.map(c => (<option key={c} value={c} />))}</datalist>
                    <datalist id="sugerencias-revendedores">{sugerenciasRevendedores.map(rev => (<option key={rev} value={rev} />))}</datalist>
                    <datalist id="servicios-sugeridos">{sugerenciasServicios.map(s => (<option key={s} value={s} />))}</datalist>
                    
                    <div className="bg-[#0a0d14] p-4 rounded-xl border border-purple-500/20 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Valor Factura</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-gray-500 font-medium">$</span>
                          <input 
                            type="tel" 
                            className="w-full bg-[#1a1f33] border border-gray-700/50 rounded-xl p-3.5 pl-8 text-white font-mono focus:border-purple-500/50 transition-colors outline-none" 
                            placeholder="0" 
                            value={form.montoFactura} 
                            onChange={(e) => handleMoneyInput(e, 'montoFactura')} 
                            required 
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-1/3 space-y-1.5">
                          <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                            <Percent size={10} /> Cobras
                          </label>
                          <input 
                            type="number" 
                            className="w-full bg-[#1a1f33] border border-purple-500/30 rounded-xl p-3.5 text-white text-center font-bold focus:border-purple-500/60 transition-colors outline-none" 
                            value={form.porcentajeCobro} 
                            onChange={e => setForm({...form, porcentajeCobro: Number(e.target.value)})} 
                          />
                        </div>
                        <div className="w-2/3 space-y-1.5">
                          <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Total Cobrar</label>
                          <div className="relative">
                            <span className="absolute left-4 top-3.5 text-emerald-500 font-medium">$</span>
                            <input 
                              type="tel" 
                              className="w-full bg-[#1a1f33] border border-emerald-500/30 rounded-xl p-3.5 pl-8 text-emerald-400 font-bold font-mono focus:border-emerald-500/60 transition-colors outline-none" 
                              value={form.cobroCliente} 
                              onChange={(e) => handleMoneyInput(e, 'cobroCliente')} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <MagneticButton className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-3">
                      <Zap size={20} className="fill-current" /> Guardar Pedido
                    </MagneticButton>
                  </form>
                </div>
              </SimpleCard>
            </div>
          </div>

          {/* Columna Derecha - Lista */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SimpleCard className="group relative bg-gradient-to-br from-orange-900/40 via-orange-900/20 to-transparent p-5 rounded-xl border border-orange-500/30 overflow-hidden">
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-orange-500/20 rounded-xl">
                      <AlertTriangle size={16} className="text-orange-400" />
                    </div>
                    <p className="text-orange-400/80 text-xs font-bold uppercase">Por Cobrar</p>
                  </div>
                  <p className="text-3xl font-mono font-bold text-orange-400">{formatearDinero(dineroPendienteCobro)}</p>
                </div>
              </SimpleCard>
              
              <MagneticButton 
                onClick={() => setVistaRevendedores(true)} 
                className="group relative bg-gradient-to-br from-purple-900/40 via-purple-900/20 to-transparent border border-purple-500/30 text-white p-5 rounded-xl flex items-center gap-4 overflow-hidden text-left"
              >
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                  <Users className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-purple-400/80">Ver Cuentas</p>
                  <p className="font-bold text-lg">Revendedores</p>
                </div>
              </MagneticButton>
              
              <MagneticButton 
                onClick={() => setVistaEstadisticas(true)} 
                className="group relative bg-gradient-to-br from-emerald-900/40 via-emerald-900/20 to-transparent border border-emerald-500/30 text-white p-5 rounded-xl flex items-center gap-4 overflow-hidden text-left"
              >
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                  <BarChart3 className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-emerald-400/80">Ver Análisis</p>
                  <p className="font-bold text-lg">Estadísticas</p>
                </div>
              </MagneticButton>
            </div>

            {/* Mini Stats */}
            <div className="grid grid-cols-2 gap-4">
              <SimpleCard className="group relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] p-5 rounded-xl border border-gray-800/50 hover:border-emerald-500/30 transition-colors overflow-hidden">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={abrirDesgloseGanancia}
                    className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    title="Ver desglose de ganancias"
                  >
                    <TrendingUp size={20} />
                  </button>
                  <button 
                    onClick={abrirDesgloseGanancia}
                    className="flex-1 text-left hover:opacity-80 transition-opacity"
                    title="Ver desglose de ganancias"
                  >
                    <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1">
                      Ganancia Hoy
                      {desgloseGananciaDiaria.length > 0 && (
                        <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[8px]">
                          {desgloseGananciaDiaria.length} cobros
                        </span>
                      )}
                    </p>
                    <p className="text-white font-mono font-bold text-xl">{formatearDinero(gananciaDiaria)}</p>
                  </button>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={diaEstadistica} 
                      onChange={e => {setDiaEstadistica(e.target.value); setMesEstadistica(e.target.value.slice(0, 7));}} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl transition-colors border border-gray-700/50 hover:border-gray-600 pointer-events-none">
                      <Calendar size={18} className="text-gray-400" />
                    </div>
                  </div>
                </div>
              </SimpleCard>
              
              <div className="relative bg-gradient-to-br from-[#1a1f33] to-[#0f1219] p-5 rounded-xl border border-gray-800/50 flex items-center gap-4 overflow-hidden">
                <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
                  <Calendar size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Ganancia Mes</p>
                  <p className="text-white font-mono font-bold text-xl">{formatearDinero(gananciaNetaMensual)}</p>
                  <div className="w-full bg-gray-800 h-2 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${porcentajeMeta}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-br from-[#1a1f33] to-[#0f1219] p-3 rounded-xl border border-gray-800/50">
              <div className="flex bg-[#0a0d14] rounded-xl p-1 w-full sm:w-auto overflow-x-auto">
                {[
                  { id: 'porPagar', label: 'Por Pagar', icon: ClipboardList },
                  { id: 'porCobrar', label: 'Por Cobrar', icon: AlertTriangle },
                  { id: 'finalizados', label: 'Finalizados', icon: Check },
                  { id: 'garantias', label: 'Garantías', icon: RefreshCw },
                  { id: 'ocultas', label: `Ocultas (${cantidadOcultas})`, icon: EyeOff }
                ].map((tab) => (
                  <button 
                    key={tab.id}
                    onClick={() => {
                      setFiltro(tab.id);
                      if (tab.id === 'ocultas') setMostrarOcultas(true);
                      else setMostrarOcultas(false);
                    }} 
                    className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-colors ${
                      filtro === tab.id 
                        ? tab.id === 'porPagar' ? 'bg-gray-700 text-white' 
                          : tab.id === 'porCobrar' ? 'bg-orange-500/30 text-orange-300' 
                          : tab.id === 'finalizados' ? 'bg-emerald-500/30 text-emerald-300'
                          : tab.id === 'garantias' ? 'bg-red-500/30 text-red-300'
                          : 'bg-gray-600/30 text-gray-300'
                        : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    <tab.icon size={14}/> <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                {/* Selector de ordenamiento */}
                <div className="relative">
                  <select
                    value={ordenFacturas}
                    onChange={(e) => setOrdenFacturas(e.target.value as any)}
                    className="appearance-none bg-[#0a0d14] border border-gray-700/50 rounded-xl py-2.5 pl-9 pr-8 text-sm text-gray-300 focus:border-purple-500/50 transition-colors outline-none cursor-pointer"
                  >
                    <option value="reciente">Más reciente</option>
                    <option value="antiguo">Más antiguo</option>
                    <option value="servicio">Por servicio</option>
                    <option value="revendedor">Por revendedor</option>
                    <option value="monto">Por monto</option>
                  </select>
                  <ArrowUpDown className="absolute left-3 top-3 text-gray-600 w-4 h-4 pointer-events-none" />
                  <ChevronDown className="absolute right-2 top-3 text-gray-600 w-4 h-4 pointer-events-none" />
                </div>
                {/* Búsqueda */}
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute left-3 top-3 text-gray-600 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Buscar..." 
                    className="w-full bg-[#0a0d14] border border-gray-700/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-300 focus:border-purple-500/50 transition-colors outline-none" 
                    value={busqueda} 
                    onChange={e => setBusqueda(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* Toggle mostrar ocultas en otras vistas */}
            {filtro !== 'ocultas' && cantidadOcultas > 0 && (
              <button 
                onClick={() => setMostrarOcultas(!mostrarOcultas)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-2 transition-colors"
              >
                {mostrarOcultas ? <EyeOff size={12} /> : <Eye size={12} />}
                {mostrarOcultas ? 'Ocultar facturas ocultas' : `Mostrar ${cantidadOcultas} facturas ocultas`}
              </button>
            )}

            {/* Lista de Facturas */}
            <div className="space-y-4">
              {facturasFiltradas.length === 0 && (
                <div className="text-center py-24 border border-dashed border-gray-700/50 rounded-2xl bg-gradient-to-br from-[#1a1f33]/30 to-transparent">
                  <List className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                  <p className="text-gray-500 text-lg">No hay facturas en esta vista</p>
                </div>
              )}

              {facturasFiltradas.map((f) => (
                <FacturaCard
                  key={f.id}
                  factura={f}
                  isEditing={editingId === f.id}
                  editValues={editValues}
                  isOculta={facturasOcultas.includes(f.id)}
                  onTogglePago={togglePagoProveedor}
                  onIniciarCobro={iniciarCobro}
                  onEnviarRecordatorio={enviarRecordatorio}
                  onAplicarGarantia={aplicarGarantia}
                  onIniciarEdicion={iniciarEdicion}
                  onGuardarEdicion={guardarEdicion}
                  onCancelarEdicion={cancelarEdicion}
                  onEliminar={eliminarFactura}
                  onAbrirHistorial={abrirHistorialAbonos}
                  onEditPorcentaje={handleEditPorcentaje}
                  onEditCobro={handleEditCobro}
                  onEditMonto={handleEditMonto}
                  onToggleOcultar={toggleOcultarFactura}
                  onAbonoProveedor={iniciarAbonoProveedor}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
};

export default NegocioPage;
