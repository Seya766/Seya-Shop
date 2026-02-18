import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Plus, X, Trash2,
  Shield, Zap, Wifi,
  Edit2, Check, Copy, CheckCircle2, Search, Layers
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Tarjeta, ServicioPago, TipoTarjeta, RedTarjeta } from '../utils/types';

// =============================================
// COLORES PARA TARJETAS
// =============================================
const COLORES_TARJETA = [
  { id: 'dark', label: 'Negro', gradient: 'from-gray-900 via-gray-800 to-gray-900', border: 'border-gray-600/30' },
  { id: 'purple', label: 'Morado', gradient: 'from-purple-900 via-purple-800 to-indigo-900', border: 'border-purple-500/30' },
  { id: 'blue', label: 'Azul', gradient: 'from-blue-900 via-blue-800 to-cyan-900', border: 'border-blue-500/30' },
  { id: 'emerald', label: 'Verde', gradient: 'from-emerald-900 via-emerald-800 to-teal-900', border: 'border-emerald-500/30' },
  { id: 'red', label: 'Rojo', gradient: 'from-red-900 via-red-800 to-rose-900', border: 'border-red-500/30' },
  { id: 'amber', label: 'Dorado', gradient: 'from-amber-900 via-yellow-800 to-amber-900', border: 'border-amber-500/30' },
  { id: 'pink', label: 'Rosa', gradient: 'from-pink-900 via-pink-800 to-fuchsia-900', border: 'border-pink-500/30' },
];

const ICONOS_SERVICIO = [
  { emoji: '💡', nombre: 'Luz' },
  { emoji: '💧', nombre: 'Agua' },
  { emoji: '📱', nombre: 'Celular' },
  { emoji: '📡', nombre: 'Internet' },
  { emoji: '📺', nombre: 'TV/Streaming' },
  { emoji: '🏠', nombre: 'Arriendo' },
  { emoji: '🚗', nombre: 'Transporte' },
  { emoji: '🛒', nombre: 'Mercado' },
  { emoji: '🎵', nombre: 'Spotify' },
  { emoji: '🎮', nombre: 'Gaming' },
  { emoji: '☁️', nombre: 'Nube' },
  { emoji: '💊', nombre: 'Salud' },
  { emoji: '🏋️', nombre: 'Gym' },
  { emoji: '🍔', nombre: 'Comida' },
  { emoji: '✈️', nombre: 'Viaje' },
  { emoji: '🔒', nombre: 'Seguro' },
];

const getRedIcon = (red: RedTarjeta) => {
  switch (red) {
    case 'visa': return 'VISA';
    case 'mastercard': return 'MC';
    case 'amex': return 'AMEX';
    default: return '';
  }
};

const getColorConfig = (colorId: string) => {
  return COLORES_TARJETA.find(c => c.id === colorId) || COLORES_TARJETA[0];
};

// Construir string en formato pipe: numero|MM|YYYY|CVV
const buildPipeFormat = (t: Tarjeta) => {
  const venc = t.vencimiento || '';
  const parts = venc.split('/');
  const mm = parts[0] || '';
  const yy = parts[1] || '';
  const yyyy = yy.length === 2 ? `20${yy}` : yy;
  return `${t.numero}|${mm}|${yyyy}|${t.cvv}`;
};

// =============================================
// COMPONENTE TARJETA VISUAL (siempre visible)
// =============================================
const TarjetaVisual = ({ tarjeta, onCopy }: {
  tarjeta: Tarjeta;
  onCopy: (texto: string) => void;
}) => {
  const color = getColorConfig(tarjeta.color);
  const [copiado, setCopiado] = useState(false);

  const copiarPipe = () => {
    const pipe = buildPipeFormat(tarjeta);
    navigator.clipboard.writeText(pipe);
    setCopiado(true);
    onCopy(pipe);
    setTimeout(() => setCopiado(false), 2000);
  };

  const formatNumero = (num: string) => {
    return num.replace(/(.{4})/g, '$1 ').trim();
  };

  return (
    <button
      onClick={copiarPipe}
      className={`relative w-full aspect-[1.6/1] bg-gradient-to-br ${color.gradient} rounded-2xl p-4 sm:p-5 border ${color.border} overflow-hidden shadow-2xl text-left active:scale-[0.98] transition-transform`}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 right-4 w-32 h-32 rounded-full border border-white/20" />
        <div className="absolute top-8 right-8 w-24 h-24 rounded-full border border-white/10" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full border border-white/10" />
      </div>

      {/* Header */}
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-white/60 text-[10px] uppercase tracking-widest">{tarjeta.tipo === 'credito' ? 'Credit' : 'Debit'}</p>
          <p className="text-white font-bold text-lg leading-tight">{tarjeta.alias}</p>
          <p className="text-white/40 text-xs">{tarjeta.banco}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg transition-colors ${copiado ? 'bg-emerald-500/30' : 'bg-white/10'}`}>
            {copiado ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} className="text-white/50" />}
          </div>
          {tarjeta.red !== 'otra' && (
            <span className="text-white/80 font-bold text-sm tracking-wider">{getRedIcon(tarjeta.red)}</span>
          )}
        </div>
      </div>

      {/* Chip */}
      <div className="relative mt-2 sm:mt-3 flex items-center gap-3">
        <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-400/80 to-yellow-600/80 border border-yellow-300/30" />
        <Wifi size={16} className="text-white/30 rotate-90" />
      </div>

      {/* Numero - siempre visible */}
      <div className="relative mt-1.5 sm:mt-2">
        <p className="font-mono text-white text-sm sm:text-lg tracking-[0.15em] sm:tracking-[0.2em]">
          {formatNumero(tarjeta.numero)}
        </p>
      </div>

      {/* Footer */}
      <div className="relative mt-1.5 sm:mt-2 flex items-end justify-between">
        <div>
          <p className="text-white/40 text-[9px] uppercase tracking-wider">Titular</p>
          <p className="text-white/90 text-[11px] sm:text-xs font-medium uppercase tracking-wider">{tarjeta.titular}</p>
        </div>
        <div className="text-right">
          <p className="text-white/40 text-[9px] uppercase tracking-wider">Vence</p>
          <p className="text-white/90 text-xs font-mono">{tarjeta.vencimiento}</p>
        </div>
        <div className="text-right">
          <p className="text-white/40 text-[9px] uppercase tracking-wider">CVV</p>
          <p className="text-white/90 text-xs font-mono">{tarjeta.cvv}</p>
        </div>
      </div>

      {/* Copiado toast */}
      <AnimatePresence>
        {copiado && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
          >
            Copiado al portapapeles
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
interface TarjetasVaultProps {
  visible: boolean;
  onClose: () => void;
}

const TarjetasVault = ({ visible, onClose }: TarjetasVaultProps) => {
  const { tarjetas, setTarjetas } = useData();

  // UI states
  const [vista, setVista] = useState<'tarjetas' | 'servicios'>('tarjetas');
  const [tarjetaAbierta, setTarjetaAbierta] = useState<number | null>(null);
  const [modalNueva, setModalNueva] = useState(false);
  const [modalServicio, setModalServicio] = useState<{ visible: boolean; tarjetaId: number | null }>({ visible: false, tarjetaId: null });
  const [modalEditar, setModalEditar] = useState<{ visible: boolean; tarjeta: Tarjeta | null }>({ visible: false, tarjeta: null });
  const [confirmarEliminar, setConfirmarEliminar] = useState<number | null>(null);
  const [busquedaServicio, setBusquedaServicio] = useState('');

  // Form states
  const [form, setForm] = useState({
    alias: '', banco: '', tipo: 'credito' as TipoTarjeta, red: 'visa' as RedTarjeta,
    numero: '', titular: '', vencimiento: '', cvv: '', color: 'dark'
  });
  const [formServicio, setFormServicio] = useState({ nombre: '', icono: '💡' });

  const resetForm = () => {
    setForm({ alias: '', banco: '', tipo: 'credito', red: 'visa', numero: '', titular: '', vencimiento: '', cvv: '', color: 'dark' });
  };

  // Agrupar servicios -> tarjetas (vista inversa)
  const serviciosConTarjetas = useMemo(() => {
    const mapa: Record<string, { nombre: string; icono: string; tarjetas: { tarjeta: Tarjeta; pipeFormat: string }[] }> = {};
    tarjetas.forEach(t => {
      t.servicios.forEach(s => {
        const key = s.nombre.toLowerCase();
        if (!mapa[key]) {
          mapa[key] = { nombre: s.nombre, icono: s.icono, tarjetas: [] };
        }
        mapa[key].tarjetas.push({ tarjeta: t, pipeFormat: buildPipeFormat(t) });
      });
    });
    return Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [tarjetas]);

  const serviciosFiltrados = useMemo(() => {
    if (!busquedaServicio) return serviciosConTarjetas;
    const q = busquedaServicio.toLowerCase();
    return serviciosConTarjetas.filter(s => s.nombre.toLowerCase().includes(q));
  }, [serviciosConTarjetas, busquedaServicio]);

  const agregarTarjeta = () => {
    if (!form.alias || !form.numero || !form.titular) return;
    const nueva: Tarjeta = {
      id: Date.now(),
      alias: form.alias,
      banco: form.banco,
      tipo: form.tipo,
      red: form.red,
      ultimos4: form.numero.replace(/\s/g, '').slice(-4),
      titular: form.titular,
      numero: form.numero.replace(/\s/g, ''),
      vencimiento: form.vencimiento,
      cvv: form.cvv,
      color: form.color,
      servicios: []
    };
    setTarjetas(prev => [...prev, nueva]);
    setModalNueva(false);
    resetForm();
  };

  const editarTarjeta = () => {
    if (!modalEditar.tarjeta || !form.alias || !form.numero || !form.titular) return;
    setTarjetas(prev => prev.map(t => {
      if (t.id !== modalEditar.tarjeta!.id) return t;
      return {
        ...t,
        alias: form.alias,
        banco: form.banco,
        tipo: form.tipo,
        red: form.red,
        ultimos4: form.numero.replace(/\s/g, '').slice(-4),
        titular: form.titular,
        numero: form.numero.replace(/\s/g, ''),
        vencimiento: form.vencimiento,
        cvv: form.cvv,
        color: form.color
      };
    }));
    setModalEditar({ visible: false, tarjeta: null });
    resetForm();
  };

  const eliminarTarjeta = (id: number) => {
    setTarjetas(prev => prev.filter(t => t.id !== id));
    setConfirmarEliminar(null);
    if (tarjetaAbierta === id) setTarjetaAbierta(null);
  };

  const agregarServicio = () => {
    if (!formServicio.nombre || !modalServicio.tarjetaId) return;
    const nuevoServicio: ServicioPago = {
      id: Date.now(),
      nombre: formServicio.nombre,
      icono: formServicio.icono
    };
    setTarjetas(prev => prev.map(t => {
      if (t.id !== modalServicio.tarjetaId) return t;
      return { ...t, servicios: [...t.servicios, nuevoServicio] };
    }));
    setFormServicio({ nombre: '', icono: '💡' });
    setModalServicio({ visible: false, tarjetaId: null });
  };

  const eliminarServicio = (tarjetaId: number, servicioId: number) => {
    setTarjetas(prev => prev.map(t => {
      if (t.id !== tarjetaId) return t;
      return { ...t, servicios: t.servicios.filter(s => s.id !== servicioId) };
    }));
  };

  const iniciarEdicion = (tarjeta: Tarjeta) => {
    setForm({
      alias: tarjeta.alias,
      banco: tarjeta.banco,
      tipo: tarjeta.tipo,
      red: tarjeta.red,
      numero: tarjeta.numero,
      titular: tarjeta.titular,
      vencimiento: tarjeta.vencimiento,
      cvv: tarjeta.cvv,
      color: tarjeta.color
    });
    setModalEditar({ visible: true, tarjeta });
  };

  const formatNumeroInput = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 16);
  };

  const formatVencimientoInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const copiarTexto = useCallback((_texto: string) => {
    // Toast is handled by the TarjetaVisual component
  }, []);

  const copiarPipeDesdeServicio = (pipe: string) => {
    navigator.clipboard.writeText(pipe);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-[#0a0c12]/98 backdrop-blur-xl overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#0a0c12]/90 backdrop-blur-lg border-b border-gray-800/50">
            <div className="max-w-2xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-500/20">
                    <Shield size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h1 className="text-white font-bold text-lg">Vault</h1>
                    <p className="text-gray-500 text-xs">{tarjetas.length} tarjeta{tarjetas.length !== 1 ? 's' : ''} - Toca para copiar</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setModalNueva(true); resetForm(); }}
                    className="p-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 transition-colors"
                  >
                    <Plus size={18} className="text-emerald-400" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2.5 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/30 transition-colors"
                  >
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Toggle vista: Tarjetas vs Por Servicio */}
              <div className="flex bg-[#0f111a] rounded-xl p-1">
                <button
                  onClick={() => setVista('tarjetas')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors ${
                    vista === 'tarjetas' ? 'bg-purple-600/30 text-purple-300' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <CreditCard size={14} />
                  Tarjetas
                </button>
                <button
                  onClick={() => setVista('servicios')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors ${
                    vista === 'servicios' ? 'bg-indigo-600/30 text-indigo-300' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Layers size={14} />
                  Por Servicio
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

            {/* ============================================= */}
            {/* VISTA: TARJETAS */}
            {/* ============================================= */}
            {vista === 'tarjetas' && (
              <>
                {tarjetas.length === 0 ? (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/20 flex items-center justify-center">
                      <CreditCard size={32} className="text-purple-400" />
                    </div>
                    <p className="text-gray-400 text-lg font-medium mb-2">Sin tarjetas</p>
                    <p className="text-gray-600 text-sm mb-6">Agrega tus tarjetas y los servicios donde las usas</p>
                    <button
                      onClick={() => { setModalNueva(true); resetForm(); }}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-500/25"
                    >
                      Agregar primera tarjeta
                    </button>
                  </motion.div>
                ) : (
                  tarjetas.map((tarjeta, index) => (
                    <motion.div
                      key={tarjeta.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className="space-y-3"
                    >
                      {/* Tarjeta visual - toca para copiar en formato pipe */}
                      <TarjetaVisual tarjeta={tarjeta} onCopy={copiarTexto} />

                      {/* Pipe format preview */}
                      <div className="px-1">
                        <p className="font-mono text-[11px] text-gray-600 truncate select-all">
                          {buildPipeFormat(tarjeta)}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 px-1">
                        <button
                          onClick={() => setTarjetaAbierta(tarjetaAbierta === tarjeta.id ? null : tarjeta.id)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                            tarjetaAbierta === tarjeta.id
                              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                              : 'bg-gray-800/50 text-gray-400 border border-gray-700/30 hover:bg-gray-800'
                          }`}
                        >
                          <Zap size={14} />
                          Servicios ({tarjeta.servicios.length})
                        </button>
                        <button
                          onClick={() => iniciarEdicion(tarjeta)}
                          className="p-2.5 rounded-xl bg-gray-800/50 border border-gray-700/30 hover:bg-gray-800 transition-colors"
                        >
                          <Edit2 size={14} className="text-gray-400" />
                        </button>
                        {confirmarEliminar === tarjeta.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => eliminarTarjeta(tarjeta.id)} className="p-2.5 rounded-xl bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 transition-colors">
                              <Check size={14} className="text-red-400" />
                            </button>
                            <button onClick={() => setConfirmarEliminar(null)} className="p-2.5 rounded-xl bg-gray-800/50 border border-gray-700/30 hover:bg-gray-800 transition-colors">
                              <X size={14} className="text-gray-400" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmarEliminar(tarjeta.id)} className="p-2.5 rounded-xl bg-gray-800/50 border border-gray-700/30 hover:bg-gray-800 transition-colors">
                            <Trash2 size={14} className="text-gray-400" />
                          </button>
                        )}
                      </div>

                      {/* Servicios grid (expandible) */}
                      <AnimatePresence>
                        {tarjetaAbierta === tarjeta.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-[#12151f] rounded-xl border border-gray-800/50 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Pago con esta tarjeta</p>
                                <button
                                  onClick={() => { setModalServicio({ visible: true, tarjetaId: tarjeta.id }); setFormServicio({ nombre: '', icono: '💡' }); }}
                                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                  <Plus size={14} />
                                  Agregar
                                </button>
                              </div>

                              {tarjeta.servicios.length === 0 ? (
                                <p className="text-gray-600 text-sm text-center py-4">No hay servicios asignados</p>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {tarjeta.servicios.map(servicio => (
                                    <div
                                      key={servicio.id}
                                      className="group relative bg-gray-800/40 hover:bg-gray-800/60 rounded-xl p-3 border border-gray-700/30 transition-all"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <span className="text-xl">{servicio.icono}</span>
                                        <span className="text-sm text-gray-300 font-medium truncate">{servicio.nombre}</span>
                                      </div>
                                      <button
                                        onClick={() => eliminarServicio(tarjeta.id, servicio.id)}
                                        className="absolute top-1 right-1 p-1 rounded-lg bg-red-600/0 hover:bg-red-600/20 opacity-0 group-hover:opacity-100 transition-all"
                                      >
                                        <X size={12} className="text-red-400" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))
                )}
              </>
            )}

            {/* ============================================= */}
            {/* VISTA: POR SERVICIO */}
            {/* ============================================= */}
            {vista === 'servicios' && (
              <>
                {/* Buscador */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-600 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar servicio... (Air-e, WOM, Netflix...)"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-300 focus:border-purple-500/50 transition-colors outline-none"
                    value={busquedaServicio}
                    onChange={e => setBusquedaServicio(e.target.value)}
                  />
                </div>

                {serviciosConTarjetas.length === 0 ? (
                  <div className="text-center py-16">
                    <Layers size={40} className="mx-auto mb-3 text-gray-700" />
                    <p className="text-gray-500">No hay servicios asignados</p>
                    <p className="text-gray-600 text-xs mt-1">Agrega servicios a tus tarjetas primero</p>
                  </div>
                ) : serviciosFiltrados.length === 0 ? (
                  <div className="text-center py-12">
                    <Search size={32} className="mx-auto mb-3 text-gray-700" />
                    <p className="text-gray-500">No se encontro "{busquedaServicio}"</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {serviciosFiltrados.map((servicio, idx) => (
                      <motion.div
                        key={servicio.nombre}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-[#12151f] rounded-xl border border-gray-800/50 overflow-hidden"
                      >
                        <div className="p-4 border-b border-gray-800/30">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{servicio.icono}</span>
                            <div>
                              <p className="text-white font-bold">{servicio.nombre}</p>
                              <p className="text-gray-500 text-xs">{servicio.tarjetas.length} tarjeta{servicio.tarjetas.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        </div>
                        <div className="divide-y divide-gray-800/30">
                          {servicio.tarjetas.map(({ tarjeta, pipeFormat }) => (
                            <CcRow key={tarjeta.id} tarjeta={tarjeta} pipeFormat={pipeFormat} onCopy={copiarPipeDesdeServicio} />
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ============================================= */}
          {/* MODAL: NUEVA TARJETA */}
          {/* ============================================= */}
          <AnimatePresence>
            {modalNueva && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
                onClick={() => setModalNueva(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#151929] rounded-t-3xl sm:rounded-3xl border border-gray-700/30 shadow-2xl"
                >
                  <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-white font-bold text-lg">Nueva Tarjeta</h2>
                      <button onClick={() => setModalNueva(false)} className="p-2 rounded-xl hover:bg-gray-800 transition-colors">
                        <X size={18} className="text-gray-400" />
                      </button>
                    </div>

                    <CardForm form={form} setForm={setForm} formatNumeroInput={formatNumeroInput} formatVencimientoInput={formatVencimientoInput} />

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setModalNueva(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-all">
                        Cancelar
                      </button>
                      <button onClick={agregarTarjeta} disabled={!form.alias || !form.numero || !form.titular}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:shadow-none">
                        Guardar
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ============================================= */}
          {/* MODAL: EDITAR TARJETA */}
          {/* ============================================= */}
          <AnimatePresence>
            {modalEditar.visible && modalEditar.tarjeta && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
                onClick={() => setModalEditar({ visible: false, tarjeta: null })}
              >
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#151929] rounded-t-3xl sm:rounded-3xl border border-gray-700/30 shadow-2xl"
                >
                  <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-white font-bold text-lg">Editar Tarjeta</h2>
                      <button onClick={() => setModalEditar({ visible: false, tarjeta: null })} className="p-2 rounded-xl hover:bg-gray-800 transition-colors">
                        <X size={18} className="text-gray-400" />
                      </button>
                    </div>

                    <CardForm form={form} setForm={setForm} formatNumeroInput={formatNumeroInput} formatVencimientoInput={formatVencimientoInput} />

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setModalEditar({ visible: false, tarjeta: null })} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-all">
                        Cancelar
                      </button>
                      <button onClick={editarTarjeta} disabled={!form.alias || !form.numero || !form.titular}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:shadow-none">
                        Guardar
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ============================================= */}
          {/* MODAL: AGREGAR SERVICIO */}
          {/* ============================================= */}
          <AnimatePresence>
            {modalServicio.visible && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
                onClick={() => setModalServicio({ visible: false, tarjetaId: null })}
              >
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-md bg-[#151929] rounded-t-3xl sm:rounded-3xl border border-gray-700/30 shadow-2xl"
                >
                  <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-white font-bold text-lg">Agregar Servicio</h2>
                      <button onClick={() => setModalServicio({ visible: false, tarjetaId: null })} className="p-2 rounded-xl hover:bg-gray-800 transition-colors">
                        <X size={18} className="text-gray-400" />
                      </button>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 block mb-1.5">Nombre del servicio</label>
                      <input
                        type="text" placeholder="Air-e, WOM, Netflix..."
                        className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 text-sm focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        value={formServicio.nombre} onChange={e => setFormServicio({ ...formServicio, nombre: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 block mb-2">Icono</label>
                      <div className="grid grid-cols-8 gap-2">
                        {ICONOS_SERVICIO.map(i => (
                          <button key={i.emoji}
                            onClick={() => setFormServicio({ ...formServicio, icono: i.emoji })}
                            className={`p-2.5 rounded-xl text-xl border transition-all ${
                              formServicio.icono === i.emoji
                                ? 'bg-purple-600/20 border-purple-500/30 scale-110'
                                : 'bg-gray-800/50 border-gray-700/30 hover:scale-105'
                            }`}
                            title={i.nombre}
                          >
                            {i.emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setModalServicio({ visible: false, tarjetaId: null })} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-all">
                        Cancelar
                      </button>
                      <button onClick={agregarServicio} disabled={!formServicio.nombre}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:shadow-none">
                        Agregar
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// =============================================
// FILA DE CC EN VISTA POR SERVICIO
// =============================================
const CcRow = ({ tarjeta, pipeFormat, onCopy }: { tarjeta: Tarjeta; pipeFormat: string; onCopy: (t: string) => void }) => {
  const [copiado, setCopiado] = useState(false);
  const color = getColorConfig(tarjeta.color);

  const copiar = () => {
    navigator.clipboard.writeText(pipeFormat);
    onCopy(pipeFormat);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <button
      onClick={copiar}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
    >
      <div className={`w-10 h-7 rounded-lg bg-gradient-to-br ${color.gradient} border ${color.border} flex-shrink-0 flex items-center justify-center`}>
        <span className="text-white/60 text-[8px] font-bold">{tarjeta.ultimos4}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">{tarjeta.alias} <span className="text-gray-500 text-xs">({tarjeta.banco})</span></p>
        <p className="font-mono text-[11px] text-gray-500 truncate">{pipeFormat}</p>
      </div>
      <div className={`p-1.5 rounded-lg transition-colors ${copiado ? 'bg-emerald-500/20' : 'bg-gray-800/50'}`}>
        {copiado ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} className="text-gray-500" />}
      </div>
    </button>
  );
};

// =============================================
// FORMULARIO DE TARJETA (reutilizable)
// =============================================
interface CardFormProps {
  form: { alias: string; banco: string; tipo: TipoTarjeta; red: RedTarjeta; numero: string; titular: string; vencimiento: string; cvv: string; color: string };
  setForm: (f: CardFormProps['form']) => void;
  formatNumeroInput: (v: string) => string;
  formatVencimientoInput: (v: string) => string;
}

const CardForm = ({ form, setForm, formatNumeroInput, formatVencimientoInput }: CardFormProps) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1.5">Alias</label>
        <input type="text" placeholder="Nu, Bancolombia..."
          className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 text-sm focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
          value={form.alias} onChange={e => setForm({ ...form, alias: e.target.value })}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1.5">Banco</label>
        <input type="text" placeholder="Nu Bank, BBVA..."
          className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 text-sm focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
          value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })}
        />
      </div>
    </div>
    <div>
      <label className="text-xs text-gray-500 block mb-1.5">Titular</label>
      <input type="text" placeholder="NOMBRE COMO APARECE EN LA TARJETA"
        className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 text-sm uppercase focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
        value={form.titular} onChange={e => setForm({ ...form, titular: e.target.value.toUpperCase() })}
      />
    </div>
    <div>
      <label className="text-xs text-gray-500 block mb-1.5">Numero completo</label>
      <input type="text" placeholder="1234567890123456" inputMode="numeric"
        className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 text-sm font-mono tracking-wider focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
        value={form.numero} onChange={e => setForm({ ...form, numero: formatNumeroInput(e.target.value) })}
        maxLength={16}
      />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1.5">Vencimiento</label>
        <input type="text" placeholder="MM/YY" inputMode="numeric"
          className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 text-sm font-mono focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
          value={form.vencimiento} onChange={e => setForm({ ...form, vencimiento: formatVencimientoInput(e.target.value) })}
          maxLength={5}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1.5">CVV</label>
        <input type="text" placeholder="123" inputMode="numeric"
          className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 text-sm font-mono focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
          value={form.cvv} onChange={e => setForm({ ...form, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          maxLength={4}
        />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1.5">Tipo</label>
        <div className="flex gap-2">
          {(['credito', 'debito'] as TipoTarjeta[]).map(t => (
            <button key={t} onClick={() => setForm({ ...form, tipo: t })}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                form.tipo === t ? 'bg-purple-600/20 border-purple-500/30 text-purple-300' : 'bg-gray-800/50 border-gray-700/30 text-gray-500 hover:text-gray-300'
              }`}
            >{t === 'credito' ? 'Credito' : 'Debito'}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1.5">Red</label>
        <div className="flex gap-1.5">
          {(['visa', 'mastercard', 'amex', 'otra'] as RedTarjeta[]).map(r => (
            <button key={r} onClick={() => setForm({ ...form, red: r })}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-medium border transition-all ${
                form.red === r ? 'bg-purple-600/20 border-purple-500/30 text-purple-300' : 'bg-gray-800/50 border-gray-700/30 text-gray-500 hover:text-gray-300'
              }`}
            >{r === 'mastercard' ? 'MC' : r === 'otra' ? 'Otra' : r.toUpperCase()}</button>
          ))}
        </div>
      </div>
    </div>
    <div>
      <label className="text-xs text-gray-500 block mb-2">Color</label>
      <div className="flex gap-2 flex-wrap">
        {COLORES_TARJETA.map(c => (
          <button key={c.id} onClick={() => setForm({ ...form, color: c.id })}
            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.gradient} border-2 transition-all ${
              form.color === c.id ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
            }`}
          />
        ))}
      </div>
    </div>
  </div>
);

export default TarjetasVault;
