import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Wallet, Receipt, Plus, Trash2, Check, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Calendar, Clock, AlertTriangle,
  CheckCircle2, Settings, ChevronDown, ChevronUp, Search, X,
  DollarSign, PiggyBank, Target, Lightbulb, Flame, Scissors,
  ArrowRight, Sparkles, Zap, Ban, Coffee,
  ShoppingBag, TrendingUp as TrendUp,
  Edit2, BarChart3, Filter, ArrowUpDown, Hash, Repeat, SortAsc, SortDesc,
  Gem,
  Percent, History, RefreshCw, Coins, AlertCircle
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { CATEGORIAS_GASTO } from '../utils/constants';
import {
  formatearDinero, formatearDineroCorto, getColombiaDateOnly,
  getColombiaISO, calcularDiasParaCorte
} from '../utils/helpers';
import type { GastoFijo, Transaccion, CategoriaGasto, Factura, HistorialAbono, MetaFinanciera, AporteMeta, Bolsillo, PagoGastoFijo } from '../utils/types';

// =============================================
// COMPONENTE PRINCIPAL
// =============================================

const FinanzasPage = () => {
  const { 
    facturas, gastosFijos, setGastosFijos, 
    transacciones, setTransacciones,
    metaAhorro, setMetaAhorro, presupuestoMensual, setPresupuestoMensual,
    metasFinancieras, setMetasFinancieras
  } = useData();

  // Estados UI
  const [tab, setTab] = useState<'resumen' | 'fijos' | 'movimientos' | 'insights' | 'analisis' | 'metas'>('resumen');
  const [mes, setMes] = useState(getColombiaDateOnly().slice(0, 7));
  
  // Modales
  const [modalGastoFijo, setModalGastoFijo] = useState(false);
  const [modalTransaccion, setModalTransaccion] = useState<{ visible: boolean; tipo: 'ingreso' | 'gasto' }>({ visible: false, tipo: 'gasto' });
  const [modalConfig, setModalConfig] = useState(false);
  const [modalEditarTransaccion, setModalEditarTransaccion] = useState<{ visible: boolean; transaccion: Transaccion | null }>({ visible: false, transaccion: null });
  
  // Modal para registrar pago de gasto fijo
  const [modalPagoGasto, setModalPagoGasto] = useState<{ visible: boolean; gasto: GastoFijo | null }>({ visible: false, gasto: null });
  const [formPagoGasto, setFormPagoGasto] = useState({ monto: '', fecha: getColombiaDateOnly() });
  const [modalHistorialGasto, setModalHistorialGasto] = useState<{ visible: boolean; gasto: GastoFijo | null }>({ visible: false, gasto: null });
  const [modalEditarGasto, setModalEditarGasto] = useState<{ visible: boolean; gasto: GastoFijo | null }>({ visible: false, gasto: null });
  const [formEditarGasto, setFormEditarGasto] = useState({ nombre: '', monto: '', categoria: 'servicios' as CategoriaGasto, diaCorte: '1' });
  
  // Modales de Metas
  const [modalMeta, setModalMeta] = useState(false);
  const [modalEditarMeta, setModalEditarMeta] = useState<{ visible: boolean; meta: MetaFinanciera | null }>({ visible: false, meta: null });
  const [modalHistorialMeta, setModalHistorialMeta] = useState<{ visible: boolean; meta: MetaFinanciera | null }>({ visible: false, meta: null });

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingresos' | 'gastos'>('todos');
  const [filtroPagado, setFiltroPagado] = useState<'todos' | 'pagados' | 'pendientes'>('todos');
  
  // Filtros de análisis
  const [ordenAnalisis, setOrdenAnalisis] = useState<'mayor' | 'menor' | 'frecuente' | 'reciente'>('mayor');
  const [filtroCategAnalisis, setFiltroCategAnalisis] = useState<CategoriaGasto | 'todas'>('todas');

  // Forms
  const [formGastoFijo, setFormGastoFijo] = useState({
    nombre: '', monto: '', categoria: 'servicios' as CategoriaGasto, diaCorte: '1'
  });
  const [formTransaccion, setFormTransaccion] = useState({
    descripcion: '', monto: '', categoria: 'otros' as CategoriaGasto, fecha: getColombiaDateOnly()
  });
  const [formEditTransaccion, setFormEditTransaccion] = useState({
    descripcion: '', monto: '', categoria: 'otros' as CategoriaGasto, fecha: ''
  });

  // Forms de Metas
  const [formMeta, setFormMeta] = useState({
    nombre: '', icono: '🚗', montoObjetivo: '', montoActual: '',
    fechaObjetivo: '', cajitaNubank: '', tasaRendimientoAnual: '11.5',
    aporteMensualPlaneado: '', prioridad: 'media' as 'alta' | 'media' | 'baja', color: 'emerald'
  });
  const [formAporte, setFormAporte] = useState({
    monto: '', tipo: 'aporte' as 'aporte' | 'rendimiento' | 'retiro', nota: ''
  });
  const [modalSincronizar, setModalSincronizar] = useState<{ visible: boolean; meta: MetaFinanciera | null; bolsillo: Bolsillo | null }>({ visible: false, meta: null, bolsillo: null });
  const [formSincronizar, setFormSincronizar] = useState({ saldoActual: '', aporteMio: '' });
  
  // Estados para bolsillos
  const [modalBolsillo, setModalBolsillo] = useState<{ visible: boolean; meta: MetaFinanciera | null; bolsillo: Bolsillo | null }>({ visible: false, meta: null, bolsillo: null });
  const [formBolsillo, setFormBolsillo] = useState({
    nombre: '', tipo: 'nu' as 'nu' | 'efectivo' | 'banco' | 'cdt' | 'otro', saldo: '', tasaRendimientoAnual: '11.5',
    // CDT fields
    fechaApertura: '', fechaVencimiento: '', renovacionAutomatica: false, entidadFinanciera: '', tipoInteres: 'compuesto' as 'compuesto' | 'simple'
  });
  const [modalAporteBolsillo, setModalAporteBolsillo] = useState<{ visible: boolean; meta: MetaFinanciera | null; bolsillo: Bolsillo | null }>({ visible: false, meta: null, bolsillo: null });

  // Iconos disponibles para metas
  const ICONOS_META = ['🚗', '🏠', '✈️', '💎', '📱', '🎓', '👶', '🎁', '💼', '🛡️', '🎉', '💰'];
  const COLORES_META = ['emerald', 'blue', 'purple', 'amber', 'rose', 'cyan', 'orange', 'pink'];
  
  // Tipos de bolsillos
  const TIPOS_BOLSILLO = [
    { tipo: 'nu', nombre: 'Nu Bank', icono: '💜', tasaDefault: 11.5 },
    { tipo: 'cdt', nombre: 'CDT', icono: '📜', tasaDefault: 9.5 },
    { tipo: 'efectivo', nombre: 'Efectivo', icono: '💵', tasaDefault: 0 },
    { tipo: 'banco', nombre: 'Otro Banco', icono: '🏦', tasaDefault: 0 },
    { tipo: 'otro', nombre: 'Otro', icono: '📦', tasaDefault: 0 },
  ] as const;

  // =============================================
  // HELPER: Calcular recibos pendientes de un gasto fijo
  // =============================================
  const calcularRecibosPendientes = useCallback((gasto: GastoFijo): { cantidad: number; montoEstimado: number } => {
    const hoy = new Date(getColombiaDateOnly());
    const diaHoy = hoy.getDate();
    const mesHoy = hoy.getMonth();
    const añoHoy = hoy.getFullYear();
    
    // Si está pagado este ciclo, no hay recibos pendientes
    if (gasto.pagadoEsteMes && gasto.fechaPago) {
      const fechaPago = new Date(gasto.fechaPago);
      
      // Calcular si el pago cubre el ciclo actual
      // El ciclo va desde el día de corte del mes anterior hasta el día de corte del mes actual
      let inicioClicloActual: Date;
      if (diaHoy >= gasto.diaCorte) {
        // Estamos después del corte, el ciclo empezó este mes
        inicioClicloActual = new Date(añoHoy, mesHoy, gasto.diaCorte);
      } else {
        // Estamos antes del corte, el ciclo empezó el mes pasado
        inicioClicloActual = new Date(añoHoy, mesHoy - 1, gasto.diaCorte);
      }
      
      // Si el pago es después del inicio del ciclo actual, está al día
      if (fechaPago >= inicioClicloActual) {
        return { cantidad: 0, montoEstimado: 0 };
      }
    }
    
    // Calcular cuántos ciclos han pasado sin pago
    let ultimaFechaReferencia: Date;
    
    if (gasto.fechaPago) {
      ultimaFechaReferencia = new Date(gasto.fechaPago);
    } else if (gasto.historialPagos && gasto.historialPagos.length > 0) {
      const ultimoPago = gasto.historialPagos[gasto.historialPagos.length - 1];
      ultimaFechaReferencia = new Date(ultimoPago.fecha);
    } else {
      // Nunca ha pagado, usar fecha de creación
      ultimaFechaReferencia = new Date(gasto.fechaCreacion.split('T')[0]);
    }
    
    // Contar ciclos desde la última referencia hasta hoy
    let ciclos = 0;
    let fechaCorte = new Date(ultimaFechaReferencia);
    fechaCorte.setDate(gasto.diaCorte);
    
    // Si la fecha de corte es antes de la referencia, ir al siguiente mes
    if (fechaCorte <= ultimaFechaReferencia) {
      fechaCorte.setMonth(fechaCorte.getMonth() + 1);
    }
    
    while (fechaCorte <= hoy) {
      ciclos++;
      fechaCorte.setMonth(fechaCorte.getMonth() + 1);
    }
    
    return { 
      cantidad: Math.max(ciclos, gasto.pagadoEsteMes ? 0 : 1), 
      montoEstimado: Math.max(ciclos, gasto.pagadoEsteMes ? 0 : 1) * gasto.monto 
    };
  }, []);

  // =============================================
  // EFECTO: Resetear gastos fijos cuando pasa la fecha de corte
  // =============================================
  useEffect(() => {
    const hoy = new Date(getColombiaDateOnly());
    const diaHoy = hoy.getDate();
    
    const gastosActualizados = gastosFijos.map(g => {
      if (!g.pagadoEsteMes) return g; // Ya está pendiente
      if (!g.fechaPago) return g; // No tiene fecha de pago registrada
      
      const fechaPago = new Date(g.fechaPago);
      const mesHoy = hoy.getMonth();
      const añoHoy = hoy.getFullYear();
      
      // Calcular el inicio del ciclo actual basado en el día de corte
      let inicioClicloActual: Date;
      if (diaHoy >= g.diaCorte) {
        inicioClicloActual = new Date(añoHoy, mesHoy, g.diaCorte);
      } else {
        inicioClicloActual = new Date(añoHoy, mesHoy - 1, g.diaCorte);
      }
      
      // Si el pago fue antes del inicio del ciclo actual, resetear
      if (fechaPago < inicioClicloActual) {
        return { 
          ...g, 
          pagadoEsteMes: false, 
          mesPagado: null,
          fechaPago: null,
          montoPagadoEsteMes: null
        };
      }
      
      return g;
    });
    
    const hayCambios = gastosActualizados.some((g, i) => 
      g.pagadoEsteMes !== gastosFijos[i].pagadoEsteMes
    );
    
    if (hayCambios) {
      setGastosFijos(gastosActualizados);
    }
  }, []); // Solo al montar el componente

  // =============================================
  // HELPER: Migrar metas legacy a sistema de bolsillos
  // =============================================
  const migrarMetaABolsillos = (meta: MetaFinanciera): MetaFinanciera => {
    // Si ya tiene bolsillos, solo asegurarse que no haya undefined
    if (meta.bolsillos && meta.bolsillos.length > 0) {
      return {
        ...meta,
        fechaObjetivo: meta.fechaObjetivo || '',
        cajitaNubank: meta.cajitaNubank || '',
        tasaRendimientoAnual: meta.tasaRendimientoAnual || 0,
        historialAportes: meta.historialAportes || [],
        bolsillos: meta.bolsillos.map(b => ({
          ...b,
          historialAportes: b.historialAportes.map(a => ({
            ...a,
            nota: a.nota || ''
          }))
        }))
      };
    }
    
    // Crear bolsillo desde datos legacy
    const bolsilloLegacy: Bolsillo = {
      id: Date.now(),
      nombre: meta.cajitaNubank || 'Nu Bank',
      icono: '💜',
      tipo: 'nu',
      saldo: meta.montoActual || 0,
      tasaRendimientoAnual: meta.tasaRendimientoAnual || 11.5,
      historialAportes: (meta.historialAportes || []).map(a => ({
        ...a,
        nota: a.nota || ''
      }))
    };
    
    return {
      ...meta,
      fechaObjetivo: meta.fechaObjetivo || '',
      cajitaNubank: meta.cajitaNubank || '',
      tasaRendimientoAnual: meta.tasaRendimientoAnual || 0,
      historialAportes: meta.historialAportes || [],
      bolsillos: [bolsilloLegacy]
    };
  };

  // Helper para calcular totales de una meta
  const calcularTotalesMeta = (meta: MetaFinanciera) => {
    const metaMigrada = migrarMetaABolsillos(meta);
    const saldoTotal = metaMigrada.bolsillos.reduce((sum, b) => sum + b.saldo, 0);
    const rendimientoMensualTotal = metaMigrada.bolsillos.reduce((sum, b) => 
      sum + (b.saldo * (b.tasaRendimientoAnual / 100) / 12), 0
    );
    
    // Totales de historial de todos los bolsillos
    const todosAportes = metaMigrada.bolsillos.flatMap(b => b.historialAportes);
    const totalAportado = todosAportes.filter(a => a.tipo === 'aporte').reduce((sum, a) => sum + a.monto, 0);
    const totalRendimientos = todosAportes.filter(a => a.tipo === 'rendimiento').reduce((sum, a) => sum + a.monto, 0);
    const totalRetirado = todosAportes.filter(a => a.tipo === 'retiro').reduce((sum, a) => sum + Math.abs(a.monto), 0);
    
    return { saldoTotal, rendimientoMensualTotal, totalAportado, totalRendimientos, totalRetirado, metaMigrada };
  };

  // Sección colapsable
  const [expandirCateg, setExpandirCateg] = useState(false);

  // =============================================
  // HELPER: Formatear mes correctamente (evita bug de timezone)
  // =============================================
  const formatearMes = (mesStr: string, opciones?: Intl.DateTimeFormatOptions) => {
    const [year, month] = mesStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, 15); // Día 15 para evitar problemas de timezone
    return fecha.toLocaleDateString('es-CO', opciones || { month: 'long', year: 'numeric' });
  };

  // =============================================
  // NORMALIZACIÓN DE HISTORIAL DE ABONOS
  // =============================================
  const getHistorialNormalizado = useCallback((f: Factura): HistorialAbono[] => {
    if (f.historialAbonos && f.historialAbonos.length > 0) {
      return f.historialAbonos;
    }
    
    if (f.abono && f.abono > 0) {
      let fechaMigrada = f.fechaISO.split('T')[0];
      
      if (f.fechaPagoReal) {
        const partes = f.fechaPagoReal.split(' ');
        if (partes.length >= 2) {
          const dia = partes[0].padStart(2, '0');
          const meses: Record<string, string> = { 
            'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06', 
            'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12' 
          };
          const mesAbono = meses[partes[1].toLowerCase()];
          if (mesAbono) {
            const año = f.fechaISO.split('-')[0];
            fechaMigrada = `${año}-${mesAbono}-${dia}`;
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

  const getFechaAbonoISO = useCallback((abono: HistorialAbono, factura: Factura): string => {
    if (abono.fecha && abono.fecha.match(/^\d{4}-\d{2}-\d{2}/)) {
      return abono.fecha;
    }
    return factura.fechaISO.split('T')[0];
  }, []);

  // =============================================
  // CÁLCULOS - BASADOS EN FECHA DE COBRO (CASHFLOW)
  // =============================================

  // Finanzas del mes actual
  const finanzas = useMemo(() => {
    let ingresosNegocio = 0;
    facturas.forEach(f => {
      const historial = getHistorialNormalizado(f);
      historial.forEach(abono => {
        const fechaAbono = getFechaAbonoISO(abono, f);
        if (fechaAbono.startsWith(mes)) {
          ingresosNegocio += abono.monto;
        }
      });
    });

    const ingresosExtra = transacciones
      .filter(t => t.tipo === 'ingreso' && t.fecha.startsWith(mes))
      .reduce((acc, t) => acc + t.monto, 0);

    const totalIngresos = ingresosNegocio + ingresosExtra;

    const totalGastosFijos = gastosFijos
      .filter(g => g.pagadoEsteMes)
      .reduce((acc, g) => acc + g.monto, 0);
    
    const gastosVariables = transacciones
      .filter(t => t.tipo === 'gasto' && t.fecha.startsWith(mes))
      .reduce((acc, t) => acc + t.monto, 0);

    const totalGastos = totalGastosFijos + gastosVariables;

    const balance = totalIngresos - totalGastos;
    const porcentajeGastos = totalIngresos > 0 ? (totalGastos / totalIngresos) * 100 : 0;
    const tasaAhorro = totalIngresos > 0 ? Math.max(0, (balance / totalIngresos) * 100) : 0;

    return {
      ingresosNegocio,
      ingresosExtra,
      totalIngresos,
      totalGastosFijos,
      gastosVariables,
      totalGastos,
      balance,
      porcentajeGastos,
      tasaAhorro
    };
  }, [facturas, gastosFijos, transacciones, mes, getHistorialNormalizado, getFechaAbonoISO]);

  // Mes anterior para comparaciones
  const mesAnteriorStr = useMemo(() => {
    const [year, month] = mes.split('-').map(Number);
    const fecha = new Date(year, month - 2, 1);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  }, [mes]);

  // Finanzas del mes anterior
  const finanzasMesAnterior = useMemo(() => {
    let ingresosNegocio = 0;
    facturas.forEach(f => {
      const historial = getHistorialNormalizado(f);
      historial.forEach(abono => {
        const fechaAbono = getFechaAbonoISO(abono, f);
        if (fechaAbono.startsWith(mesAnteriorStr)) {
          ingresosNegocio += abono.monto;
        }
      });
    });

    const ingresosExtra = transacciones
      .filter(t => t.tipo === 'ingreso' && t.fecha.startsWith(mesAnteriorStr))
      .reduce((acc, t) => acc + t.monto, 0);

    const totalIngresos = ingresosNegocio + ingresosExtra;
    
    const totalGastosFijos = gastosFijos.reduce((acc, g) => acc + g.monto, 0);
    
    const gastosVariables = transacciones
      .filter(t => t.tipo === 'gasto' && t.fecha.startsWith(mesAnteriorStr))
      .reduce((acc, t) => acc + t.monto, 0);

    const totalGastos = totalGastosFijos + gastosVariables;

    return { totalIngresos, totalGastos, gastosVariables };
  }, [facturas, gastosFijos, transacciones, mesAnteriorStr, getHistorialNormalizado, getFechaAbonoISO]);

  // Gastos por categoría del mes anterior
  const gastosPorCategoriaMesAnterior = useMemo(() => {
    const gastos: Record<string, number> = {};

    gastosFijos.forEach(g => {
      gastos[g.categoria] = (gastos[g.categoria] || 0) + g.monto;
    });

    transacciones
      .filter(t => t.tipo === 'gasto' && t.fecha.startsWith(mesAnteriorStr))
      .forEach(t => {
        gastos[t.categoria] = (gastos[t.categoria] || 0) + t.monto;
      });

    return gastos;
  }, [gastosFijos, transacciones, mesAnteriorStr]);

  // Gastos por categoría con comparación
  const gastosPorCategoria = useMemo(() => {
    const gastos: Record<string, number> = {};

    gastosFijos.forEach(g => {
      gastos[g.categoria] = (gastos[g.categoria] || 0) + g.monto;
    });

    transacciones
      .filter(t => t.tipo === 'gasto' && t.fecha.startsWith(mes))
      .forEach(t => {
        gastos[t.categoria] = (gastos[t.categoria] || 0) + t.monto;
      });

    return Object.entries(gastos)
      .map(([categoria, monto]) => {
        const montoAnterior = gastosPorCategoriaMesAnterior[categoria] || 0;
        const cambio = montoAnterior > 0 ? ((monto - montoAnterior) / montoAnterior) * 100 : 0;
        return { 
          categoria, 
          monto,
          montoAnterior,
          cambio,
          porcentaje: finanzas.totalGastos > 0 ? (monto / finanzas.totalGastos) * 100 : 0,
          porcentajeIngresos: finanzas.totalIngresos > 0 ? (monto / finanzas.totalIngresos) * 100 : 0
        };
      })
      .sort((a, b) => b.monto - a.monto);
  }, [gastosFijos, transacciones, mes, finanzas.totalGastos, finanzas.totalIngresos, gastosPorCategoriaMesAnterior]);

  // Gastos agrupados por descripción
  const gastosDetallados = useMemo(() => {
    const gastos: Record<string, { total: number; count: number; categoria: string }> = {};
    
    transacciones
      .filter(t => t.tipo === 'gasto' && t.fecha.startsWith(mes))
      .forEach(t => {
        const key = t.descripcion.toLowerCase().trim();
        if (!gastos[key]) {
          gastos[key] = { total: 0, count: 0, categoria: t.categoria };
        }
        gastos[key].total += t.monto;
        gastos[key].count++;
      });

    return Object.entries(gastos)
      .map(([descripcion, data]) => ({
        descripcion: descripcion.charAt(0).toUpperCase() + descripcion.slice(1),
        ...data
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [transacciones, mes]);

  // =============================================
  // ANÁLISIS INTELIGENTE Y ACCIONABLE
  // =============================================
  const analisisFinanciero = useMemo(() => {
    const hoy = new Date();
    const [añoMes, mesMes] = mes.split('-').map(Number);
    const ultimoDiaMes = new Date(añoMes, mesMes, 0).getDate();
    const diaActual = hoy.getMonth() + 1 === mesMes && hoy.getFullYear() === añoMes ? hoy.getDate() : ultimoDiaMes;
    const diasRestantes = Math.max(0, ultimoDiaMes - diaActual);
    const porcentajeMesTranscurrido = (diaActual / ultimoDiaMes) * 100;
    const esMesActual = hoy.getMonth() + 1 === mesMes && hoy.getFullYear() === añoMes;

    // Gastos fijos pendientes
    const gastosFijosPendientes = gastosFijos.filter(g => !g.pagadoEsteMes);
    const montoFijosPendientes = gastosFijosPendientes.reduce((acc, g) => acc + g.monto, 0);

    // Proyección de gastos variables
    const gastoVariableDiario = diaActual > 0 ? finanzas.gastosVariables / diaActual : 0;
    const proyeccionGastosVariables = gastoVariableDiario * ultimoDiaMes;
    const proyeccionTotalGastos = finanzas.totalGastosFijos + montoFijosPendientes + proyeccionGastosVariables;

    // Meta de ahorro
    const progresoMeta = metaAhorro.activa && metaAhorro.monto > 0 
      ? (Math.max(0, finanzas.balance) / metaAhorro.monto) * 100 
      : 0;
    const faltaParaMeta = metaAhorro.activa 
      ? Math.max(0, metaAhorro.monto - Math.max(0, finanzas.balance))
      : 0;

    // Dinero disponible real
    const dineroDisponibleReal = finanzas.balance - montoFijosPendientes;
    const gastoDiarioSeguro = diasRestantes > 0 ? Math.max(0, dineroDisponibleReal) / diasRestantes : 0;

    // Para llegar a la meta
    const necesitaAhorrarDiario = diasRestantes > 0 && faltaParaMeta > 0 
      ? faltaParaMeta / diasRestantes 
      : 0;
    const maximoGastoDiarioParaMeta = diasRestantes > 0 && metaAhorro.activa
      ? Math.max(0, (dineroDisponibleReal - faltaParaMeta) / diasRestantes)
      : gastoDiarioSeguro;

    // Identificar gasto hormiga (gastos pequeños frecuentes)
    const gastosHormiga = gastosDetallados.filter(g => g.count >= 3 && g.total / g.count < 50000);
    const totalGastosHormiga = gastosHormiga.reduce((acc, g) => acc + g.total, 0);

    // Mayor gasto evitable (no servicios, no salud)
    const gastosEvitables = gastosDetallados.filter(g => {
      const cat = g.categoria;
      return cat !== 'servicios' && cat !== 'salud' && cat !== 'vivienda';
    });

    // Categoría que más creció
    const categoriaQueMasSubio = gastosPorCategoria
      .filter(c => c.montoAnterior > 0 && c.cambio > 20)
      .sort((a, b) => (b.monto - b.montoAnterior) - (a.monto - a.montoAnterior))[0];

    return {
      diasRestantes,
      porcentajeMesTranscurrido,
      esMesActual,
      gastosFijosPendientes,
      montoFijosPendientes,
      gastoVariableDiario,
      proyeccionGastosVariables,
      proyeccionTotalGastos,
      progresoMeta,
      faltaParaMeta,
      dineroDisponibleReal,
      gastoDiarioSeguro,
      necesitaAhorrarDiario,
      maximoGastoDiarioParaMeta,
      gastosHormiga,
      totalGastosHormiga,
      gastosEvitables,
      categoriaQueMasSubio
    };
  }, [mes, finanzas, gastosFijos, metaAhorro, gastosDetallados, gastosPorCategoria]);

  // Gastos fijos con días para corte
  const gastosFijosConDias = useMemo(() => {
    let lista = gastosFijos.map(g => ({
      ...g,
      diasParaCorte: calcularDiasParaCorte(g.diaCorte)
    }));

    if (filtroPagado === 'pagados') {
      lista = lista.filter(g => g.pagadoEsteMes);
    } else if (filtroPagado === 'pendientes') {
      lista = lista.filter(g => !g.pagadoEsteMes);
    }

    return lista.sort((a, b) => a.diasParaCorte - b.diasParaCorte);
  }, [gastosFijos, filtroPagado]);

  // Stats de gastos fijos
  const statsGastosFijos = useMemo(() => {
    const pagados = gastosFijos.filter(g => g.pagadoEsteMes);
    const pendientes = gastosFijos.filter(g => !g.pagadoEsteMes);
    const urgentes = gastosFijos.filter(g => !g.pagadoEsteMes && calcularDiasParaCorte(g.diaCorte) <= 3);

    return {
      total: gastosFijos.length,
      totalMonto: gastosFijos.reduce((acc, g) => acc + g.monto, 0),
      pagados: pagados.length,
      pagadosMonto: pagados.reduce((acc, g) => acc + g.monto, 0),
      pendientes: pendientes.length,
      pendientesMonto: pendientes.reduce((acc, g) => acc + g.monto, 0),
      urgentes: urgentes.length
    };
  }, [gastosFijos]);

  // Transacciones filtradas
  const transaccionesFiltradas = useMemo(() => {
    let lista = transacciones.filter(t => t.fecha.startsWith(mes));

    if (filtroTipo === 'ingresos') lista = lista.filter(t => t.tipo === 'ingreso');
    else if (filtroTipo === 'gastos') lista = lista.filter(t => t.tipo === 'gasto');

    if (busqueda) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(t => 
        t.descripcion.toLowerCase().includes(q) || 
        t.categoria.toLowerCase().includes(q)
      );
    }

    return lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [transacciones, mes, filtroTipo, busqueda]);

  // Análisis detallado de gastos para la nueva sección
  const analisisGastos = useMemo(() => {
    // Solo gastos del mes seleccionado
    const gastosDelMes = transacciones.filter(t => t.tipo === 'gasto' && t.fecha.startsWith(mes));
    
    // Aplicar filtro de categoría
    const gastosFiltrados = filtroCategAnalisis === 'todas' 
      ? gastosDelMes 
      : gastosDelMes.filter(t => t.categoria === filtroCategAnalisis);
    
    // Agrupar por descripción para frecuencia
    const agrupados: Record<string, { 
      descripcion: string; 
      total: number; 
      count: number; 
      categoria: CategoriaGasto;
      promedioMonto: number;
      transacciones: Transaccion[];
    }> = {};
    
    gastosFiltrados.forEach(t => {
      const key = t.descripcion.toLowerCase().trim();
      if (!agrupados[key]) {
        agrupados[key] = { 
          descripcion: t.descripcion, 
          total: 0, 
          count: 0, 
          categoria: t.categoria,
          promedioMonto: 0,
          transacciones: []
        };
      }
      agrupados[key].total += t.monto;
      agrupados[key].count++;
      agrupados[key].transacciones.push(t);
    });
    
    // Calcular promedio
    Object.values(agrupados).forEach(g => {
      g.promedioMonto = g.total / g.count;
    });
    
    // Convertir a array y ordenar según criterio
    let lista = Object.values(agrupados);
    
    switch (ordenAnalisis) {
      case 'mayor':
        lista.sort((a, b) => b.total - a.total);
        break;
      case 'menor':
        lista.sort((a, b) => a.total - b.total);
        break;
      case 'frecuente':
        lista.sort((a, b) => b.count - a.count || b.total - a.total);
        break;
      case 'reciente':
        lista.sort((a, b) => {
          const fechaA = Math.max(...a.transacciones.map(t => new Date(t.fecha).getTime()));
          const fechaB = Math.max(...b.transacciones.map(t => new Date(t.fecha).getTime()));
          return fechaB - fechaA;
        });
        break;
    }
    
    // Estadísticas generales
    const totalGastos = gastosFiltrados.reduce((acc, t) => acc + t.monto, 0);
    const gastoPromedio = gastosFiltrados.length > 0 ? totalGastos / gastosFiltrados.length : 0;
    const gastoMasAlto = gastosFiltrados.length > 0 ? Math.max(...gastosFiltrados.map(t => t.monto)) : 0;
    const gastoMasBajo = gastosFiltrados.length > 0 ? Math.min(...gastosFiltrados.map(t => t.monto)) : 0;
    
    // Top 3 gastos individuales
    const top3Gastos = [...gastosFiltrados].sort((a, b) => b.monto - a.monto).slice(0, 3);
    
    // Gastos más frecuentes (3+ veces)
    const gastosRecurrentes = lista.filter(g => g.count >= 3);
    
    // Categorías con totales
    const porCategoria: Record<string, number> = {};
    gastosFiltrados.forEach(t => {
      porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + t.monto;
    });
    
    return {
      listaAgrupada: lista,
      totalGastos,
      gastoPromedio,
      gastoMasAlto,
      gastoMasBajo,
      cantidadTransacciones: gastosFiltrados.length,
      top3Gastos,
      gastosRecurrentes,
      porCategoria: Object.entries(porCategoria)
        .map(([cat, monto]) => ({ categoria: cat as CategoriaGasto, monto }))
        .sort((a, b) => b.monto - a.monto)
    };
  }, [transacciones, mes, ordenAnalisis, filtroCategAnalisis]);

  // Próximos cortes (top 3)
  const proximosCortes = useMemo(() => {
    return gastosFijos
      .filter(g => !g.pagadoEsteMes)
      .map(g => ({ ...g, diasParaCorte: calcularDiasParaCorte(g.diaCorte) }))
      .sort((a, b) => a.diasParaCorte - b.diasParaCorte)
      .slice(0, 3);
  }, [gastosFijos]);

  // Insights simplificados para resumen
  const insightsResumen = useMemo(() => {
    const lista: Array<{
      id: string;
      tipo: 'alerta' | 'consejo' | 'logro';
      titulo: string;
      descripcion: string;
    }> = [];

    if (finanzas.balance < 0) {
      lista.push({
        id: 'deficit',
        tipo: 'alerta',
        titulo: '⚠️ Estás en déficit',
        descripcion: `Gastaste ${formatearDinero(Math.abs(finanzas.balance))} más de lo que ganaste.`
      });
    }

    if (analisisFinanciero.gastosFijosPendientes.length > 0) {
      const urgentes = analisisFinanciero.gastosFijosPendientes.filter(g => calcularDiasParaCorte(g.diaCorte) <= 5);
      if (urgentes.length > 0) {
        lista.push({
          id: 'fijos-urgentes',
          tipo: 'alerta',
          titulo: `⏰ ${urgentes.length} pago${urgentes.length > 1 ? 's' : ''} próximo${urgentes.length > 1 ? 's' : ''}`,
          descripcion: `${formatearDinero(urgentes.reduce((a, g) => a + g.monto, 0))} en los próximos 5 días.`
        });
      }
    }

    if (finanzas.tasaAhorro >= 20) {
      lista.push({
        id: 'buen-ahorro',
        tipo: 'logro',
        titulo: '🌟 Vas muy bien',
        descripcion: `Estás ahorrando el ${finanzas.tasaAhorro.toFixed(0)}% de tus ingresos.`
      });
    }

    return lista.slice(0, 2);
  }, [finanzas, analisisFinanciero]);

  // =============================================
  // HANDLERS
  // =============================================

  const agregarGastoFijo = () => {
    if (!formGastoFijo.nombre || !formGastoFijo.monto) return;

    const nuevoGasto: GastoFijo = {
      id: Date.now(),
      nombre: formGastoFijo.nombre,
      monto: parseInt(formGastoFijo.monto.replace(/[^0-9]/g, '')),
      categoria: formGastoFijo.categoria,
      diaCorte: parseInt(formGastoFijo.diaCorte),
      recordatorio: true,
      pagadoEsteMes: false,
      fechaCreacion: getColombiaISO()
    };

    setGastosFijos([...gastosFijos, nuevoGasto]);
    setFormGastoFijo({ nombre: '', monto: '', categoria: 'servicios', diaCorte: '1' });
    setModalGastoFijo(false);
  };

  const eliminarGastoFijo = (id: number) => {
    if (confirm('¿Eliminar este gasto fijo?')) {
      setGastosFijos(gastosFijos.filter(g => g.id !== id));
    }
  };

  const abrirEditarGasto = (gasto: GastoFijo) => {
    setFormEditarGasto({
      nombre: gasto.nombre,
      monto: gasto.monto.toString(),
      categoria: gasto.categoria,
      diaCorte: gasto.diaCorte.toString()
    });
    setModalEditarGasto({ visible: true, gasto });
  };

  const guardarEdicionGasto = () => {
    if (!modalEditarGasto.gasto || !formEditarGasto.nombre || !formEditarGasto.monto) return;
    
    setGastosFijos(gastosFijos.map(g => 
      g.id === modalEditarGasto.gasto!.id ? {
        ...g,
        nombre: formEditarGasto.nombre,
        monto: parseInt(formEditarGasto.monto.replace(/[^0-9]/g, '')),
        categoria: formEditarGasto.categoria,
        diaCorte: parseInt(formEditarGasto.diaCorte) || 1
      } : g
    ));
    
    setModalEditarGasto({ visible: false, gasto: null });
  };

  const togglePagado = (id: number) => {
    const gasto = gastosFijos.find(g => g.id === id);
    if (!gasto) return;
    
    // Si ya está pagado, preguntar si quiere desmarcar
    if (gasto.pagadoEsteMes) {
      if (confirm('¿Desmarcar como pagado este mes?')) {
        setGastosFijos(gastosFijos.map(g => 
          g.id === id ? { 
            ...g, 
            pagadoEsteMes: false,
            mesPagado: null,
            fechaPago: null,
            montoPagadoEsteMes: null
          } : g
        ));
      }
    } else {
      // Abrir modal para registrar el pago
      setFormPagoGasto({ monto: gasto.monto.toString(), fecha: getColombiaDateOnly() });
      setModalPagoGasto({ visible: true, gasto });
    }
  };

  const registrarPagoGasto = () => {
    if (!modalPagoGasto.gasto || !formPagoGasto.monto) return;
    
    const mesActual = getColombiaDateOnly().slice(0, 7);
    const montoPagado = parseInt(formPagoGasto.monto.replace(/[^0-9]/g, ''));
    
    const nuevoPago: PagoGastoFijo = {
      id: Date.now(),
      fecha: formPagoGasto.fecha,
      montoPagado,
      mes: mesActual
    };
    
    setGastosFijos(gastosFijos.map(g => 
      g.id === modalPagoGasto.gasto!.id ? { 
        ...g, 
        pagadoEsteMes: true,
        mesPagado: mesActual,
        fechaPago: formPagoGasto.fecha,
        montoPagadoEsteMes: montoPagado,
        historialPagos: [...(g.historialPagos || []), nuevoPago]
      } : g
    ));
    
    setModalPagoGasto({ visible: false, gasto: null });
    setFormPagoGasto({ monto: '', fecha: getColombiaDateOnly() });
  };

  const agregarTransaccion = () => {
    if (!formTransaccion.descripcion || !formTransaccion.monto) return;

    const nueva: Transaccion = {
      id: Date.now(),
      descripcion: formTransaccion.descripcion,
      monto: parseInt(formTransaccion.monto.replace(/[^0-9]/g, '')),
      categoria: formTransaccion.categoria,
      tipo: modalTransaccion.tipo,
      fecha: formTransaccion.fecha,
      fechaCreacion: getColombiaISO()
    };

    setTransacciones([nueva, ...transacciones]);
    setFormTransaccion({ descripcion: '', monto: '', categoria: 'otros', fecha: getColombiaDateOnly() });
    setModalTransaccion({ visible: false, tipo: 'gasto' });
  };

  const eliminarTransaccion = (id: number) => {
    if (confirm('¿Eliminar?')) {
      setTransacciones(transacciones.filter(t => t.id !== id));
    }
  };

  const abrirEditarTransaccion = (transaccion: Transaccion) => {
    setFormEditTransaccion({
      descripcion: transaccion.descripcion,
      monto: transaccion.monto.toString(),
      categoria: transaccion.categoria,
      fecha: transaccion.fecha
    });
    setModalEditarTransaccion({ visible: true, transaccion });
  };

  const guardarEdicionTransaccion = () => {
    if (!modalEditarTransaccion.transaccion || !formEditTransaccion.descripcion || !formEditTransaccion.monto) return;

    setTransacciones(transacciones.map(t => 
      t.id === modalEditarTransaccion.transaccion!.id 
        ? { 
            ...t, 
            descripcion: formEditTransaccion.descripcion,
            monto: parseInt(formEditTransaccion.monto.replace(/[^0-9]/g, '')),
            categoria: formEditTransaccion.categoria,
            fecha: formEditTransaccion.fecha
          }
        : t
    ));
    setModalEditarTransaccion({ visible: false, transaccion: null });
  };

  // Colores para gráfica circular
  const CHART_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', 
    '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#06b6d4'
  ];

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="w-full min-h-full bg-[#0a0d14] text-white pb-20 relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="bg-[#0f1219]/80 backdrop-blur-xl border-b border-gray-800/50 sticky top-0 z-50">
        <div className="w-full px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
                <Wallet size={22} />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Finanzas Personales
                </h1>
                <p className="text-xs text-gray-500 capitalize">
                  {formatearMes(mes)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="month" 
                value={mes} 
                onChange={e => setMes(e.target.value)}
                className="bg-[#1a1f33]/80 backdrop-blur border border-gray-700/50 rounded-xl px-3 py-1.5 text-sm hover:border-gray-600 transition-colors"
              />
              <button 
                onClick={() => setModalConfig(true)}
                className="p-2.5 bg-[#1a1f33]/80 backdrop-blur rounded-xl hover:bg-gray-700/50 border border-gray-700/50 transition-all hover:scale-105"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>

          {/* KPIs principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="group bg-gradient-to-br from-emerald-900/40 to-emerald-900/10 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/20 hover:border-emerald-500/40 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                  <TrendingUp size={14} />
                </div>
                <span className="text-xs uppercase font-medium">Ingresos</span>
              </div>
              <p className="text-2xl font-bold font-mono">{formatearDineroCorto(finanzas.totalIngresos)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Negocio: {formatearDineroCorto(finanzas.ingresosNegocio)} | Otros: {formatearDineroCorto(finanzas.ingresosExtra)}
              </p>
            </div>

            <div className="group bg-gradient-to-br from-red-900/40 to-red-900/10 backdrop-blur-sm rounded-xl p-4 border border-red-500/20 hover:border-red-500/40 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/10">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <div className="p-1.5 bg-red-500/20 rounded-lg">
                  <TrendingDown size={14} />
                </div>
                <span className="text-xs uppercase font-medium">Gastos</span>
              </div>
              <p className="text-2xl font-bold font-mono">{formatearDineroCorto(finanzas.totalGastos)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Fijos: {formatearDineroCorto(finanzas.totalGastosFijos)} | Var: {formatearDineroCorto(finanzas.gastosVariables)}
              </p>
            </div>

            <div className={`group backdrop-blur-sm rounded-xl p-4 border transition-all hover:scale-[1.02] ${
              finanzas.balance >= 0 
                ? 'bg-gradient-to-br from-blue-900/40 to-blue-900/10 border-blue-500/20 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10' 
                : 'bg-gradient-to-br from-orange-900/40 to-orange-900/10 border-orange-500/20 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${finanzas.balance >= 0 ? 'bg-blue-500/20' : 'bg-orange-500/20'}`}>
                  <DollarSign size={14} className={finanzas.balance >= 0 ? 'text-blue-400' : 'text-orange-400'} />
                </div>
                <span className="text-xs uppercase font-medium text-gray-400">Balance</span>
              </div>
              <p className={`text-2xl font-bold font-mono ${finanzas.balance >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                {finanzas.balance >= 0 ? '+' : ''}{formatearDineroCorto(finanzas.balance)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {finanzas.totalIngresos > 0 ? `${finanzas.porcentajeGastos.toFixed(0)}% de ingresos en gastos` : 'Sin ingresos este mes'}
              </p>
            </div>

            <div className="group bg-gradient-to-br from-purple-900/40 to-purple-900/10 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/10">
              <div className="flex items-center gap-2 text-purple-400 mb-2">
                <div className="p-1.5 bg-purple-500/20 rounded-lg">
                  <PiggyBank size={14} />
                </div>
                <span className="text-xs uppercase font-medium">{metaAhorro.activa ? 'Meta Ahorro' : 'Tasa Ahorro'}</span>
              </div>
              <p className="text-2xl font-bold font-mono">
                {metaAhorro.activa
                  ? `${Math.min(100, analisisFinanciero.progresoMeta).toFixed(0)}%`
                  : `${finanzas.tasaAhorro.toFixed(0)}%`
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {metaAhorro.activa
                  ? `${formatearDineroCorto(Math.max(0, finanzas.balance))} / ${formatearDineroCorto(metaAhorro.monto)}`
                  : 'Del ingreso total'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="w-full px-4 lg:px-6 flex gap-1 border-t border-gray-800/50 bg-[#0f1219]/60 backdrop-blur-sm overflow-x-auto">
          {[
            { id: 'resumen', label: 'Resumen' },
            { id: 'metas', label: `Metas (${metasFinancieras.length})`, highlight: metasFinancieras.some(m => m.activa && (m.montoActual / m.montoObjetivo) >= 0.9) },
            { id: 'insights', label: 'Insights', highlight: analisisFinanciero.esMesActual && (analisisFinanciero.faltaParaMeta > 0 || analisisFinanciero.dineroDisponibleReal < 0) },
            { id: 'analisis', label: 'Análisis Gastos' },
            { id: 'fijos', label: `Gastos Fijos (${gastosFijos.length})` },
            { id: 'movimientos', label: `Movimientos (${transaccionesFiltradas.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                tab === t.id 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-gray-500 hover:text-white'
              }`}
            >
              {t.label}
              {t.highlight && tab !== t.id && (
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="w-full px-4 lg:px-6 py-6">
        
        {/* TAB: RESUMEN */}
        {tab === 'resumen' && (
          <div className="space-y-6">
            {/* Alertas rápidas */}
            {insightsResumen.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {insightsResumen.map(insight => (
                  <div 
                    key={insight.id}
                    className={`rounded-xl p-4 border ${
                      insight.tipo === 'alerta' 
                        ? 'bg-red-900/20 border-red-500/30' 
                        : insight.tipo === 'logro'
                        ? 'bg-emerald-900/20 border-emerald-500/30'
                        : 'bg-amber-900/20 border-amber-500/30'
                    }`}
                  >
                    <p className={`font-medium ${
                      insight.tipo === 'alerta' ? 'text-red-400' : 
                      insight.tipo === 'logro' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {insight.titulo}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{insight.descripcion}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Alertas urgentes de gastos fijos */}
            {proximosCortes.length > 0 && proximosCortes.some(g => g.diasParaCorte <= 3) && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="text-red-400" size={18} />
                  <span className="text-red-400 font-medium">Gastos por vencer</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {proximosCortes.filter(g => g.diasParaCorte <= 3).map(g => (
                    <div key={g.id} className="bg-red-900/30 rounded-lg p-2 flex justify-between items-center">
                      <span className="text-sm">{g.nombre}</span>
                      <div className="text-right">
                        <span className="text-red-400 font-mono text-sm">{formatearDinero(g.monto)}</span>
                        <span className="text-xs text-gray-500 block">
                          {g.diasParaCorte === 0 ? 'Hoy' : g.diasParaCorte === 1 ? 'Mañana' : `${g.diasParaCorte} días`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grid principal */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Distribución de gastos */}
              <div className="lg:col-span-5 bg-[#1a1f33] rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">¿En qué se va tu dinero?</h3>
                  <button 
                    onClick={() => setExpandirCateg(!expandirCateg)}
                    className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
                  >
                    {expandirCateg ? 'Menos' : 'Todo'}
                    {expandirCateg ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                
                {gastosPorCategoria.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay gastos registrados</p>
                ) : (
                  <div className="space-y-3">
                    {(expandirCateg ? gastosPorCategoria : gastosPorCategoria.slice(0, 5)).map((item, idx) => {
                      const cat = CATEGORIAS_GASTO[item.categoria as CategoriaGasto] || CATEGORIAS_GASTO.otros;
                      const CatIcon = cat.icon;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                            <CatIcon size={16} className="text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-300">{cat.nombre}</span>
                                {item.montoAnterior > 0 && Math.abs(item.cambio) > 10 && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    item.cambio > 0 ? 'bg-red-900/50 text-red-400' : 'bg-emerald-900/50 text-emerald-400'
                                  }`}>
                                    {item.cambio > 0 ? '+' : ''}{item.cambio.toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-sm">{formatearDinero(item.monto)}</span>
                            </div>
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                                style={{ width: `${item.porcentaje}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right shrink-0">{item.porcentaje.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top gastos específicos */}
              <div className="lg:col-span-4 bg-[#1a1f33] rounded-xl border border-gray-800 p-4">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Flame size={16} className="text-orange-400" />
                  Top Gastos del Mes
                </h3>
                {gastosDetallados.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay gastos variables</p>
                ) : (
                  <div className="space-y-2">
                    {gastosDetallados.slice(0, 6).map((gasto, idx) => {
                      const cat = CATEGORIAS_GASTO[gasto.categoria as CategoriaGasto] || CATEGORIAS_GASTO.otros;
                      const CatIcon = cat.icon;
                      const maxGasto = gastosDetallados[0]?.total || 1;
                      const porcentaje = (gasto.total / maxGasto) * 100;
                      
                      return (
                        <div key={idx} className="relative">
                          <div className="flex items-center justify-between relative z-10 py-1.5 px-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-4">{idx + 1}</span>
                              <CatIcon size={12} className="text-gray-500" />
                              <span className="text-sm truncate">{gasto.descripcion}</span>
                              {gasto.count > 1 && (
                                <span className="text-xs text-gray-600">x{gasto.count}</span>
                              )}
                            </div>
                            <span className="font-mono text-sm font-medium">{formatearDineroCorto(gasto.total)}</span>
                          </div>
                          <div 
                            className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-transparent rounded"
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                {gastosDetallados.length > 0 && (
                  <button 
                    onClick={() => setTab('insights')}
                    className="mt-3 text-xs text-blue-400 hover:text-blue-300 w-full text-center"
                  >
                    Ver análisis completo →
                  </button>
                )}
              </div>

              {/* Panel derecho */}
              <div className="lg:col-span-3 space-y-4">
                {/* Progreso gastos fijos */}
                <div className="bg-[#1a1f33] rounded-xl border border-gray-800 p-4">
                  <h3 className="font-bold mb-3">Gastos Fijos</h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Pagados</span>
                    <span className="text-sm">{statsGastosFijos.pagados}/{statsGastosFijos.total}</span>
                  </div>
                  <div className="h-3 bg-gray-800 rounded-full overflow-hidden mb-3">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${statsGastosFijos.total > 0 ? (statsGastosFijos.pagados / statsGastosFijos.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-400">{formatearDineroCorto(statsGastosFijos.pagadosMonto)}</span>
                    <span className="text-amber-400">{formatearDineroCorto(statsGastosFijos.pendientesMonto)}</span>
                  </div>
                </div>

                {/* Meta de ahorro */}
                {metaAhorro.activa && (
                  <div className="bg-[#1a1f33] rounded-xl border border-gray-800 p-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <Target size={16} className="text-pink-400" />
                      Meta Ahorro
                    </h3>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Progreso</span>
                      <span className="text-sm font-mono">
                        {Math.min(100, analisisFinanciero.progresoMeta).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden mb-2">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          analisisFinanciero.progresoMeta >= 100 ? 'bg-emerald-500' : 'bg-pink-500'
                        }`}
                        style={{ width: `${Math.min(100, analisisFinanciero.progresoMeta)}%` }}
                      />
                    </div>
                    <p className="text-xs text-center text-gray-500">
                      {formatearDineroCorto(Math.max(0, finanzas.balance))} / {formatearDineroCorto(metaAhorro.monto)}
                    </p>
                  </div>
                )}

                {/* vs Mes Anterior */}
                {finanzasMesAnterior.totalIngresos > 0 && (
                  <div className="bg-[#1a1f33] rounded-xl border border-gray-800 p-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <Sparkles size={16} className="text-purple-400" />
                      vs Mes Anterior
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ingresos</span>
                        <span className={finanzas.totalIngresos >= finanzasMesAnterior.totalIngresos ? 'text-emerald-400' : 'text-red-400'}>
                          {finanzas.totalIngresos >= finanzasMesAnterior.totalIngresos ? '+' : ''}
                          {formatearDineroCorto(finanzas.totalIngresos - finanzasMesAnterior.totalIngresos)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Gastos Var.</span>
                        <span className={finanzas.gastosVariables <= finanzasMesAnterior.gastosVariables ? 'text-emerald-400' : 'text-red-400'}>
                          {finanzas.gastosVariables > finanzasMesAnterior.gastosVariables ? '+' : ''}
                          {formatearDineroCorto(finanzas.gastosVariables - finanzasMesAnterior.gastosVariables)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Próximos cortes */}
                {proximosCortes.length > 0 && (
                  <div className="bg-[#1a1f33] rounded-xl border border-gray-800 p-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <Clock size={16} className="text-orange-400" />
                      Próximos Cortes
                    </h3>
                    <div className="space-y-2">
                      {proximosCortes.map(g => (
                        <div key={g.id} className="flex justify-between items-center text-sm">
                          <span className="text-gray-300 truncate">{g.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{formatearDineroCorto(g.monto)}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              g.diasParaCorte <= 3 ? 'bg-red-900/50 text-red-400' :
                              g.diasParaCorte <= 7 ? 'bg-orange-900/50 text-orange-400' :
                              'bg-gray-800 text-gray-400'
                            }`}>
                              {g.diasParaCorte === 0 ? 'Hoy' : `${g.diasParaCorte}d`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => setModalGastoFijo(true)}
                className="bg-[#1a1f33] border border-gray-700 hover:border-purple-500/50 rounded-xl p-4 flex items-center justify-center gap-2 transition-all"
              >
                <Receipt className="text-purple-400" size={18} />
                <span className="text-sm">+ Gasto Fijo</span>
              </button>
              <button
                onClick={() => setModalTransaccion({ visible: true, tipo: 'gasto' })}
                className="bg-[#1a1f33] border border-gray-700 hover:border-red-500/50 rounded-xl p-4 flex items-center justify-center gap-2 transition-all"
              >
                <ArrowDownRight className="text-red-400" size={18} />
                <span className="text-sm">+ Gasto</span>
              </button>
              <button
                onClick={() => setModalTransaccion({ visible: true, tipo: 'ingreso' })}
                className="bg-[#1a1f33] border border-gray-700 hover:border-emerald-500/50 rounded-xl p-4 flex items-center justify-center gap-2 transition-all"
              >
                <ArrowUpRight className="text-emerald-400" size={18} />
                <span className="text-sm">+ Ingreso</span>
              </button>
              <button
                onClick={() => setTab('insights')}
                className="bg-[#1a1f33] border border-gray-700 hover:border-blue-500/50 rounded-xl p-4 flex items-center justify-center gap-2 transition-all"
              >
                <Lightbulb className="text-blue-400" size={18} />
                <span className="text-sm">Ver Análisis</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB: ANÁLISIS MEJORADO */}
        {tab === 'insights' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-pink-900/40 rounded-2xl border border-purple-500/20 p-6">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2230%22 height=%2230%22 viewBox=%220 0 30 30%22 fill=%22none%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M1.22676 0C1.91374 0 2.45351 0.539773 2.45351 1.22676C2.45351 1.91374 1.91374 2.45351 1.22676 2.45351C0.539773 2.45351 0 1.91374 0 1.22676C0 0.539773 0.539773 0 1.22676 0Z%22 fill=%22rgba(255,255,255,0.05)%22/%3E%3C/svg%3E')] opacity-50" />
              <div className="relative">
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg">
                    <Lightbulb size={20} className="text-white" />
                  </div>
                  <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Tu Plan Financiero
                  </span>
                </h2>
                <p className="text-gray-400 text-sm capitalize">
                  {formatearMes(mes)} • {analisisFinanciero.esMesActual ? `${analisisFinanciero.diasRestantes} días restantes` : 'Mes finalizado'}
                </p>
              </div>
            </div>

            {/* PANEL PRINCIPAL: Estado actual y qué hacer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tu situación actual */}
              <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-2xl border border-gray-800 p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Zap size={18} className="text-yellow-400" />
                  Tu Situación Ahora
                </h3>
                
                <div className="space-y-4">
                  {/* Balance actual */}
                  <div className={`p-4 rounded-xl border ${
                    finanzas.balance >= 0 ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-red-900/20 border-red-500/30'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400">Balance actual</span>
                      <span className={`text-2xl font-bold font-mono ${
                        finanzas.balance >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {finanzas.balance >= 0 ? '+' : ''}{formatearDinero(finanzas.balance)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Ingresos ({formatearDineroCorto(finanzas.totalIngresos)}) - Gastos ({formatearDineroCorto(finanzas.totalGastos)})
                    </p>
                  </div>

                  {/* Gastos fijos pendientes */}
                  {analisisFinanciero.montoFijosPendientes > 0 && (
                    <div className="p-4 rounded-xl bg-amber-900/20 border border-amber-500/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400">Fijos por pagar</span>
                        <span className="text-xl font-bold font-mono text-amber-400">
                          -{formatearDinero(analisisFinanciero.montoFijosPendientes)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {analisisFinanciero.gastosFijosPendientes.length} gasto{analisisFinanciero.gastosFijosPendientes.length > 1 ? 's' : ''} pendiente{analisisFinanciero.gastosFijosPendientes.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {/* Dinero realmente disponible */}
                  <div className={`p-4 rounded-xl border ${
                    analisisFinanciero.dineroDisponibleReal >= 0 
                      ? 'bg-blue-900/20 border-blue-500/30' 
                      : 'bg-red-900/20 border-red-500/30'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400">💰 Disponible real</span>
                      <span className={`text-2xl font-bold font-mono ${
                        analisisFinanciero.dineroDisponibleReal >= 0 ? 'text-blue-400' : 'text-red-400'
                      }`}>
                        {formatearDinero(analisisFinanciero.dineroDisponibleReal)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Después de pagar los gastos fijos pendientes
                    </p>
                  </div>
                </div>
              </div>

              {/* Qué debes hacer */}
              <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-2xl border border-gray-800 p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Target size={18} className="text-pink-400" />
                  {metaAhorro.activa ? 'Para Llegar a Tu Meta' : 'Recomendaciones'}
                </h3>

                {metaAhorro.activa ? (
                  <div className="space-y-4">
                    {/* Progreso de meta */}
                    <div className="p-4 rounded-xl bg-pink-900/20 border border-pink-500/30">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-gray-400">Meta de ahorro</span>
                        <span className="font-mono font-bold text-pink-400">
                          {formatearDinero(metaAhorro.monto)}
                        </span>
                      </div>
                      <div className="h-4 bg-gray-800 rounded-full overflow-hidden mb-2">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            analisisFinanciero.progresoMeta >= 100 
                              ? 'bg-gradient-to-r from-emerald-500 to-green-400' 
                              : 'bg-gradient-to-r from-pink-500 to-purple-500'
                          }`}
                          style={{ width: `${Math.min(100, analisisFinanciero.progresoMeta)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          {analisisFinanciero.progresoMeta >= 100 ? '🎉 ¡Meta alcanzada!' : `${analisisFinanciero.progresoMeta.toFixed(0)}% logrado`}
                        </span>
                        {analisisFinanciero.faltaParaMeta > 0 && (
                          <span className="text-pink-400 font-mono">
                            Faltan {formatearDineroCorto(analisisFinanciero.faltaParaMeta)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acciones para la meta */}
                    {analisisFinanciero.faltaParaMeta > 0 && analisisFinanciero.esMesActual && analisisFinanciero.diasRestantes > 0 && (
                      <>
                        <div className="p-4 rounded-xl bg-purple-900/20 border border-purple-500/30">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                              <Ban size={16} className="text-purple-400" />
                            </div>
                            <div>
                              <p className="text-purple-400 font-medium">Gasto máximo diario</p>
                              <p className="text-xs text-gray-500">Para llegar a tu meta</p>
                            </div>
                          </div>
                          <p className="text-3xl font-bold font-mono text-white">
                            {analisisFinanciero.maximoGastoDiarioParaMeta > 0 
                              ? formatearDinero(analisisFinanciero.maximoGastoDiarioParaMeta)
                              : '$0'
                            }
                            <span className="text-sm text-gray-500 font-normal"> /día</span>
                          </p>
                          {analisisFinanciero.maximoGastoDiarioParaMeta <= 0 && (
                            <p className="text-xs text-red-400 mt-2">
                              ⚠️ No puedes gastar más si quieres llegar a tu meta
                            </p>
                          )}
                        </div>

                        {analisisFinanciero.faltaParaMeta > analisisFinanciero.dineroDisponibleReal && (
                          <div className="p-4 rounded-xl bg-amber-900/20 border border-amber-500/30">
                            <p className="text-amber-400 font-medium mb-2">💡 Necesitas más ingresos</p>
                            <p className="text-sm text-gray-400">
                              Para llegar a tu meta necesitas{' '}
                              <span className="font-mono text-white">
                                {formatearDinero(analisisFinanciero.faltaParaMeta - Math.max(0, analisisFinanciero.dineroDisponibleReal))}
                              </span>
                              {' '}adicionales
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {analisisFinanciero.progresoMeta >= 100 && (
                      <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/30 text-center">
                        <p className="text-4xl mb-2">🎉</p>
                        <p className="text-emerald-400 font-bold text-lg">¡Felicitaciones!</p>
                        <p className="text-gray-400 text-sm">
                          Lograste ahorrar {formatearDinero(Math.max(0, finanzas.balance))}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-blue-900/20 border border-blue-500/30">
                      <p className="text-blue-400 font-medium mb-2">💡 Configura una meta</p>
                      <p className="text-sm text-gray-400 mb-3">
                        Tener una meta te ayuda a controlar tus gastos y ahorrar más
                      </p>
                      <button
                        onClick={() => setModalConfig(true)}
                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        Configurar meta <ArrowRight size={14} />
                      </button>
                    </div>

                    {analisisFinanciero.esMesActual && analisisFinanciero.diasRestantes > 0 && (
                      <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                        <p className="text-gray-400 font-medium mb-2">Gasto seguro por día</p>
                        <p className="text-2xl font-bold font-mono text-white">
                          {formatearDinero(analisisFinanciero.gastoDiarioSeguro)}
                          <span className="text-sm text-gray-500 font-normal"> /día</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Para no quedar en déficit
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* CONSEJOS ESPECÍFICOS */}
            <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-2xl border border-gray-800 p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Scissors size={18} className="text-red-400" />
                Dónde Puedes Recortar
              </h3>

              {gastosDetallados.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No hay gastos variables para analizar</p>
              ) : (
                <div className="space-y-4">
                  {/* Top 3 gastos más grandes evitables */}
                  {analisisFinanciero.gastosEvitables.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-400 mb-3">🎯 Tus mayores gastos evitables</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {analisisFinanciero.gastosEvitables.slice(0, 3).map((gasto, idx) => {
                          const reduccion50 = gasto.total * 0.5;
                          return (
                            <div key={idx} className="p-4 rounded-xl bg-red-900/10 border border-red-500/20 hover:border-red-500/40 transition-all">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium truncate">{gasto.descripcion}</span>
                                {gasto.count > 1 && (
                                  <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                                    x{gasto.count}
                                  </span>
                                )}
                              </div>
                              <p className="text-xl font-bold font-mono text-white mb-2">
                                {formatearDinero(gasto.total)}
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">Si reduces 50%:</span>
                                <span className="text-emerald-400 font-mono">+{formatearDineroCorto(reduccion50)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Gastos hormiga */}
                  {analisisFinanciero.gastosHormiga.length > 0 && (
                    <div className="mt-6 p-4 rounded-xl bg-amber-900/10 border border-amber-500/20">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg shrink-0">
                          <Coffee size={18} className="text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium text-amber-400 mb-1">Gastos hormiga detectados</p>
                          <p className="text-sm text-gray-400 mb-3">
                            Pequeños gastos frecuentes que suman{' '}
                            <span className="font-mono text-white">{formatearDinero(analisisFinanciero.totalGastosHormiga)}</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {analisisFinanciero.gastosHormiga.map((g, idx) => (
                              <span key={idx} className="text-xs bg-amber-900/30 text-amber-300 px-2 py-1 rounded">
                                {g.descripcion} ({g.count}x = {formatearDineroCorto(g.total)})
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Categoría que más creció */}
                  {analisisFinanciero.categoriaQueMasSubio && (
                    <div className="mt-4 p-4 rounded-xl bg-red-900/10 border border-red-500/20">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
                          <TrendUp size={18} className="text-red-400" />
                        </div>
                        <div>
                          <p className="font-medium text-red-400 mb-1">
                            {CATEGORIAS_GASTO[analisisFinanciero.categoriaQueMasSubio.categoria as CategoriaGasto]?.nombre || analisisFinanciero.categoriaQueMasSubio.categoria} subió mucho
                          </p>
                          <p className="text-sm text-gray-400">
                            Gastaste{' '}
                            <span className="font-mono text-white">
                              {formatearDinero(analisisFinanciero.categoriaQueMasSubio.monto - analisisFinanciero.categoriaQueMasSubio.montoAnterior)}
                            </span>
                            {' '}más que el mes pasado (+{analisisFinanciero.categoriaQueMasSubio.cambio.toFixed(0)}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Si no hay nada que recortar */}
                  {analisisFinanciero.gastosEvitables.length === 0 && analisisFinanciero.gastosHormiga.length === 0 && (
                    <div className="p-6 rounded-xl bg-emerald-900/10 border border-emerald-500/20 text-center">
                      <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                      <p className="text-emerald-400 font-medium">¡Bien hecho!</p>
                      <p className="text-sm text-gray-400">
                        No encontré gastos innecesarios significativos
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RESUMEN RÁPIDO */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-[#1a1f33] border border-gray-800 text-center">
                <p className="text-xs text-gray-500 mb-1">Días restantes</p>
                <p className="text-2xl font-bold text-white">{analisisFinanciero.diasRestantes}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#1a1f33] border border-gray-800 text-center">
                <p className="text-xs text-gray-500 mb-1">Gasto diario actual</p>
                <p className="text-2xl font-bold text-white font-mono">
                  {formatearDineroCorto(analisisFinanciero.gastoVariableDiario)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#1a1f33] border border-gray-800 text-center">
                <p className="text-xs text-gray-500 mb-1">Tasa de ahorro</p>
                <p className={`text-2xl font-bold ${finanzas.tasaAhorro >= 20 ? 'text-emerald-400' : finanzas.tasaAhorro >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {finanzas.tasaAhorro.toFixed(0)}%
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#1a1f33] border border-gray-800 text-center">
                <p className="text-xs text-gray-500 mb-1">Fijos pendientes</p>
                <p className="text-2xl font-bold text-amber-400">{analisisFinanciero.gastosFijosPendientes.length}</p>
              </div>
            </div>

            {/* DISTRIBUCIÓN VISUAL */}
            {gastosPorCategoria.length > 0 && (
              <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-2xl border border-gray-800 p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <ShoppingBag size={18} className="text-blue-400" />
                  Distribución de Gastos
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {gastosPorCategoria.slice(0, 6).map((cat, idx) => {
                    const catInfo = CATEGORIAS_GASTO[cat.categoria as CategoriaGasto] || CATEGORIAS_GASTO.otros;
                    const CatIcon = catInfo.icon;
                    return (
                      <div 
                        key={idx} 
                        className="p-4 rounded-xl bg-gray-800/50 border border-gray-700 text-center hover:border-gray-600 transition-all"
                      >
                        <div 
                          className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${CHART_COLORS[idx % CHART_COLORS.length]}20` }}
                        >
                          <span style={{ color: CHART_COLORS[idx % CHART_COLORS.length] }}><CatIcon size={22} /></span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1 truncate">{catInfo.nombre}</p>
                        <p className="font-mono font-bold text-white">{formatearDineroCorto(cat.monto)}</p>
                        <p className="text-xs text-gray-600">{cat.porcentaje.toFixed(0)}%</p>
                        {cat.montoAnterior > 0 && Math.abs(cat.cambio) > 10 && (
                          <p className={`text-xs mt-1 ${cat.cambio > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {cat.cambio > 0 ? '↑' : '↓'} {Math.abs(cat.cambio).toFixed(0)}%
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: GASTOS FIJOS */}
        {tab === 'fijos' && (
          <div className="space-y-4">
            {/* Barra de acciones */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={filtroPagado}
                  onChange={e => setFiltroPagado(e.target.value as typeof filtroPagado)}
                  className="bg-[#1a1f33] border border-gray-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="todos">Todos</option>
                  <option value="pendientes">Pendientes</option>
                  <option value="pagados">Pagados</option>
                </select>
                <span className="text-sm text-gray-500">{gastosFijosConDias.length} gastos</span>
              </div>
              <button
                onClick={() => setModalGastoFijo(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
              >
                <Plus size={16} /> Agregar
              </button>
            </div>

            {/* Resumen rápido */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1a1f33] rounded-lg p-3 border border-gray-800">
                <p className="text-xs text-gray-500 mb-1">Total mensual</p>
                <p className="font-bold font-mono">{formatearDinero(statsGastosFijos.totalMonto)}</p>
              </div>
              <div className="bg-[#1a1f33] rounded-lg p-3 border border-emerald-500/30">
                <p className="text-xs text-gray-500 mb-1">Pagados ({statsGastosFijos.pagados})</p>
                <p className="font-bold font-mono text-emerald-400">{formatearDinero(statsGastosFijos.pagadosMonto)}</p>
              </div>
              <div className="bg-[#1a1f33] rounded-lg p-3 border border-amber-500/30">
                <p className="text-xs text-gray-500 mb-1">Pendientes ({statsGastosFijos.pendientes})</p>
                <p className="font-bold font-mono text-amber-400">{formatearDinero(statsGastosFijos.pendientesMonto)}</p>
              </div>
            </div>

            {/* Lista */}
            {gastosFijosConDias.length === 0 ? (
              <div className="text-center py-16 bg-[#1a1f33] rounded-xl border border-gray-800">
                <Receipt size={40} className="mx-auto mb-3 text-gray-700" />
                <p className="text-gray-500 mb-3">No hay gastos fijos</p>
                <button 
                  onClick={() => setModalGastoFijo(true)}
                  className="text-emerald-400 hover:text-emerald-300 text-sm"
                >
                  + Agregar gasto fijo
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {gastosFijosConDias.map(gasto => {
                  const cat = CATEGORIAS_GASTO[gasto.categoria] || CATEGORIAS_GASTO.otros;
                  const CatIcon = cat.icon;
                  const recibosPendientes = calcularRecibosPendientes(gasto);

                  return (
                    <div 
                      key={gasto.id} 
                      className={`bg-[#1a1f33] rounded-xl border p-4 transition-all ${
                        recibosPendientes.cantidad > 1 ? 'border-red-500/50 shadow-lg shadow-red-500/10' :
                        gasto.pagadoEsteMes ? 'border-emerald-500/30 opacity-75' : 
                        gasto.diasParaCorte <= 3 ? 'border-red-500/30' :
                        gasto.diasParaCorte <= 7 ? 'border-orange-500/30' : 'border-gray-800'
                      }`}
                    >
                      {/* Alerta de recibos atrasados */}
                      {recibosPendientes.cantidad > 1 && (
                        <div className="mb-3 p-2 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-red-400" />
                            <span className="text-sm text-red-400 font-medium">
                              ¡Debes {recibosPendientes.cantidad} recibos!
                            </span>
                          </div>
                          <span className="font-mono font-bold text-red-400">
                            ≈ {formatearDinero(recibosPendientes.montoEstimado)}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            gasto.pagadoEsteMes ? 'bg-emerald-900/30 text-emerald-400' : 'bg-gray-800 text-gray-400'
                          }`}>
                            <CatIcon size={18} />
                          </div>
                          <div>
                            <p className={`font-medium ${gasto.pagadoEsteMes ? 'line-through text-gray-500' : ''}`}>
                              {gasto.nombre}
                            </p>
                            <p className="text-xs text-gray-500">
                              {cat.nombre} • Corte día {gasto.diaCorte}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold font-mono">{formatearDinero(gasto.monto)}</p>
                            {!gasto.pagadoEsteMes && recibosPendientes.cantidad <= 1 && (
                              <p className={`text-xs ${
                                gasto.diasParaCorte <= 3 ? 'text-red-400' :
                                gasto.diasParaCorte <= 7 ? 'text-orange-400' : 'text-gray-500'
                              }`}>
                                {gasto.diasParaCorte === 0 ? '¡Hoy!' : 
                                 gasto.diasParaCorte === 1 ? 'Mañana' : 
                                 gasto.diasParaCorte < 0 ? `Hace ${Math.abs(gasto.diasParaCorte)} días` :
                                 `En ${gasto.diasParaCorte} días`}
                              </p>
                            )}
                            {gasto.pagadoEsteMes && (
                              <span className="text-xs text-emerald-400">✓ Pagado</span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => togglePagado(gasto.id)}
                              className={`p-2 rounded-lg transition-all ${
                                gasto.pagadoEsteMes 
                                  ? 'bg-emerald-600 text-white' 
                                  : 'bg-gray-800 text-gray-400 hover:text-emerald-400'
                              }`}
                              title={gasto.pagadoEsteMes ? 'Desmarcar pago' : 'Registrar pago'}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => abrirEditarGasto(gasto)}
                              className="p-2 rounded-lg bg-gray-800 text-gray-500 hover:text-purple-400"
                              title="Editar"
                            >
                              <Edit2 size={16} />
                            </button>
                            {gasto.historialPagos && gasto.historialPagos.length > 0 && (
                              <button
                                onClick={() => setModalHistorialGasto({ visible: true, gasto })}
                                className="p-2 rounded-lg bg-gray-800 text-gray-500 hover:text-blue-400"
                                title="Ver historial"
                              >
                                <History size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => eliminarGastoFijo(gasto.id)}
                              className="p-2 rounded-lg bg-gray-800 text-gray-500 hover:text-red-400"
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Info del pago de este mes */}
                      {gasto.pagadoEsteMes && gasto.fechaPago && (
                        <div className="mt-3 pt-3 border-t border-gray-700/50 flex justify-between items-center text-xs">
                          <span className="text-gray-500">
                            Pagado el {gasto.fechaPago}
                          </span>
                          {gasto.montoPagadoEsteMes && (
                            <span className="font-mono text-emerald-400">
                              {formatearDinero(gasto.montoPagadoEsteMes)}
                              {gasto.montoPagadoEsteMes !== gasto.monto && (
                                <span className={`ml-1 ${gasto.montoPagadoEsteMes > gasto.monto ? 'text-red-400' : 'text-emerald-400'}`}>
                                  ({gasto.montoPagadoEsteMes > gasto.monto ? '+' : ''}{formatearDinero(gasto.montoPagadoEsteMes - gasto.monto)})
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: MOVIMIENTOS */}
        {tab === 'movimientos' && (
          <div className="space-y-4">
            {/* Barra de acciones */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="w-full bg-[#1a1f33] border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm"
                />
              </div>

              <div className="flex bg-[#1a1f33] rounded-lg p-1 border border-gray-700">
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'ingresos', label: 'Ingresos' },
                  { id: 'gastos', label: 'Gastos' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFiltroTipo(f.id as typeof filtroTipo)}
                    className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                      filtroTipo === f.id ? 'bg-gray-700 text-white' : 'text-gray-500'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => setModalTransaccion({ visible: true, tipo: 'gasto' })}
                  className="bg-red-600/20 text-red-400 border border-red-500/30 px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm"
                >
                  <ArrowDownRight size={14} /> Gasto
                </button>
                <button
                  onClick={() => setModalTransaccion({ visible: true, tipo: 'ingreso' })}
                  className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm"
                >
                  <ArrowUpRight size={14} /> Ingreso
                </button>
              </div>
            </div>

            {/* Lista */}
            {transaccionesFiltradas.length === 0 ? (
              <div className="text-center py-16 bg-[#1a1f33] rounded-xl border border-gray-800">
                <Calendar size={40} className="mx-auto mb-3 text-gray-700" />
                <p className="text-gray-500 mb-3">No hay movimientos</p>
                <div className="flex justify-center gap-3">
                  <button 
                    onClick={() => setModalTransaccion({ visible: true, tipo: 'gasto' })}
                    className="text-red-400 text-sm"
                  >
                    + Gasto
                  </button>
                  <button 
                    onClick={() => setModalTransaccion({ visible: true, tipo: 'ingreso' })}
                    className="text-emerald-400 text-sm"
                  >
                    + Ingreso
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {transaccionesFiltradas.map(t => {
                  const cat = CATEGORIAS_GASTO[t.categoria] || CATEGORIAS_GASTO.otros;
                  const CatIcon = cat.icon;
                  const esIngreso = t.tipo === 'ingreso';

                  return (
                    <div 
                      key={t.id}
                      className={`bg-[#1a1f33] rounded-xl border p-4 flex items-center justify-between ${
                        esIngreso ? 'border-emerald-500/20' : 'border-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          esIngreso ? 'bg-emerald-900/30 text-emerald-400' : 'bg-gray-800 text-gray-400'
                        }`}>
                          {esIngreso ? <ArrowUpRight size={18} /> : <CatIcon size={18} />}
                        </div>
                        <div>
                          <p className="font-medium">{t.descripcion}</p>
                          <p className="text-xs text-gray-500">{cat.nombre} • {t.fecha}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <p className={`font-bold font-mono ${esIngreso ? 'text-emerald-400' : ''}`}>
                          {esIngreso ? '+' : '-'}{formatearDinero(t.monto)}
                        </p>
                        <button
                          onClick={() => abrirEditarTransaccion(t)}
                          className="p-2 rounded-lg bg-gray-800 text-gray-500 hover:text-blue-400 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => eliminarTransaccion(t.id)}
                          className="p-2 rounded-lg bg-gray-800 text-gray-500 hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resumen del filtro */}
            {transaccionesFiltradas.length > 0 && (
              <div className="bg-[#1a1f33] rounded-xl border border-gray-800 p-4 flex items-center justify-between">
                <span className="text-sm text-gray-400">{transaccionesFiltradas.length} transacciones</span>
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-400">
                    +{formatearDinero(transaccionesFiltradas.filter(t => t.tipo === 'ingreso').reduce((a, t) => a + t.monto, 0))}
                  </span>
                  <span className="text-red-400">
                    -{formatearDinero(transaccionesFiltradas.filter(t => t.tipo === 'gasto').reduce((a, t) => a + t.monto, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: ANÁLISIS DE GASTOS */}
        {tab === 'analisis' && (
          <div className="space-y-6">
            {/* Controles de filtrado y ordenamiento */}
            <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-2xl border border-gray-800 p-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Ordenar por */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown size={16} className="text-gray-500" />
                  <select
                    value={ordenAnalisis}
                    onChange={e => setOrdenAnalisis(e.target.value as typeof ordenAnalisis)}
                    className="bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="mayor">Mayor gasto</option>
                    <option value="menor">Menor gasto</option>
                    <option value="frecuente">Más frecuente</option>
                    <option value="reciente">Más reciente</option>
                  </select>
                </div>

                {/* Filtro por categoría */}
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-500" />
                  <select
                    value={filtroCategAnalisis}
                    onChange={e => setFiltroCategAnalisis(e.target.value as typeof filtroCategAnalisis)}
                    className="bg-[#0f111a] border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="todas">Todas las categorías</option>
                    {Object.entries(CATEGORIAS_GASTO).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>

                <span className="text-sm text-gray-500 ml-auto">
                  {analisisGastos.cantidadTransacciones} transacciones
                </span>
              </div>
            </div>

            {/* Resumen estadístico */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-xl border border-gray-800 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Total Gastos</p>
                <p className="text-xl font-bold font-mono text-red-400">{formatearDinero(analisisGastos.totalGastos)}</p>
              </div>
              <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-xl border border-gray-800 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Promedio</p>
                <p className="text-xl font-bold font-mono text-amber-400">{formatearDineroCorto(analisisGastos.gastoPromedio)}</p>
              </div>
              <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-xl border border-gray-800 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Gasto Más Alto</p>
                <p className="text-xl font-bold font-mono text-red-500">{formatearDineroCorto(analisisGastos.gastoMasAlto)}</p>
              </div>
              <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-xl border border-gray-800 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Gasto Más Bajo</p>
                <p className="text-xl font-bold font-mono text-emerald-400">{formatearDineroCorto(analisisGastos.gastoMasBajo)}</p>
              </div>
            </div>

            {/* Top 3 gastos individuales */}
            {analisisGastos.top3Gastos.length > 0 && (
              <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-2xl border border-gray-800 p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <TrendingUp size={16} className="text-red-400" />
                  </div>
                  Top 3 Gastos Más Altos
                </h3>
                <div className="space-y-3">
                  {analisisGastos.top3Gastos.map((gasto, idx) => {
                    const cat = CATEGORIAS_GASTO[gasto.categoria] || CATEGORIAS_GASTO.otros;
                    const CatIcon = cat.icon;
                    const medallas = ['🥇', '🥈', '🥉'];
                    return (
                      <div 
                        key={gasto.id} 
                        className="flex items-center justify-between bg-gray-800/30 rounded-xl p-3 border border-gray-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{medallas[idx]}</span>
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-800">
                            <CatIcon size={16} className="text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium">{gasto.descripcion}</p>
                            <p className="text-xs text-gray-500">{cat.nombre} • {gasto.fecha}</p>
                          </div>
                        </div>
                        <p className="font-bold font-mono text-red-400">{formatearDinero(gasto.monto)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Gastos recurrentes */}
            {analisisGastos.gastosRecurrentes.length > 0 && (
              <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-2xl border border-amber-500/30 p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Repeat size={16} className="text-amber-400" />
                  </div>
                  Gastos Recurrentes
                  <span className="text-xs text-gray-500 font-normal ml-2">(3+ veces en el mes)</span>
                </h3>
                <div className="space-y-3">
                  {analisisGastos.gastosRecurrentes.map((gasto, idx) => {
                    const cat = CATEGORIAS_GASTO[gasto.categoria] || CATEGORIAS_GASTO.otros;
                    const CatIcon = cat.icon;
                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between bg-gray-800/30 rounded-xl p-3 border border-gray-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-900/30">
                            <CatIcon size={16} className="text-amber-400" />
                          </div>
                          <div>
                            <p className="font-medium">{gasto.descripcion}</p>
                            <p className="text-xs text-gray-500">
                              <span className="text-amber-400">{gasto.count}x</span> • Promedio: {formatearDineroCorto(gasto.promedioMonto)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold font-mono text-amber-400">{formatearDinero(gasto.total)}</p>
                          <p className="text-xs text-gray-500">total</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Distribución por categoría */}
            {analisisGastos.porCategoria.length > 0 && (
              <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-2xl border border-gray-800 p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <BarChart3 size={16} className="text-blue-400" />
                  </div>
                  Por Categoría
                </h3>
                <div className="space-y-3">
                  {analisisGastos.porCategoria.map((item, idx) => {
                    const cat = CATEGORIAS_GASTO[item.categoria] || CATEGORIAS_GASTO.otros;
                    const CatIcon = cat.icon;
                    const porcentaje = analisisGastos.totalGastos > 0 
                      ? (item.monto / analisisGastos.totalGastos) * 100 
                      : 0;
                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span style={{ color: CHART_COLORS[idx % CHART_COLORS.length] }}><CatIcon size={14} /></span>
                            <span className="text-sm">{cat.nombre}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{porcentaje.toFixed(1)}%</span>
                            <span className="font-mono font-medium">{formatearDinero(item.monto)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${porcentaje}%`, 
                              backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] 
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lista completa de gastos agrupados */}
            <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] rounded-2xl border border-gray-800 p-5">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  {ordenAnalisis === 'mayor' && <SortDesc size={16} className="text-purple-400" />}
                  {ordenAnalisis === 'menor' && <SortAsc size={16} className="text-purple-400" />}
                  {ordenAnalisis === 'frecuente' && <Hash size={16} className="text-purple-400" />}
                  {ordenAnalisis === 'reciente' && <Clock size={16} className="text-purple-400" />}
                </div>
                Todos los Gastos
                <span className="text-xs text-gray-500 font-normal ml-2">
                  ({ordenAnalisis === 'mayor' ? 'Mayor a menor' : 
                    ordenAnalisis === 'menor' ? 'Menor a mayor' : 
                    ordenAnalisis === 'frecuente' ? 'Por frecuencia' : 'Más recientes'})
                </span>
              </h3>
              
              {analisisGastos.listaAgrupada.length === 0 ? (
                <div className="text-center py-10">
                  <ShoppingBag size={40} className="mx-auto mb-3 text-gray-700" />
                  <p className="text-gray-500">No hay gastos en este período</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {analisisGastos.listaAgrupada.map((gasto, idx) => {
                    const cat = CATEGORIAS_GASTO[gasto.categoria] || CATEGORIAS_GASTO.otros;
                    const CatIcon = cat.icon;
                    const porcentaje = analisisGastos.totalGastos > 0 
                      ? (gasto.total / analisisGastos.totalGastos) * 100 
                      : 0;
                    
                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between bg-gray-800/30 rounded-xl p-3 border border-gray-700/50 hover:border-gray-600 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-800">
                            <CatIcon size={18} className="text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium">{gasto.descripcion}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{cat.nombre}</span>
                              {gasto.count > 1 && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-400">{gasto.count} veces</span>
                                </>
                              )}
                              <span>•</span>
                              <span>{porcentaje.toFixed(1)}% del total</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold font-mono">{formatearDinero(gasto.total)}</p>
                          {gasto.count > 1 && (
                            <p className="text-xs text-gray-500">~{formatearDineroCorto(gasto.promedioMonto)} c/u</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: METAS FINANCIERAS */}
        {tab === 'metas' && (
          <div className="space-y-6">
            {/* Header con resumen */}
            {(() => {
              // Calcular totales usando el sistema de bolsillos
              const totalAhorrado = metasFinancieras.reduce((sum, m) => {
                const { saldoTotal } = calcularTotalesMeta(m);
                return sum + saldoTotal;
              }, 0);
              const totalObjetivo = metasFinancieras.filter(m => m.activa).reduce((sum, m) => sum + m.montoObjetivo, 0);
              const rendimientoMensualTotal = metasFinancieras.reduce((sum, m) => {
                const { rendimientoMensualTotal } = calcularTotalesMeta(m);
                return sum + rendimientoMensualTotal;
              }, 0);
              
              return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-900/10 rounded-xl p-4 border border-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Target size={16} />
                    <span className="text-xs font-medium">Total Metas</span>
                  </div>
                  <p className="text-2xl font-bold">{metasFinancieras.filter(m => m.activa).length}</p>
                  <p className="text-xs text-gray-500">activas</p>
                </div>
                <div className="bg-gradient-to-br from-blue-900/40 to-blue-900/10 rounded-xl p-4 border border-blue-500/20">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <PiggyBank size={16} />
                    <span className="text-xs font-medium">Ahorrado</span>
                  </div>
                  <p className="text-2xl font-bold font-mono">{formatearDineroCorto(totalAhorrado)}</p>
                  <p className="text-xs text-gray-500">en bolsillos</p>
                </div>
                <div className="bg-gradient-to-br from-purple-900/40 to-purple-900/10 rounded-xl p-4 border border-purple-500/20">
                  <div className="flex items-center gap-2 text-purple-400 mb-2">
                    <Gem size={16} />
                    <span className="text-xs font-medium">Objetivo Total</span>
                  </div>
                  <p className="text-2xl font-bold font-mono">{formatearDineroCorto(totalObjetivo)}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-900/40 to-amber-900/10 rounded-xl p-4 border border-amber-500/20">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <Percent size={16} />
                    <span className="text-xs font-medium">Rendimiento Est.</span>
                  </div>
                  <p className="text-2xl font-bold font-mono">
                    {formatearDineroCorto(rendimientoMensualTotal)}
                  </p>
                  <p className="text-xs text-gray-500">/mes</p>
                </div>
              </div>
              );
            })()}

            {/* Botón agregar */}
            <button
              onClick={() => {
                setFormMeta({
                  nombre: '', icono: '🚗', montoObjetivo: '', montoActual: '',
                  fechaObjetivo: '', cajitaNubank: '', tasaRendimientoAnual: '11.5',
                  aporteMensualPlaneado: '', prioridad: 'media', color: 'emerald'
                });
                setModalMeta(true);
              }}
              className="w-full bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 hover:from-emerald-600/30 hover:to-cyan-600/30 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl p-4 flex items-center justify-center gap-2 transition-all group"
            >
              <Plus size={20} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-emerald-400 font-medium">Nueva Meta de Ahorro</span>
            </button>

            {/* Lista de metas */}
            {metasFinancieras.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Target size={48} className="mx-auto mb-4 opacity-30" />
                <p className="font-medium">No tienes metas de ahorro</p>
                <p className="text-sm">Crea tu primera meta para empezar a ahorrar</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {metasFinancieras
                  .sort((a, b) => {
                    // Ordenar por prioridad primero, luego por progreso
                    const prioridadOrden = { alta: 0, media: 1, baja: 2 };
                    if (prioridadOrden[a.prioridad] !== prioridadOrden[b.prioridad]) {
                      return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
                    }
                    const { saldoTotal: saldoA } = calcularTotalesMeta(a);
                    const { saldoTotal: saldoB } = calcularTotalesMeta(b);
                    return (saldoB / b.montoObjetivo) - (saldoA / a.montoObjetivo);
                  })
                  .map(metaOriginal => {
                    // Usar la función de cálculo con migración
                    const { saldoTotal, rendimientoMensualTotal, totalAportado, totalRendimientos, totalRetirado, metaMigrada } = calcularTotalesMeta(metaOriginal);
                    const meta = metaMigrada;

                    const progreso = (saldoTotal / meta.montoObjetivo) * 100;
                    const faltante = meta.montoObjetivo - saldoTotal;

                    // Calcular meses restantes con el ritmo actual
                    const aporteActualMensual = meta.aporteMensualPlaneado + rendimientoMensualTotal;
                    let mesesRestantesRitmoActual = Infinity;
                    if (aporteActualMensual > 0) {
                      mesesRestantesRitmoActual = Math.ceil(faltante / aporteActualMensual);
                    }

                    // Análisis inteligente de la meta
                    const hoy = new Date();
                    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
                    const fechaInicio = new Date(meta.fechaInicio + 'T12:00:00');

                    // Calcular meses transcurridos correctamente
                    const mesesTranscurridos = Math.max(1,
                      (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 +
                      (hoy.getMonth() - fechaInicio.getMonth())
                    );

                    // Analizar historial de aportes por mes (últimos 6 meses)
                    const todosAportes = meta.bolsillos.flatMap(b => b.historialAportes || []);
                    const aportesPorMes: Record<string, number> = {};

                    todosAportes.forEach(aporte => {
                      if (aporte.tipo === 'aporte' || aporte.tipo === 'rendimiento') {
                        const mesAporte = aporte.fecha.slice(0, 7); // YYYY-MM
                        aportesPorMes[mesAporte] = (aportesPorMes[mesAporte] || 0) + aporte.monto;
                      } else if (aporte.tipo === 'retiro') {
                        const mesAporte = aporte.fecha.slice(0, 7);
                        aportesPorMes[mesAporte] = (aportesPorMes[mesAporte] || 0) - Math.abs(aporte.monto);
                      }
                    });

                    // Obtener los últimos 3 meses con aportes (excluyendo el mes actual)
                    const mesesOrdenados = Object.keys(aportesPorMes)
                      .filter(m => m < mesActual)
                      .sort((a, b) => b.localeCompare(a))
                      .slice(0, 3);

                    const aporteMesActual = aportesPorMes[mesActual] || 0;
                    const aportesUltimos3Meses = mesesOrdenados.map(m => aportesPorMes[m] || 0);
                    const promedioUltimos3Meses = aportesUltimos3Meses.length > 0
                      ? aportesUltimos3Meses.reduce((a, b) => a + b, 0) / aportesUltimos3Meses.length
                      : 0;

                    // Calcular tendencia (comparar último mes vs promedio anterior)
                    let tendencia: 'subiendo' | 'estable' | 'bajando' | 'sin_datos' = 'sin_datos';
                    if (aportesUltimos3Meses.length >= 2) {
                      const ultimoMes = aportesUltimos3Meses[0] || 0;
                      const promedioAnterior = aportesUltimos3Meses.slice(1).reduce((a, b) => a + b, 0) / (aportesUltimos3Meses.length - 1);
                      if (ultimoMes > promedioAnterior * 1.15) tendencia = 'subiendo';
                      else if (ultimoMes < promedioAnterior * 0.85) tendencia = 'bajando';
                      else tendencia = 'estable';
                    }

                    // Usar el promedio más realista (últimos 3 meses si hay datos, sino el total)
                    const promedioMensualReal = promedioUltimos3Meses > 0 ? promedioUltimos3Meses : (saldoTotal / mesesTranscurridos);

                    // Si tiene fecha objetivo
                    let mesesHastaObjetivo = Infinity;
                    let progresoEsperado = 0;
                    let ahorroRequeridoMensual = 0;
                    let estadoMeta: 'completada' | 'adelantado' | 'en_tiempo' | 'atrasado' | 'critico' | 'sin_fecha' = 'sin_fecha';
                    let mensajeEstado = '';
                    let recomendacion = '';

                    if (meta.fechaObjetivo) {
                      const fechaObj = new Date(meta.fechaObjetivo + 'T12:00:00');
                      // Calcular meses de diferencia correctamente
                      mesesHastaObjetivo = Math.max(0,
                        (fechaObj.getFullYear() - hoy.getFullYear()) * 12 +
                        (fechaObj.getMonth() - hoy.getMonth())
                      );
                      const mesesTotales = Math.max(1,
                        (fechaObj.getFullYear() - fechaInicio.getFullYear()) * 12 +
                        (fechaObj.getMonth() - fechaInicio.getMonth())
                      );

                      // Progreso esperado lineal
                      if (mesesTotales > 0) {
                        progresoEsperado = Math.min(100, (mesesTranscurridos / mesesTotales) * 100);
                      }

                      // Ahorro mensual requerido para llegar a tiempo
                      if (mesesHastaObjetivo > 0) {
                        ahorroRequeridoMensual = faltante / mesesHastaObjetivo;
                      }

                      // Calcular fecha realista basada en el ritmo actual
                      let mesesParaLlegarRitmoActual = Infinity;
                      let fechaRealistaEstimada = '';
                      if (promedioMensualReal > 0) {
                        mesesParaLlegarRitmoActual = Math.ceil(faltante / promedioMensualReal);
                        const nuevaFecha = new Date();
                        nuevaFecha.setMonth(nuevaFecha.getMonth() + mesesParaLlegarRitmoActual);
                        fechaRealistaEstimada = nuevaFecha.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
                      }

                      // Determinar estado
                      if (progreso >= 100) {
                        estadoMeta = 'completada';
                        mensajeEstado = '¡Meta alcanzada!';
                        recomendacion = 'Felicidades, ya cumpliste tu meta.';
                      } else if (mesesHastaObjetivo <= 0) {
                        estadoMeta = 'critico';
                        mensajeEstado = 'Fecha vencida';
                        if (promedioMensualReal > 0) {
                          recomendacion = `A tu ritmo (${formatearDineroCorto(promedioMensualReal)}/mes), llegarías en ${mesesParaLlegarRitmoActual} meses → ${fechaRealistaEstimada}.`;
                        } else {
                          recomendacion = `Te faltan ${formatearDineroCorto(faltante)}. Define un aporte mensual.`;
                        }
                      } else if (progreso >= progresoEsperado + 10) {
                        estadoMeta = 'adelantado';
                        mensajeEstado = '¡Vas adelantado!';
                        const mesesAdelanto = Math.max(1, Math.floor((progreso - progresoEsperado) / (100 / Math.max(1, mesesTotales))));
                        recomendacion = `Excelente ritmo. Podrías lograrlo ${mesesAdelanto} mes${mesesAdelanto > 1 ? 'es' : ''} antes.`;
                      } else if (progreso >= progresoEsperado - 5) {
                        estadoMeta = 'en_tiempo';
                        mensajeEstado = 'Vas en tiempo';
                        recomendacion = `Sigue así. A tu ritmo actual llegas a tiempo.`;
                      } else {
                        // Está atrasado - ver qué tan alcanzable es
                        const puedeAlcanzar = promedioMensualReal >= ahorroRequeridoMensual * 0.7; // Si ahorra al menos 70% de lo necesario

                        if (puedeAlcanzar) {
                          estadoMeta = 'atrasado';
                          mensajeEstado = 'Un poco atrasado';
                          recomendacion = `Aumenta de ${formatearDineroCorto(promedioMensualReal)} a ${formatearDineroCorto(ahorroRequeridoMensual)}/mes para llegar a tiempo.`;
                        } else {
                          // La fecha no es realista
                          estadoMeta = 'critico';
                          if (promedioMensualReal > 0 && mesesParaLlegarRitmoActual < Infinity) {
                            if (mesesParaLlegarRitmoActual <= 24) {
                              mensajeEstado = 'Extiende la fecha';
                              recomendacion = `A tu ritmo (${formatearDineroCorto(promedioMensualReal)}/mes) llegas en ${mesesParaLlegarRitmoActual} meses → ${fechaRealistaEstimada}.`;
                            } else {
                              const años = Math.floor(mesesParaLlegarRitmoActual / 12);
                              mensajeEstado = 'Meta a largo plazo';
                              recomendacion = `A tu ritmo actual necesitas ~${años} año${años > 1 ? 's' : ''}. Puedes aumentar tu ahorro o ajustar la meta.`;
                            }
                          } else {
                            mensajeEstado = 'Sin datos suficientes';
                            recomendacion = 'Empieza a ahorrar regularmente para ver proyecciones.';
                          }
                        }
                      }
                    } else {
                      // Sin fecha objetivo
                      if (progreso >= 100) {
                        estadoMeta = 'completada';
                        mensajeEstado = '¡Meta alcanzada!';
                      } else if (aporteActualMensual > 0) {
                        mensajeEstado = `~${mesesRestantesRitmoActual} meses restantes`;
                        recomendacion = `A tu ritmo actual (${formatearDineroCorto(aporteActualMensual)}/mes) llegarás en ${mesesRestantesRitmoActual > 12 ? Math.floor(mesesRestantesRitmoActual/12) + ' años' : mesesRestantesRitmoActual + ' meses'}.`;
                      } else {
                        mensajeEstado = 'Define un aporte mensual';
                        recomendacion = 'Sin un aporte definido no podemos estimar cuándo lograrás tu meta.';
                      }
                    }

                    // Colores del estado
                    const estadoColores = {
                      completada: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', icon: '✓' },
                      adelantado: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400', icon: '🚀' },
                      en_tiempo: { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-400', icon: '👍' },
                      atrasado: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', icon: '⚠️' },
                      critico: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', icon: '🔴' },
                      sin_fecha: { bg: 'bg-gray-500/20', border: 'border-gray-500/40', text: 'text-gray-400', icon: '📅' },
                    };
                    const estadoColor = estadoColores[estadoMeta];

                    const colorClases: Record<string, { bg: string; border: string; text: string; bar: string }> = {
                      emerald: { bg: 'from-emerald-900/40 to-emerald-900/10', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400' },
                      blue: { bg: 'from-blue-900/40 to-blue-900/10', border: 'border-blue-500/30', text: 'text-blue-400', bar: 'bg-gradient-to-r from-blue-500 to-blue-400' },
                      purple: { bg: 'from-purple-900/40 to-purple-900/10', border: 'border-purple-500/30', text: 'text-purple-400', bar: 'bg-gradient-to-r from-purple-500 to-purple-400' },
                      amber: { bg: 'from-amber-900/40 to-amber-900/10', border: 'border-amber-500/30', text: 'text-amber-400', bar: 'bg-gradient-to-r from-amber-500 to-amber-400' },
                      rose: { bg: 'from-rose-900/40 to-rose-900/10', border: 'border-rose-500/30', text: 'text-rose-400', bar: 'bg-gradient-to-r from-rose-500 to-rose-400' },
                      cyan: { bg: 'from-cyan-900/40 to-cyan-900/10', border: 'border-cyan-500/30', text: 'text-cyan-400', bar: 'bg-gradient-to-r from-cyan-500 to-cyan-400' },
                      orange: { bg: 'from-orange-900/40 to-orange-900/10', border: 'border-orange-500/30', text: 'text-orange-400', bar: 'bg-gradient-to-r from-orange-500 to-orange-400' },
                      pink: { bg: 'from-pink-900/40 to-pink-900/10', border: 'border-pink-500/30', text: 'text-pink-400', bar: 'bg-gradient-to-r from-pink-500 to-pink-400' },
                    };
                    const colores = colorClases[meta.color] || colorClases.emerald;

                    return (
                      <div
                        key={meta.id}
                        className={`bg-gradient-to-br ${colores.bg} rounded-xl p-5 border ${colores.border} ${!meta.activa ? 'opacity-50' : ''}`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{meta.icono}</span>
                            <div>
                              <h3 className="font-bold text-lg">{meta.nombre}</h3>
                              <p className="text-xs text-gray-400">
                                {meta.bolsillos.length} bolsillo{meta.bolsillos.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {meta.prioridad === 'alta' && <Flame size={16} className="text-red-400" />}
                          </div>
                        </div>

                        {/* Badge de Estado Inteligente */}
                        <div className={`mb-4 p-3 rounded-xl border ${estadoColor.bg} ${estadoColor.border}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-bold ${estadoColor.text} flex items-center gap-2`}>
                              <span>{estadoColor.icon}</span>
                              {mensajeEstado}
                            </span>
                            {meta.fechaObjetivo && progresoEsperado > 0 && estadoMeta !== 'completada' && (
                              <span className="text-xs text-gray-500">
                                Esperado: {progresoEsperado.toFixed(0)}%
                              </span>
                            )}
                          </div>
                          {recomendacion && (
                            <p className="text-xs text-gray-400 leading-relaxed">{recomendacion}</p>
                          )}
                        </div>

                        {/* Barra de progreso */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-mono font-bold">{formatearDinero(saldoTotal)}</span>
                            <span className="text-gray-400">de {formatearDinero(meta.montoObjetivo)}</span>
                          </div>
                          <div className="h-3 bg-gray-800 rounded-full overflow-hidden relative">
                            {/* Marcador de progreso esperado */}
                            {meta.fechaObjetivo && progresoEsperado > 0 && progresoEsperado < 100 && (
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10"
                                style={{ left: `${progresoEsperado}%` }}
                                title={`Esperado: ${progresoEsperado.toFixed(0)}%`}
                              />
                            )}
                            <div
                              className={`h-full ${colores.bar} transition-all duration-500`}
                              style={{ width: `${Math.min(progreso, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-2">
                            <span className={`text-sm font-bold ${colores.text}`}>{progreso.toFixed(1)}%</span>
                            <span className="text-sm text-gray-400">Faltan {formatearDineroCorto(faltante)}</span>
                          </div>
                        </div>

                        {/* Lista de Bolsillos */}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-400">Bolsillos</span>
                            <button
                              onClick={() => {
                                setFormBolsillo({ nombre: '', tipo: 'nu', saldo: '', tasaRendimientoAnual: '11.5', fechaApertura: '', fechaVencimiento: '', renovacionAutomatica: false, entidadFinanciera: '', tipoInteres: 'compuesto' });
                                setModalBolsillo({ visible: true, meta: metaOriginal, bolsillo: null });
                              }}
                              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                            >
                              <Plus size={12} /> Agregar
                            </button>
                          </div>
                          {meta.bolsillos.map(bolsillo => {
                            const porcentajeBolsillo = saldoTotal > 0 ? (bolsillo.saldo / saldoTotal) * 100 : 0;
                            const rendBolsillo = bolsillo.saldo * (bolsillo.tasaRendimientoAnual / 100) / 12;
                            const esCDT = bolsillo.tipo === 'cdt';
                            // CDT calculations
                            const cdtInfo = esCDT && bolsillo.fechaVencimiento ? (() => {
                              const hoy = new Date(getColombiaDateOnly());
                              const vencimiento = new Date(bolsillo.fechaVencimiento + 'T12:00:00');
                              const apertura = bolsillo.fechaApertura ? new Date(bolsillo.fechaApertura + 'T12:00:00') : null;
                              const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                              const capital = bolsillo.capitalInicial || bolsillo.saldo;
                              const tasa = bolsillo.tasaRendimientoAnual / 100;
                              const meses = bolsillo.plazoMeses || 6;
                              const esSimple = bolsillo.tipoInteres === 'simple';
                              const valorAlVencimiento = esSimple
                                ? capital * (1 + tasa * meses / 12)
                                : capital * Math.pow(1 + tasa / 12, meses);
                              const interesesProyectados = valorAlVencimiento - capital;
                              // Progreso temporal del CDT
                              const totalDias = apertura ? Math.ceil((vencimiento.getTime() - apertura.getTime()) / (1000 * 60 * 60 * 24)) : meses * 30;
                              const diasTranscurridos = apertura ? Math.ceil((hoy.getTime() - apertura.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                              const progresoTemporal = totalDias > 0 ? Math.min(Math.max(diasTranscurridos / totalDias * 100, 0), 100) : 0;
                              // Interés acumulado hasta hoy
                              const mesesTranscurridos = diasTranscurridos / 30;
                              const valorHoy = esSimple
                                ? capital * (1 + tasa * Math.min(mesesTranscurridos, meses) / 12)
                                : capital * Math.pow(1 + tasa / 12, Math.min(mesesTranscurridos, meses));
                              const interesAcumulado = valorHoy - capital;
                              const vencido = diasRestantes <= 0;
                              const porVencer = !vencido && diasRestantes <= 30;
                              return { diasRestantes, valorAlVencimiento, interesesProyectados, progresoTemporal, interesAcumulado, vencido, porVencer };
                            })() : null;

                            return (
                              <div
                                key={bolsillo.id}
                                className={`bg-black/30 rounded-lg p-3 border ${
                                  esCDT && cdtInfo?.vencido ? 'border-red-500/40' :
                                  esCDT && cdtInfo?.porVencer ? 'border-amber-500/40' :
                                  esCDT ? 'border-amber-700/30' : 'border-gray-700/30'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{bolsillo.icono}</span>
                                    <div>
                                      <p className="font-medium text-sm">{bolsillo.nombre}</p>
                                      {bolsillo.tasaRendimientoAnual > 0 && (
                                        <p className="text-xs text-gray-500">
                                          {bolsillo.tasaRendimientoAnual}% EA
                                          {bolsillo.entidadFinanciera && ` · ${bolsillo.entidadFinanciera}`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-mono font-bold">{formatearDineroCorto(bolsillo.saldo)}</p>
                                    <p className="text-xs text-gray-500">{porcentajeBolsillo.toFixed(0)}% del total</p>
                                  </div>
                                </div>

                                {/* CDT Info Panel */}
                                {esCDT && cdtInfo && (
                                  <div className="mb-2 space-y-2">
                                    {/* Status badge */}
                                    <div className="flex items-center gap-2">
                                      {cdtInfo.vencido ? (
                                        <span className="text-[10px] px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full font-medium flex items-center gap-1">
                                          <AlertCircle size={10} /> Vencido
                                        </span>
                                      ) : cdtInfo.porVencer ? (
                                        <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-medium flex items-center gap-1">
                                          <Clock size={10} /> {cdtInfo.diasRestantes}d para vencer
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium flex items-center gap-1">
                                          <Clock size={10} /> {cdtInfo.diasRestantes}d restantes
                                        </span>
                                      )}
                                      {bolsillo.renovacionAutomatica && (
                                        <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-medium">
                                          Auto-renueva
                                        </span>
                                      )}
                                      {(bolsillo.numeroRenovaciones || 0) > 0 && (
                                        <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full font-medium">
                                          Renov. #{bolsillo.numeroRenovaciones}
                                        </span>
                                      )}
                                    </div>

                                    {/* Progress bar temporal */}
                                    <div>
                                      <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                                        <span>{bolsillo.fechaApertura ? new Date(bolsillo.fechaApertura + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : ''}</span>
                                        <span>{bolsillo.plazoMeses}m</span>
                                        <span>{new Date(bolsillo.fechaVencimiento! + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                                      </div>
                                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                                        <div
                                          className={`h-1.5 rounded-full transition-all ${
                                            cdtInfo.vencido ? 'bg-red-500' : cdtInfo.porVencer ? 'bg-amber-500' : 'bg-amber-400'
                                          }`}
                                          style={{ width: `${Math.min(cdtInfo.progresoTemporal, 100)}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* Interest info */}
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                      <div className="bg-emerald-500/10 rounded-md px-2 py-1">
                                        <p className="text-gray-500">Interes acumulado</p>
                                        <p className="font-mono text-emerald-400 font-medium">+{formatearDineroCorto(Math.round(cdtInfo.interesAcumulado))}</p>
                                      </div>
                                      <div className="bg-amber-500/10 rounded-md px-2 py-1">
                                        <p className="text-gray-500">Al vencimiento</p>
                                        <p className="font-mono text-amber-400 font-medium">{formatearDineroCorto(Math.round(cdtInfo.valorAlVencimiento))}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Botones de acción del bolsillo */}
                                <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-700/30">
                                  <button
                                    onClick={() => {
                                      setFormSincronizar({ saldoActual: '', aporteMio: '' });
                                      setModalSincronizar({ visible: true, meta: metaOriginal, bolsillo });
                                    }}
                                    className="flex-1 text-xs py-1.5 px-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-md flex items-center justify-center gap-1 transition-all"
                                  >
                                    <RefreshCw size={12} /> Sincronizar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setFormAporte({ monto: '', tipo: 'aporte', nota: '' });
                                      setModalAporteBolsillo({ visible: true, meta: metaOriginal, bolsillo });
                                    }}
                                    className="text-xs py-1.5 px-2 bg-gray-700/50 hover:bg-gray-600/50 rounded-md transition-all"
                                    title="Aporte manual"
                                  >
                                    <Plus size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setFormBolsillo({
                                        nombre: bolsillo.nombre,
                                        tipo: bolsillo.tipo,
                                        saldo: bolsillo.saldo.toString(),
                                        tasaRendimientoAnual: bolsillo.tasaRendimientoAnual.toString(),
                                        fechaApertura: bolsillo.fechaApertura || '',
                                        fechaVencimiento: bolsillo.fechaVencimiento || '',
                                        renovacionAutomatica: bolsillo.renovacionAutomatica || false,
                                        entidadFinanciera: bolsillo.entidadFinanciera || '',
                                        tipoInteres: bolsillo.tipoInteres || 'compuesto'
                                      });
                                      setModalBolsillo({ visible: true, meta: metaOriginal, bolsillo });
                                    }}
                                    className="text-xs py-1.5 px-2 bg-gray-700/50 hover:bg-gray-600/50 rounded-md transition-all"
                                    title="Editar bolsillo"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                                {/* Mini info de rendimiento (non-CDT) */}
                                {!esCDT && rendBolsillo > 0 && (
                                  <p className="text-xs text-blue-400/70 mt-1.5 flex items-center gap-1">
                                    <TrendingUp size={10} /> +{formatearDineroCorto(rendBolsillo)}/mes
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Desglose Aportes vs Rendimientos */}
                        {(totalAportado > 0 || totalRendimientos > 0) && (
                          <div className="bg-black/30 rounded-xl p-3 mb-4 border border-gray-700/30">
                            <div className="flex items-center gap-2 mb-2">
                              <Coins size={14} className="text-gray-400" />
                              <span className="text-xs font-medium text-gray-400">Resumen total</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center">
                                <p className="text-gray-500">Aportado</p>
                                <p className="font-mono text-emerald-400">{formatearDineroCorto(totalAportado)}</p>
                              </div>
                              <div className="text-center border-x border-gray-700/30">
                                <p className="text-gray-500">Rendimientos</p>
                                <p className="font-mono text-blue-400">{formatearDineroCorto(totalRendimientos)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-500">Retirado</p>
                                <p className="font-mono text-red-400">{formatearDineroCorto(totalRetirado)}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Progreso del mes actual */}
                        {(aporteMesActual !== 0 || ahorroRequeridoMensual > 0) && (
                          <div className="mb-4 p-3 rounded-xl bg-black/30 border border-gray-700/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-400">Este mes</span>
                              {tendencia !== 'sin_datos' && (
                                <span className={`text-xs flex items-center gap-1 ${
                                  tendencia === 'subiendo' ? 'text-emerald-400' :
                                  tendencia === 'bajando' ? 'text-red-400' : 'text-gray-400'
                                }`}>
                                  {tendencia === 'subiendo' && '📈 Subiendo'}
                                  {tendencia === 'bajando' && '📉 Bajando'}
                                  {tendencia === 'estable' && '➡️ Estable'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-end justify-between">
                              <div>
                                <p className={`text-xl font-mono font-bold ${aporteMesActual >= ahorroRequeridoMensual ? 'text-emerald-400' : 'text-white'}`}>
                                  {formatearDineroCorto(aporteMesActual)}
                                </p>
                                {ahorroRequeridoMensual > 0 && (
                                  <p className="text-xs text-gray-500">
                                    de {formatearDineroCorto(ahorroRequeridoMensual)} necesarios
                                  </p>
                                )}
                              </div>
                              {ahorroRequeridoMensual > 0 && (
                                <div className="text-right">
                                  <p className={`text-sm font-bold ${aporteMesActual >= ahorroRequeridoMensual ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {((aporteMesActual / ahorroRequeridoMensual) * 100).toFixed(0)}%
                                  </p>
                                  {aporteMesActual >= ahorroRequeridoMensual ? (
                                    <p className="text-xs text-emerald-400">✓ Cubierto</p>
                                  ) : (
                                    <p className="text-xs text-gray-500">Faltan {formatearDineroCorto(ahorroRequeridoMensual - aporteMesActual)}</p>
                                  )}
                                </div>
                              )}
                            </div>
                            {ahorroRequeridoMensual > 0 && (
                              <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${aporteMesActual >= ahorroRequeridoMensual ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                  style={{ width: `${Math.min(100, (aporteMesActual / ahorroRequeridoMensual) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Info adicional mejorada */}
                        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                          {/* Promedio últimos 3 meses */}
                          {promedioUltimos3Meses > 0 && (
                            <div className={`rounded-lg p-2 ${promedioUltimos3Meses >= ahorroRequeridoMensual ? 'bg-emerald-500/10' : 'bg-black/20'}`}>
                              <p className="text-gray-500 text-xs">Prom. últimos 3 meses</p>
                              <p className={`font-mono font-bold ${promedioUltimos3Meses >= ahorroRequeridoMensual ? 'text-emerald-400' : 'text-blue-400'}`}>
                                {formatearDineroCorto(promedioUltimos3Meses)}/mes
                              </p>
                            </div>
                          )}
                          {/* Ahorro requerido */}
                          {ahorroRequeridoMensual > 0 && (
                            <div className={`rounded-lg p-2 ${promedioMensualReal >= ahorroRequeridoMensual ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                              <p className="text-gray-500 text-xs">Necesitas</p>
                              <p className={`font-mono font-bold ${promedioMensualReal >= ahorroRequeridoMensual ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {formatearDineroCorto(ahorroRequeridoMensual)}/mes
                              </p>
                            </div>
                          )}
                          {/* Rendimiento mensual */}
                          {rendimientoMensualTotal > 0 && (
                            <div className="bg-blue-500/10 rounded-lg p-2">
                              <p className="text-gray-500 text-xs">Rendimientos est.</p>
                              <p className="font-mono text-blue-400">+{formatearDineroCorto(rendimientoMensualTotal)}/mes</p>
                            </div>
                          )}
                          {/* Meses hasta fecha objetivo */}
                          {meta.fechaObjetivo && mesesHastaObjetivo > 0 && (
                            <div className="bg-black/20 rounded-lg p-2">
                              <p className="text-gray-500 text-xs">Fecha objetivo</p>
                              <p className="font-medium">
                                {new Date(meta.fechaObjetivo + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
                                <span className="text-xs text-gray-500 ml-1">({mesesHastaObjetivo}m)</span>
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Acciones de la meta */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setModalHistorialMeta({ visible: true, meta })}
                            className="flex-1 bg-gray-700/50 hover:bg-gray-600/50 text-white font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                          >
                            <History size={16} />
                            Historial
                          </button>
                          <button
                            onClick={() => {
                              setFormMeta({
                                nombre: meta.nombre,
                                icono: meta.icono,
                                montoObjetivo: meta.montoObjetivo.toString(),
                                montoActual: saldoTotal.toString(),
                                fechaObjetivo: meta.fechaObjetivo || '',
                                cajitaNubank: '',
                                tasaRendimientoAnual: '0',
                                aporteMensualPlaneado: meta.aporteMensualPlaneado.toString(),
                                prioridad: meta.prioridad,
                                color: meta.color
                              });
                              setModalEditarMeta({ visible: true, meta: metaOriginal });
                            }}
                            className="p-2 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg transition-all"
                            title="Editar meta"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`¿Eliminar la meta "${meta.nombre}"?`)) {
                                setMetasFinancieras(prev => prev.filter(m => m.id !== meta.id));
                              }
                            }}
                            className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===== MODALES ===== */}

      {/* Modal Gasto Fijo */}
      {modalGastoFijo && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-gray-700/50 shadow-2xl shadow-purple-500/10 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Receipt className="text-purple-400" size={18} />
                </div>
                Nuevo Gasto Fijo
              </h3>
              <button onClick={() => setModalGastoFijo(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: Arriendo, Internet..."
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  value={formGastoFijo.nombre}
                  onChange={e => setFormGastoFijo({...formGastoFijo, nombre: e.target.value})}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Monto mensual</label>
                <input
                  type="tel"
                  placeholder="0"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono text-lg focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  value={formGastoFijo.monto}
                  onChange={e => setFormGastoFijo({...formGastoFijo, monto: e.target.value.replace(/[^0-9]/g, '')})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Categoría</label>
                  <select
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-purple-500/50 transition-all"
                    value={formGastoFijo.categoria}
                    onChange={e => setFormGastoFijo({...formGastoFijo, categoria: e.target.value as CategoriaGasto})}
                  >
                    {Object.entries(CATEGORIAS_GASTO).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Día de corte</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-purple-500/50 transition-all"
                    value={formGastoFijo.diaCorte}
                    onChange={e => setFormGastoFijo({...formGastoFijo, diaCorte: e.target.value})}
                  />
                </div>
              </div>

              <button
                onClick={agregarGastoFijo}
                disabled={!formGastoFijo.nombre || !formGastoFijo.monto}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 disabled:shadow-none"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Pago de Gasto Fijo */}
      {modalPagoGasto.visible && modalPagoGasto.gasto && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Check className="text-emerald-400" size={18} />
                </div>
                Registrar Pago
              </h3>
              <button onClick={() => setModalPagoGasto({ visible: false, gasto: null })} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-gray-800/50 rounded-xl mb-4">
              <p className="text-sm text-gray-400">Pagando:</p>
              <p className="font-bold text-white">{modalPagoGasto.gasto.nombre}</p>
              <p className="text-xs text-gray-500">Monto estimado: {formatearDinero(modalPagoGasto.gasto.monto)}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">¿Cuánto pagaste realmente?</label>
                <input
                  type="tel"
                  placeholder="0"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono text-lg focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={formPagoGasto.monto}
                  onChange={e => setFormPagoGasto({...formPagoGasto, monto: e.target.value.replace(/[^0-9]/g, '')})}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Fecha del pago</label>
                <input
                  type="date"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-emerald-500/50 transition-all"
                  value={formPagoGasto.fecha}
                  onChange={e => setFormPagoGasto({...formPagoGasto, fecha: e.target.value})}
                />
              </div>

              <button
                onClick={registrarPagoGasto}
                disabled={!formPagoGasto.monto}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:shadow-none"
              >
                Confirmar Pago
              </button>

              {/* Historial de pagos anteriores */}
              {modalPagoGasto.gasto.historialPagos && modalPagoGasto.gasto.historialPagos.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700/50">
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <History size={12} />
                    Últimos pagos:
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {modalPagoGasto.gasto.historialPagos.slice(-3).reverse().map(pago => (
                      <div key={pago.id} className="flex justify-between text-xs p-2 bg-gray-800/30 rounded-lg">
                        <span className="text-gray-400">{pago.fecha}</span>
                        <span className="font-mono text-white">{formatearDinero(pago.montoPagado)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de Pagos de Gasto Fijo */}
      {modalHistorialGasto.visible && modalHistorialGasto.gasto && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-gray-700/50 shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <History className="text-blue-400" size={18} />
                </div>
                Historial de {modalHistorialGasto.gasto.nombre}
              </h3>
              <button onClick={() => setModalHistorialGasto({ visible: false, gasto: null })} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {modalHistorialGasto.gasto.historialPagos && modalHistorialGasto.gasto.historialPagos.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {modalHistorialGasto.gasto.historialPagos.slice().reverse().map(pago => (
                  <div key={pago.id} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-xl border border-gray-700/30">
                    <div>
                      <p className="text-sm text-white">{pago.fecha}</p>
                      <p className="text-xs text-gray-500">Mes: {pago.mes}</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">{formatearDinero(pago.montoPagado)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History size={32} className="mx-auto mb-2 opacity-50" />
                <p>No hay pagos registrados</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Editar Gasto Fijo */}
      {modalEditarGasto.visible && modalEditarGasto.gasto && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-purple-500/30 shadow-2xl shadow-purple-500/10 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Edit2 className="text-purple-400" size={18} />
                </div>
                Editar Gasto Fijo
              </h3>
              <button onClick={() => setModalEditarGasto({ visible: false, gasto: null })} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: Arriendo, Internet..."
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  value={formEditarGasto.nombre}
                  onChange={e => setFormEditarGasto({...formEditarGasto, nombre: e.target.value})}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Monto estimado mensual</label>
                <input
                  type="tel"
                  placeholder="0"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono text-lg focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  value={formEditarGasto.monto}
                  onChange={e => setFormEditarGasto({...formEditarGasto, monto: e.target.value.replace(/[^0-9]/g, '')})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Categoría</label>
                  <select
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-purple-500/50 transition-all"
                    value={formEditarGasto.categoria}
                    onChange={e => setFormEditarGasto({...formEditarGasto, categoria: e.target.value as CategoriaGasto})}
                  >
                    {Object.entries(CATEGORIAS_GASTO).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Día de corte</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-purple-500/50 transition-all"
                    value={formEditarGasto.diaCorte}
                    onChange={e => setFormEditarGasto({...formEditarGasto, diaCorte: e.target.value})}
                  />
                </div>
              </div>

              <button
                onClick={guardarEdicionGasto}
                disabled={!formEditarGasto.nombre || !formEditarGasto.monto}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 disabled:shadow-none"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transacción */}
      {modalTransaccion.visible && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border shadow-2xl p-6 animate-in fade-in zoom-in duration-200 ${
            modalTransaccion.tipo === 'ingreso' ? 'border-emerald-500/30 shadow-emerald-500/10' : 'border-red-500/30 shadow-red-500/10'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                {modalTransaccion.tipo === 'ingreso' ? (
                  <>
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <ArrowUpRight className="text-emerald-400" size={18} />
                    </div>
                    Nuevo Ingreso
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <ArrowDownRight className="text-red-400" size={18} />
                    </div>
                    Nuevo Gasto
                  </>
                )}
              </h3>
              <button onClick={() => setModalTransaccion({ visible: false, tipo: 'gasto' })} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Descripción</label>
                <input
                  type="text"
                  placeholder={modalTransaccion.tipo === 'ingreso' ? 'Ej: Venta extra...' : 'Ej: Almuerzo, Taxi...'}
                  className={`w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 transition-all ${
                    modalTransaccion.tipo === 'ingreso' ? 'focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20' : 'focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
                  }`}
                  value={formTransaccion.descripcion}
                  onChange={e => setFormTransaccion({...formTransaccion, descripcion: e.target.value})}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Monto</label>
                <input
                  type="tel"
                  placeholder="0"
                  className={`w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono text-xl transition-all ${
                    modalTransaccion.tipo === 'ingreso' ? 'focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20' : 'focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
                  }`}
                  value={formTransaccion.monto}
                  onChange={e => setFormTransaccion({...formTransaccion, monto: e.target.value.replace(/[^0-9]/g, '')})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Categoría</label>
                  <select
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 transition-all"
                    value={formTransaccion.categoria}
                    onChange={e => setFormTransaccion({...formTransaccion, categoria: e.target.value as CategoriaGasto})}
                  >
                    {Object.entries(CATEGORIAS_GASTO).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Fecha</label>
                  <input
                    type="date"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 transition-all"
                    value={formTransaccion.fecha}
                    onChange={e => setFormTransaccion({...formTransaccion, fecha: e.target.value})}
                  />
                </div>
              </div>

              <button
                onClick={agregarTransaccion}
                disabled={!formTransaccion.descripcion || !formTransaccion.monto}
                className={`w-full font-bold py-3.5 rounded-xl transition-all disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:shadow-none ${
                  modalTransaccion.tipo === 'ingreso'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
                    : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40'
                }`}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuración */}
      {modalConfig && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-gray-700/50 shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-gray-700 rounded-lg">
                  <Settings className="text-gray-400" size={18} />
                </div>
                Configuración
              </h3>
              <button onClick={() => setModalConfig(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm text-gray-400 block mb-2 font-medium">Meta de ahorro mensual</label>
                <div className="flex gap-3">
                  <input
                    type="tel"
                    className="flex-1 bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-pink-500/50 transition-all"
                    value={metaAhorro.monto}
                    onChange={e => setMetaAhorro({...metaAhorro, monto: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0})}
                  />
                  <button
                    onClick={() => setMetaAhorro({...metaAhorro, activa: !metaAhorro.activa})}
                    className={`px-5 rounded-xl font-medium transition-all ${
                      metaAhorro.activa 
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25' 
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {metaAhorro.activa ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2 font-medium">Presupuesto mensual máximo</label>
                <input
                  type="tel"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-blue-500/50 transition-all"
                  value={presupuestoMensual}
                  onChange={e => setPresupuestoMensual(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                />
                <p className="text-xs text-gray-500 mt-1.5">Te alertará si superas este límite</p>
              </div>

              <button 
                onClick={() => setModalConfig(false)}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Transacción */}
      {modalEditarTransaccion.visible && modalEditarTransaccion.transaccion && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border shadow-2xl p-6 animate-in fade-in zoom-in duration-200 ${
            modalEditarTransaccion.transaccion.tipo === 'ingreso' ? 'border-emerald-500/30 shadow-emerald-500/10' : 'border-blue-500/30 shadow-blue-500/10'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Edit2 className="text-blue-400" size={18} />
                </div>
                Editar {modalEditarTransaccion.transaccion.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
              </h3>
              <button onClick={() => setModalEditarTransaccion({ visible: false, transaccion: null })} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Descripción</label>
                <input
                  type="text"
                  placeholder="Descripción..."
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={formEditTransaccion.descripcion}
                  onChange={e => setFormEditTransaccion({...formEditTransaccion, descripcion: e.target.value})}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Monto</label>
                <input
                  type="tel"
                  placeholder="0"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono text-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={formEditTransaccion.monto}
                  onChange={e => setFormEditTransaccion({...formEditTransaccion, monto: e.target.value.replace(/[^0-9]/g, '')})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Categoría</label>
                  <select
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 transition-all"
                    value={formEditTransaccion.categoria}
                    onChange={e => setFormEditTransaccion({...formEditTransaccion, categoria: e.target.value as CategoriaGasto})}
                  >
                    {Object.entries(CATEGORIAS_GASTO).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Fecha</label>
                  <input
                    type="date"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 transition-all"
                    value={formEditTransaccion.fecha}
                    onChange={e => setFormEditTransaccion({...formEditTransaccion, fecha: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setModalEditarTransaccion({ visible: false, transaccion: null })}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarEdicionTransaccion}
                  disabled={!formEditTransaccion.descripcion || !formEditTransaccion.monto}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:shadow-none"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Meta */}
      {modalMeta && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Target className="text-emerald-400" size={18} />
                </div>
                Nueva Meta de Ahorro
              </h3>
              <button onClick={() => setModalMeta(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Icono y Nombre */}
              <div className="flex gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Icono</label>
                  <div className="relative">
                    <select
                      className="w-20 h-12 bg-[#0f111a] border border-gray-700/50 rounded-xl text-2xl text-center appearance-none cursor-pointer"
                      value={formMeta.icono}
                      onChange={e => setFormMeta({...formMeta, icono: e.target.value})}
                    >
                      {ICONOS_META.map(icono => (
                        <option key={icono} value={icono}>{icono}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Nombre de la meta</label>
                  <input
                    type="text"
                    placeholder="Ej: Comprar carro"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={formMeta.nombre}
                    onChange={e => setFormMeta({...formMeta, nombre: e.target.value})}
                  />
                </div>
              </div>

              {/* Montos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Monto objetivo</label>
                  <input
                    type="tel"
                    placeholder="50,000,000"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={formMeta.montoObjetivo}
                    onChange={e => setFormMeta({...formMeta, montoObjetivo: e.target.value.replace(/[^0-9]/g, '')})}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Ya tengo ahorrado</label>
                  <input
                    type="tel"
                    placeholder="0"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={formMeta.montoActual}
                    onChange={e => setFormMeta({...formMeta, montoActual: e.target.value.replace(/[^0-9]/g, '')})}
                  />
                </div>
              </div>

              {/* Cajita Nu Bank */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Nombre de la Cajita (Nu Bank)</label>
                <input
                  type="text"
                  placeholder="Ej: Carro nuevo"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  value={formMeta.cajitaNubank}
                  onChange={e => setFormMeta({...formMeta, cajitaNubank: e.target.value})}
                />
              </div>

              {/* Rendimiento y aporte */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Rendimiento anual (%)</label>
                  <input
                    type="text"
                    placeholder="11.5"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={formMeta.tasaRendimientoAnual}
                    onChange={e => setFormMeta({...formMeta, tasaRendimientoAnual: e.target.value.replace(/[^0-9.]/g, '')})}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Aporte mensual planeado</label>
                  <input
                    type="tel"
                    placeholder="500,000"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={formMeta.aporteMensualPlaneado}
                    onChange={e => setFormMeta({...formMeta, aporteMensualPlaneado: e.target.value.replace(/[^0-9]/g, '')})}
                  />
                </div>
              </div>

              {/* Fecha objetivo y prioridad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Fecha objetivo (opcional)</label>
                  <input
                    type="month"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={formMeta.fechaObjetivo}
                    onChange={e => setFormMeta({...formMeta, fechaObjetivo: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Prioridad</label>
                  <select
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 transition-all"
                    value={formMeta.prioridad}
                    onChange={e => setFormMeta({...formMeta, prioridad: e.target.value as 'alta' | 'media' | 'baja'})}
                  >
                    <option value="alta">🔥 Alta</option>
                    <option value="media">⭐ Media</option>
                    <option value="baja">💤 Baja</option>
                  </select>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORES_META.map(color => (
                    <button
                      key={color}
                      onClick={() => setFormMeta({...formMeta, color})}
                      className={`w-8 h-8 rounded-lg bg-${color}-500 ${formMeta.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f111a]' : 'opacity-60 hover:opacity-100'} transition-all`}
                      style={{ backgroundColor: `var(--color-${color}-500, ${color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : color === 'purple' ? '#a855f7' : color === 'amber' ? '#f59e0b' : color === 'rose' ? '#f43f5e' : color === 'cyan' ? '#06b6d4' : color === 'orange' ? '#f97316' : '#ec4899'})` }}
                    />
                  ))}
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setModalMeta(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!formMeta.nombre || !formMeta.montoObjetivo) return;
                    const saldoInicial = parseInt(formMeta.montoActual) || 0;
                    const tasaInicial = parseFloat(formMeta.tasaRendimientoAnual) || 11.5;
                    
                    // Crear bolsillo inicial si hay saldo
                    const bolsilloInicial: Bolsillo = {
                      id: Date.now(),
                      nombre: formMeta.cajitaNubank || 'Nu Bank',
                      icono: '💜',
                      tipo: 'nu',
                      saldo: saldoInicial,
                      tasaRendimientoAnual: tasaInicial,
                      historialAportes: saldoInicial > 0 ? [{
                        id: Date.now(),
                        fecha: getColombiaDateOnly(),
                        monto: saldoInicial,
                        tipo: 'aporte',
                        nota: 'Saldo inicial'
                      }] : []
                    };
                    
                    const nuevaMeta: MetaFinanciera = {
                      id: Date.now() + 1,
                      nombre: formMeta.nombre,
                      icono: formMeta.icono,
                      montoObjetivo: parseInt(formMeta.montoObjetivo) || 0,
                      montoActual: saldoInicial,
                      fechaInicio: getColombiaDateOnly(),
                      fechaObjetivo: formMeta.fechaObjetivo || '',
                      aporteMensualPlaneado: parseInt(formMeta.aporteMensualPlaneado) || 0,
                      prioridad: formMeta.prioridad,
                      color: formMeta.color,
                      activa: true,
                      bolsillos: saldoInicial > 0 ? [bolsilloInicial] : [],
                      // Campos legacy vacíos para Firebase
                      cajitaNubank: formMeta.cajitaNubank || '',
                      tasaRendimientoAnual: tasaInicial,
                      historialAportes: []
                    };
                    setMetasFinancieras(prev => [...prev, nuevaMeta]);
                    setModalMeta(false);
                  }}
                  disabled={!formMeta.nombre || !formMeta.montoObjetivo}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:shadow-none"
                >
                  Crear Meta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Meta */}
      {modalEditarMeta.visible && modalEditarMeta.meta && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-blue-500/30 shadow-2xl shadow-blue-500/10 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Edit2 className="text-blue-400" size={18} />
                </div>
                Editar Meta
              </h3>
              <button onClick={() => setModalEditarMeta({ visible: false, meta: null })} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Icono y Nombre */}
              <div className="flex gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Icono</label>
                  <select
                    className="w-20 h-12 bg-[#0f111a] border border-gray-700/50 rounded-xl text-2xl text-center appearance-none cursor-pointer"
                    value={formMeta.icono}
                    onChange={e => setFormMeta({...formMeta, icono: e.target.value})}
                  >
                    {ICONOS_META.map(icono => (
                      <option key={icono} value={icono}>{icono}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Nombre</label>
                  <input
                    type="text"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    value={formMeta.nombre}
                    onChange={e => setFormMeta({...formMeta, nombre: e.target.value})}
                  />
                </div>
              </div>

              {/* Monto objetivo */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Monto objetivo</label>
                <input
                  type="tel"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={formMeta.montoObjetivo}
                  onChange={e => setFormMeta({...formMeta, montoObjetivo: e.target.value.replace(/[^0-9]/g, '')})}
                />
              </div>

              {/* Cajita */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Cajita Nu Bank</label>
                <input
                  type="text"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  value={formMeta.cajitaNubank}
                  onChange={e => setFormMeta({...formMeta, cajitaNubank: e.target.value})}
                />
              </div>

              {/* Rendimiento y aporte */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Rendimiento anual (%)</label>
                  <input
                    type="text"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    value={formMeta.tasaRendimientoAnual}
                    onChange={e => setFormMeta({...formMeta, tasaRendimientoAnual: e.target.value.replace(/[^0-9.]/g, '')})}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Aporte mensual</label>
                  <input
                    type="tel"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    value={formMeta.aporteMensualPlaneado}
                    onChange={e => setFormMeta({...formMeta, aporteMensualPlaneado: e.target.value.replace(/[^0-9]/g, '')})}
                  />
                </div>
              </div>

              {/* Fecha y prioridad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Fecha objetivo</label>
                  <input
                    type="month"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    value={formMeta.fechaObjetivo}
                    onChange={e => setFormMeta({...formMeta, fechaObjetivo: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Prioridad</label>
                  <select
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 transition-all"
                    value={formMeta.prioridad}
                    onChange={e => setFormMeta({...formMeta, prioridad: e.target.value as 'alta' | 'media' | 'baja'})}
                  >
                    <option value="alta">🔥 Alta</option>
                    <option value="media">⭐ Media</option>
                    <option value="baja">💤 Baja</option>
                  </select>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORES_META.map(color => (
                    <button
                      key={color}
                      onClick={() => setFormMeta({...formMeta, color})}
                      className={`w-8 h-8 rounded-lg ${formMeta.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f111a]' : 'opacity-60 hover:opacity-100'} transition-all`}
                      style={{ backgroundColor: `${color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : color === 'purple' ? '#a855f7' : color === 'amber' ? '#f59e0b' : color === 'rose' ? '#f43f5e' : color === 'cyan' ? '#06b6d4' : color === 'orange' ? '#f97316' : '#ec4899'}` }}
                    />
                  ))}
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setModalEditarMeta({ visible: false, meta: null })}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!modalEditarMeta.meta) return;
                    setMetasFinancieras(prev => prev.map(m => 
                      m.id === modalEditarMeta.meta!.id 
                        ? {
                            ...m,
                            nombre: formMeta.nombre,
                            icono: formMeta.icono,
                            montoObjetivo: parseInt(formMeta.montoObjetivo) || m.montoObjetivo,
                            fechaObjetivo: formMeta.fechaObjetivo || '',
                            cajitaNubank: formMeta.cajitaNubank || '',
                            tasaRendimientoAnual: parseFloat(formMeta.tasaRendimientoAnual) || 0,
                            aporteMensualPlaneado: parseInt(formMeta.aporteMensualPlaneado) || 0,
                            prioridad: formMeta.prioridad,
                            color: formMeta.color,
                            // Asegurar que bolsillos exista
                            bolsillos: m.bolsillos || [],
                            historialAportes: m.historialAportes || []
                          }
                        : m
                    ));
                    setModalEditarMeta({ visible: false, meta: null });
                  }}
                  disabled={!formMeta.nombre || !formMeta.montoObjetivo}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:shadow-none"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal Historial Meta */}
      {modalHistorialMeta.visible && modalHistorialMeta.meta && (() => {
        const metaMigrada = migrarMetaABolsillos(modalHistorialMeta.meta);
        
        // Juntar todos los aportes de todos los bolsillos con info del bolsillo
        const todosLosAportes = metaMigrada.bolsillos.flatMap(b => 
          b.historialAportes.map(a => ({ ...a, bolsilloNombre: b.nombre, bolsilloIcono: b.icono }))
        );
        
        const totalAportadoHist = todosLosAportes.filter(a => a.tipo === 'aporte').reduce((sum, a) => sum + a.monto, 0);
        const totalRendimientosHist = todosLosAportes.filter(a => a.tipo === 'rendimiento').reduce((sum, a) => sum + a.monto, 0);
        const totalRetiradoHist = todosLosAportes.filter(a => a.tipo === 'retiro').reduce((sum, a) => sum + Math.abs(a.monto), 0);
        
        return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md max-h-[85vh] rounded-2xl border border-gray-700/50 shadow-2xl p-6 animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="text-2xl">{metaMigrada.icono}</span>
                Historial: {metaMigrada.nombre}
              </h3>
              <button onClick={() => setModalHistorialMeta({ visible: false, meta: null })} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Resumen de totales */}
            <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-black/30 rounded-xl border border-gray-700/30">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                  <Plus size={12} />
                  <span className="text-xs">Aportado</span>
                </div>
                <p className="font-mono font-bold text-emerald-400">{formatearDineroCorto(totalAportadoHist)}</p>
              </div>
              <div className="text-center border-x border-gray-700/30">
                <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                  <TrendingUp size={12} />
                  <span className="text-xs">Rendimientos</span>
                </div>
                <p className="font-mono font-bold text-blue-400">{formatearDineroCorto(totalRendimientosHist)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
                  <ArrowDownRight size={12} />
                  <span className="text-xs">Retirado</span>
                </div>
                <p className="font-mono font-bold text-red-400">{formatearDineroCorto(totalRetiradoHist)}</p>
              </div>
            </div>

            {/* Lista por bolsillos */}
            <div className="space-y-4 flex-1 overflow-y-auto">
              {metaMigrada.bolsillos.map(bolsillo => (
                <div key={bolsillo.id} className="border border-gray-700/30 rounded-xl overflow-hidden">
                  <div className="bg-gray-800/50 px-3 py-2 flex items-center gap-2">
                    <span>{bolsillo.icono}</span>
                    <span className="font-medium text-sm">{bolsillo.nombre}</span>
                    <span className="text-xs text-gray-500 ml-auto">{bolsillo.historialAportes.length} mov.</span>
                  </div>
                  <div className="p-2 space-y-2">
                    {bolsillo.historialAportes.length === 0 ? (
                      <p className="text-center text-gray-500 py-3 text-sm">Sin movimientos</p>
                    ) : (
                      [...bolsillo.historialAportes]
                        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                        .slice(0, 5) // Mostrar solo los últimos 5
                        .map(aporte => (
                          <div key={aporte.id} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-md ${
                                aporte.tipo === 'aporte' ? 'bg-emerald-500/20 text-emerald-400' :
                                aporte.tipo === 'rendimiento' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {aporte.tipo === 'aporte' && <Plus size={12} />}
                                {aporte.tipo === 'rendimiento' && <TrendingUp size={12} />}
                                {aporte.tipo === 'retiro' && <ArrowDownRight size={12} />}
                              </div>
                              <div>
                                <p className="text-sm font-medium capitalize">{aporte.tipo}</p>
                                <p className="text-xs text-gray-500">{aporte.fecha}</p>
                              </div>
                            </div>
                            <span className={`font-mono text-sm font-bold ${
                              aporte.tipo === 'retiro' ? 'text-red-400' : 'text-emerald-400'
                            }`}>
                              {aporte.tipo === 'retiro' ? '-' : '+'}{formatearDineroCorto(Math.abs(aporte.monto))}
                            </span>
                          </div>
                        ))
                    )}
                    {bolsillo.historialAportes.length > 5 && (
                      <p className="text-center text-xs text-gray-500 py-1">
                        +{bolsillo.historialAportes.length - 5} movimientos anteriores
                      </p>
                    )}
                  </div>
                </div>
              ))}
              
              {metaMigrada.bolsillos.length === 0 && (
                <p className="text-center text-gray-500 py-8">No hay bolsillos configurados</p>
              )}
            </div>

            <button
              onClick={() => setModalHistorialMeta({ visible: false, meta: null })}
              className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
        );
      })()}

      {/* Modal Sincronizar Saldo de Bolsillo */}
      {modalSincronizar.visible && modalSincronizar.meta && modalSincronizar.bolsillo && (() => {
        const meta = modalSincronizar.meta;
        const bolsillo = modalSincronizar.bolsillo;
        const saldoActualNum = parseInt(formSincronizar.saldoActual) || 0;
        const aporteMioNum = parseInt(formSincronizar.aporteMio) || 0;
        const diferencia = saldoActualNum - bolsillo.saldo;
        const rendimientoCalculado = diferencia > 0 ? Math.max(0, diferencia - aporteMioNum) : 0;
        
        return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-purple-500/30 shadow-2xl shadow-purple-500/10 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <RefreshCw className="text-purple-400" size={18} />
                </div>
                Sincronizar Bolsillo
              </h3>
              <button onClick={() => setModalSincronizar({ visible: false, meta: null, bolsillo: null })} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Info del bolsillo */}
            <div className="bg-black/30 rounded-xl p-4 mb-4 border border-gray-700/30">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{bolsillo.icono}</span>
                <div>
                  <p className="font-bold">{bolsillo.nombre}</p>
                  <p className="text-xs text-gray-500">Meta: {meta.nombre}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-700/30">
                <span className="text-gray-400">Saldo registrado:</span>
                <span className="font-mono font-bold text-lg">{formatearDinero(bolsillo.saldo)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">¿Cuánto tienes ahora en {bolsillo.nombre}?</label>
                <input
                  type="tel"
                  placeholder="Ej: 500000"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono text-xl focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  value={formSincronizar.saldoActual}
                  onChange={e => setFormSincronizar({...formSincronizar, saldoActual: e.target.value.replace(/[^0-9]/g, '')})}
                />
              </div>

              {saldoActualNum > 0 && diferencia !== 0 && (
                <>
                  <div className={`p-3 rounded-xl border ${diferencia > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Diferencia:</span>
                      <span className={`font-mono font-bold ${diferencia > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {diferencia > 0 ? '+' : ''}{formatearDinero(diferencia)}
                      </span>
                    </div>
                  </div>

                  {diferencia > 0 && bolsillo.tasaRendimientoAnual > 0 && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1.5 font-medium">¿Cuánto de eso metiste tú? (opcional)</label>
                      <input
                        type="tel"
                        placeholder="0 si todo fue rendimiento"
                        className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        value={formSincronizar.aporteMio}
                        onChange={e => setFormSincronizar({...formSincronizar, aporteMio: e.target.value.replace(/[^0-9]/g, '')})}
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Si no metiste nada, déjalo en 0 y todo se registra como rendimiento</p>
                    </div>
                  )}

                  {diferencia > 0 && (
                    <div className="p-3 rounded-xl bg-black/30 border border-gray-700/30">
                      <p className="text-xs text-gray-400 mb-2">Se registrará:</p>
                      <div className="space-y-1.5">
                        {(aporteMioNum > 0 || bolsillo.tasaRendimientoAnual === 0) && (
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-400 flex items-center gap-1.5 text-sm">
                              <Plus size={14} /> Aporte tuyo
                            </span>
                            <span className="font-mono text-emerald-400">
                              {formatearDinero(bolsillo.tasaRendimientoAnual === 0 ? diferencia : aporteMioNum)}
                            </span>
                          </div>
                        )}
                        {rendimientoCalculado > 0 && bolsillo.tasaRendimientoAnual > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-blue-400 flex items-center gap-1.5 text-sm">
                              <TrendingUp size={14} /> Rendimiento
                            </span>
                            <span className="font-mono text-blue-400">{formatearDinero(rendimientoCalculado)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {diferencia < 0 && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                      <p className="text-xs text-gray-400 mb-2">Se registrará como retiro:</p>
                      <div className="flex items-center justify-between">
                        <span className="text-red-400 flex items-center gap-1.5 text-sm">
                          <ArrowDownRight size={14} /> Retiro
                        </span>
                        <span className="font-mono text-red-400">{formatearDinero(Math.abs(diferencia))}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setModalSincronizar({ visible: false, meta: null, bolsillo: null })}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!formSincronizar.saldoActual || saldoActualNum === bolsillo.saldo) return;
                    
                    const nuevosAportes: AporteMeta[] = [];
                    const hoy = getColombiaDateOnly();
                    
                    if (diferencia > 0) {
                      // Si el bolsillo no genera rendimientos, todo es aporte
                      if (bolsillo.tasaRendimientoAnual === 0) {
                        nuevosAportes.push({
                          id: Date.now(),
                          fecha: hoy,
                          monto: diferencia,
                          tipo: 'aporte',
                          nota: 'Sincronizado'
                        });
                      } else {
                        // Registrar aporte si hay
                        if (aporteMioNum > 0) {
                          nuevosAportes.push({
                            id: Date.now(),
                            fecha: hoy,
                            monto: aporteMioNum,
                            tipo: 'aporte',
                            nota: 'Sincronizado'
                          });
                        }
                        // Registrar rendimiento si hay
                        if (rendimientoCalculado > 0) {
                          nuevosAportes.push({
                            id: Date.now() + 1,
                            fecha: hoy,
                            monto: rendimientoCalculado,
                            tipo: 'rendimiento',
                            nota: 'Sincronizado'
                          });
                        }
                      }
                    } else {
                      // Es un retiro
                      nuevosAportes.push({
                        id: Date.now(),
                        fecha: hoy,
                        monto: diferencia,
                        tipo: 'retiro',
                        nota: 'Sincronizado'
                      });
                    }
                    
                    // Actualizar el bolsillo específico
                    setMetasFinancieras(prev => prev.map(m => {
                      if (m.id !== meta.id) return m;
                      
                      // Migrar si es necesario
                      const metaMigrada = migrarMetaABolsillos(m);
                      
                      const bolsillosActualizados = metaMigrada.bolsillos.map(b => {
                        if (b.id !== bolsillo.id) return b;
                        return {
                          ...b,
                          saldo: saldoActualNum,
                          historialAportes: [...b.historialAportes, ...nuevosAportes]
                        };
                      });
                      
                      const nuevoSaldoTotal = bolsillosActualizados.reduce((sum, b) => sum + b.saldo, 0);
                      
                      return {
                        ...metaMigrada,
                        bolsillos: bolsillosActualizados,
                        montoActual: nuevoSaldoTotal
                      };
                    }));
                    
                    setModalSincronizar({ visible: false, meta: null, bolsillo: null });
                    setFormSincronizar({ saldoActual: '', aporteMio: '' });
                  }}
                  disabled={!formSincronizar.saldoActual || saldoActualNum === bolsillo.saldo}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 disabled:shadow-none"
                >
                  Sincronizar
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modal Agregar/Editar Bolsillo */}
      {modalBolsillo.visible && modalBolsillo.meta && (() => {
        const meta = modalBolsillo.meta;
        const bolsilloEditar = modalBolsillo.bolsillo;
        const esEdicion = !!bolsilloEditar;
        
        return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <PiggyBank className="text-cyan-400" size={18} />
                </div>
                {esEdicion ? 'Editar Bolsillo' : 'Nuevo Bolsillo'}
              </h3>
              <button onClick={() => setModalBolsillo({ visible: false, meta: null, bolsillo: null })} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">Meta: {meta.nombre}</p>

            <div className="space-y-4">
              {/* Tipo de bolsillo */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Tipo de bolsillo</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_BOLSILLO.map(tipo => (
                    <button
                      key={tipo.tipo}
                      onClick={() => setFormBolsillo({
                        ...formBolsillo,
                        tipo: tipo.tipo,
                        nombre: tipo.nombre,
                        tasaRendimientoAnual: tipo.tasaDefault.toString(),
                        ...(tipo.tipo !== 'cdt' ? { fechaApertura: '', fechaVencimiento: '', renovacionAutomatica: false, entidadFinanciera: '', tipoInteres: 'compuesto' as const } : { fechaApertura: formBolsillo.fechaApertura || getColombiaDateOnly(), tipoInteres: formBolsillo.tipoInteres })
                      })}
                      className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${
                        formBolsillo.tipo === tipo.tipo
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                          : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-xl">{tipo.icono}</span>
                      <span className="text-sm font-medium">{tipo.nombre}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre personalizado */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Nombre (opcional)</label>
                <input
                  type="text"
                  placeholder={TIPOS_BOLSILLO.find(t => t.tipo === formBolsillo.tipo)?.nombre || 'Nombre del bolsillo'}
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  value={formBolsillo.nombre}
                  onChange={e => setFormBolsillo({...formBolsillo, nombre: e.target.value})}
                />
              </div>

              {/* Saldo inicial (solo al crear) */}
              {!esEdicion && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5 font-medium">Saldo actual</label>
                  <input
                    type="tel"
                    placeholder="0"
                    className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono text-xl focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    value={formBolsillo.saldo}
                    onChange={e => setFormBolsillo({...formBolsillo, saldo: e.target.value.replace(/[^0-9]/g, '')})}
                  />
                </div>
              )}

              {/* Tasa de rendimiento */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Tasa de rendimiento anual (%)</label>
                <input
                  type="text"
                  placeholder="11.5"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  value={formBolsillo.tasaRendimientoAnual}
                  onChange={e => setFormBolsillo({...formBolsillo, tasaRendimientoAnual: e.target.value.replace(/[^0-9.]/g, '')})}
                />
                <p className="text-xs text-gray-500 mt-1">Nu ≈ 11.5%, CDT ≈ 9.5%, Efectivo = 0%</p>
              </div>

              {/* Campos específicos CDT */}
              {formBolsillo.tipo === 'cdt' && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5 font-medium">Entidad financiera</label>
                    <input
                      type="text"
                      placeholder="Ej: Bancolombia, Davivienda..."
                      className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                      value={formBolsillo.entidadFinanciera}
                      onChange={e => setFormBolsillo({...formBolsillo, entidadFinanciera: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5 font-medium">Fecha de apertura</label>
                    <input
                      type="date"
                      className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                      value={formBolsillo.fechaApertura}
                      onChange={e => setFormBolsillo({...formBolsillo, fechaApertura: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5 font-medium">Fecha de vencimiento</label>
                    <input
                      type="date"
                      className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                      value={formBolsillo.fechaVencimiento}
                      min={formBolsillo.fechaApertura || undefined}
                      onChange={e => setFormBolsillo({...formBolsillo, fechaVencimiento: e.target.value})}
                    />
                    <div className="flex gap-2 mt-2">
                      {[3, 6, 12, 18].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            const base = formBolsillo.fechaApertura || getColombiaDateOnly();
                            const d = new Date(base + 'T12:00:00');
                            d.setMonth(d.getMonth() + m);
                            setFormBolsillo({...formBolsillo, fechaApertura: base, fechaVencimiento: d.toISOString().split('T')[0]});
                          }}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                            (() => {
                              if (!formBolsillo.fechaApertura || !formBolsillo.fechaVencimiento) return false;
                              const a = new Date(formBolsillo.fechaApertura + 'T12:00:00');
                              const v = new Date(formBolsillo.fechaVencimiento + 'T12:00:00');
                              const diff = (v.getFullYear() - a.getFullYear()) * 12 + v.getMonth() - a.getMonth();
                              return diff === m && a.getDate() === v.getDate();
                            })()
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                              : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:border-gray-600'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                    {formBolsillo.fechaApertura && formBolsillo.fechaVencimiento && (
                      <p className="text-xs text-amber-400/70 mt-1.5">
                        Plazo: {(() => {
                          const a = new Date(formBolsillo.fechaApertura + 'T12:00:00');
                          const v = new Date(formBolsillo.fechaVencimiento + 'T12:00:00');
                          const meses = Math.round((v.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
                          return meses >= 12 ? `${Math.floor(meses/12)} año${Math.floor(meses/12) > 1 ? 's' : ''} ${meses % 12 > 0 ? `y ${meses % 12} mes${meses % 12 > 1 ? 'es' : ''}` : ''}` : `${meses} mes${meses > 1 ? 'es' : ''}`;
                        })()}
                      </p>
                    )}
                  </div>

                  {/* Tipo de interés */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5 font-medium">Tipo de interes</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormBolsillo({...formBolsillo, tipoInteres: 'compuesto'})}
                        className={`p-3 rounded-xl border transition-all text-center ${
                          formBolsillo.tipoInteres === 'compuesto'
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                            : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <p className="text-sm font-medium">Compuesto</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Intereses generan intereses</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormBolsillo({...formBolsillo, tipoInteres: 'simple'})}
                        className={`p-3 rounded-xl border transition-all text-center ${
                          formBolsillo.tipoInteres === 'simple'
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                            : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <p className="text-sm font-medium">Simple</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Intereses sobre capital inicial</p>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-[#0f111a] border border-gray-700/50 rounded-xl p-3">
                    <div>
                      <p className="text-sm font-medium">Renovacion automatica</p>
                      <p className="text-xs text-gray-500">Se renueva al vencer con el mismo plazo</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormBolsillo({...formBolsillo, renovacionAutomatica: !formBolsillo.renovacionAutomatica})}
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        formBolsillo.renovacionAutomatica ? 'bg-amber-500' : 'bg-gray-700'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                        formBolsillo.renovacionAutomatica ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Preview de interés */}
                  {formBolsillo.saldo && parseFloat(formBolsillo.tasaRendimientoAnual) > 0 && formBolsillo.fechaApertura && formBolsillo.fechaVencimiento && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                      <p className="text-xs font-medium text-amber-400 mb-2">
                        Proyeccion interes {formBolsillo.tipoInteres === 'simple' ? 'simple' : 'compuesto'}
                      </p>
                      {(() => {
                        const capital = parseInt(formBolsillo.saldo) || 0;
                        const tasa = parseFloat(formBolsillo.tasaRendimientoAnual) / 100;
                        const a = new Date(formBolsillo.fechaApertura + 'T12:00:00');
                        const v = new Date(formBolsillo.fechaVencimiento + 'T12:00:00');
                        const meses = Math.max(1, Math.round((v.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
                        const valorFinal = formBolsillo.tipoInteres === 'simple'
                          ? capital * (1 + tasa * meses / 12)
                          : capital * Math.pow(1 + tasa / 12, meses);
                        const intereses = valorFinal - capital;
                        return (
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Capital</span>
                              <span className="font-mono">{formatearDineroCorto(capital)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Intereses ({meses}m)</span>
                              <span className="font-mono text-emerald-400">+{formatearDineroCorto(Math.round(intereses))}</span>
                            </div>
                            <div className="flex justify-between border-t border-amber-500/20 pt-1 font-medium">
                              <span className="text-amber-400">Al vencimiento</span>
                              <span className="font-mono text-amber-400">{formatearDineroCorto(Math.round(valorFinal))}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-2">
                {esEdicion && (
                  <button
                    onClick={() => {
                      if (!confirm(`¿Eliminar el bolsillo "${bolsilloEditar?.nombre}"?`)) return;
                      
                      setMetasFinancieras(prev => prev.map(m => {
                        if (m.id !== meta.id) return m;
                        const metaMigrada = migrarMetaABolsillos(m);
                        const bolsillosFiltrados = metaMigrada.bolsillos.filter(b => b.id !== bolsilloEditar?.id);
                        const nuevoSaldo = bolsillosFiltrados.reduce((sum, b) => sum + b.saldo, 0);
                        return {
                          ...metaMigrada,
                          bolsillos: bolsillosFiltrados,
                          montoActual: nuevoSaldo
                        };
                      }));
                      
                      setModalBolsillo({ visible: false, meta: null, bolsillo: null });
                    }}
                    className="p-3.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  onClick={() => setModalBolsillo({ visible: false, meta: null, bolsillo: null })}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const tipoBolsillo = TIPOS_BOLSILLO.find(t => t.tipo === formBolsillo.tipo);
                    const saldoInicial = parseInt(formBolsillo.saldo) || 0;
                    
                    if (esEdicion && bolsilloEditar) {
                      // Actualizar bolsillo existente
                      setMetasFinancieras(prev => prev.map(m => {
                        if (m.id !== meta.id) return m;
                        const metaMigrada = migrarMetaABolsillos(m);
                        const bolsillosActualizados = metaMigrada.bolsillos.map(b => {
                          if (b.id !== bolsilloEditar.id) return b;
                          const fechaAperturaEdit = formBolsillo.fechaApertura || b.fechaApertura || getColombiaDateOnly();
                          const fechaVencimientoEdit = formBolsillo.fechaVencimiento || b.fechaVencimiento || (() => {
                            const d = new Date(fechaAperturaEdit + 'T12:00:00');
                            d.setMonth(d.getMonth() + 6);
                            return d.toISOString().split('T')[0];
                          })();
                          const aEdit = new Date(fechaAperturaEdit + 'T12:00:00');
                          const vEdit = new Date(fechaVencimientoEdit + 'T12:00:00');
                          const plazoMesesEdit = Math.max(1, Math.round((vEdit.getTime() - aEdit.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
                          return {
                            ...b,
                            nombre: formBolsillo.nombre || (formBolsillo.tipo === 'cdt' ? `CDT ${formBolsillo.entidadFinanciera || ''}`.trim() : tipoBolsillo?.nombre || 'Bolsillo'),
                            tipo: formBolsillo.tipo,
                            icono: tipoBolsillo?.icono || '📦',
                            tasaRendimientoAnual: parseFloat(formBolsillo.tasaRendimientoAnual) || 0,
                            ...(formBolsillo.tipo === 'cdt' ? {
                              fechaApertura: fechaAperturaEdit,
                              fechaVencimiento: fechaVencimientoEdit,
                              plazoMeses: plazoMesesEdit,
                              renovacionAutomatica: formBolsillo.renovacionAutomatica,
                              capitalInicial: b.capitalInicial || b.saldo,
                              entidadFinanciera: formBolsillo.entidadFinanciera || undefined,
                              tipoInteres: formBolsillo.tipoInteres
                            } : {})
                          };
                        });
                        return {
                          ...metaMigrada,
                          bolsillos: bolsillosActualizados
                        };
                      }));
                    } else {
                      // Crear nuevo bolsillo
                      const fechaApertura = formBolsillo.fechaApertura || getColombiaDateOnly();
                      const fechaVencimiento = formBolsillo.fechaVencimiento || (() => {
                        const d = new Date(fechaApertura + 'T12:00:00');
                        d.setMonth(d.getMonth() + 6);
                        return d.toISOString().split('T')[0];
                      })();
                      const aCalc = new Date(fechaApertura + 'T12:00:00');
                      const vCalc = new Date(fechaVencimiento + 'T12:00:00');
                      const plazoMeses = Math.max(1, Math.round((vCalc.getTime() - aCalc.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));

                      const nuevoBolsillo: Bolsillo = {
                        id: Date.now(),
                        nombre: formBolsillo.nombre || (formBolsillo.tipo === 'cdt' ? `CDT ${formBolsillo.entidadFinanciera || ''}`.trim() : tipoBolsillo?.nombre || 'Bolsillo'),
                        icono: tipoBolsillo?.icono || '📦',
                        tipo: formBolsillo.tipo,
                        saldo: saldoInicial,
                        tasaRendimientoAnual: parseFloat(formBolsillo.tasaRendimientoAnual) || 0,
                        historialAportes: saldoInicial > 0 ? [{
                          id: Date.now(),
                          fecha: getColombiaDateOnly(),
                          monto: saldoInicial,
                          tipo: 'aporte',
                          nota: formBolsillo.tipo === 'cdt' ? 'Capital inicial CDT' : 'Saldo inicial'
                        }] : [],
                        // CDT fields
                        ...(formBolsillo.tipo === 'cdt' ? {
                          fechaApertura,
                          fechaVencimiento,
                          plazoMeses,
                          renovacionAutomatica: formBolsillo.renovacionAutomatica,
                          capitalInicial: saldoInicial,
                          entidadFinanciera: formBolsillo.entidadFinanciera || undefined,
                          numeroRenovaciones: 0,
                          tipoInteres: formBolsillo.tipoInteres
                        } : {})
                      };
                      
                      setMetasFinancieras(prev => prev.map(m => {
                        if (m.id !== meta.id) return m;
                        const metaMigrada = migrarMetaABolsillos(m);
                        const nuevosBolsillos = [...metaMigrada.bolsillos, nuevoBolsillo];
                        const nuevoSaldo = nuevosBolsillos.reduce((sum, b) => sum + b.saldo, 0);
                        return {
                          ...metaMigrada,
                          bolsillos: nuevosBolsillos,
                          montoActual: nuevoSaldo
                        };
                      }));
                    }
                    
                    setModalBolsillo({ visible: false, meta: null, bolsillo: null });
                  }}
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
                >
                  {esEdicion ? 'Guardar' : 'Crear Bolsillo'}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modal Aporte a Bolsillo */}
      {modalAporteBolsillo.visible && modalAporteBolsillo.meta && modalAporteBolsillo.bolsillo && (() => {
        const meta = modalAporteBolsillo.meta;
        const bolsillo = modalAporteBolsillo.bolsillo;
        
        return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#1a1f33] to-[#0f1219] w-full max-w-md rounded-2xl border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Plus className="text-emerald-400" size={18} />
                </div>
                Registrar Movimiento
              </h3>
              <button onClick={() => setModalAporteBolsillo({ visible: false, meta: null, bolsillo: null })} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="bg-black/30 rounded-xl p-3 mb-4 border border-gray-700/30">
              <div className="flex items-center gap-2">
                <span className="text-xl">{bolsillo.icono}</span>
                <div>
                  <p className="font-medium text-sm">{bolsillo.nombre}</p>
                  <p className="text-xs text-gray-500">Saldo: {formatearDinero(bolsillo.saldo)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Tipo de movimiento</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'aporte', label: 'Aporte', icon: Plus, color: 'emerald' },
                    { value: 'rendimiento', label: 'Rendimiento', icon: TrendingUp, color: 'blue' },
                    { value: 'retiro', label: 'Retiro', icon: ArrowDownRight, color: 'red' }
                  ].map(tipo => (
                    <button
                      key={tipo.value}
                      onClick={() => setFormAporte({...formAporte, tipo: tipo.value as 'aporte' | 'rendimiento' | 'retiro'})}
                      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1`}
                      style={formAporte.tipo === tipo.value ? {
                        backgroundColor: tipo.color === 'emerald' ? 'rgba(16, 185, 129, 0.2)' : tipo.color === 'blue' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        borderColor: tipo.color === 'emerald' ? 'rgba(16, 185, 129, 0.5)' : tipo.color === 'blue' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)',
                        color: tipo.color === 'emerald' ? '#34d399' : tipo.color === 'blue' ? '#60a5fa' : '#f87171'
                      } : {
                        backgroundColor: 'rgba(55, 65, 81, 0.5)',
                        borderColor: 'rgba(75, 85, 99, 0.5)',
                        color: '#9ca3af'
                      }}
                    >
                      <tipo.icon size={18} />
                      <span className="text-xs font-medium">{tipo.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Monto</label>
                <input
                  type="tel"
                  placeholder="0"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 font-mono text-xl focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={formAporte.monto}
                  onChange={e => setFormAporte({...formAporte, monto: e.target.value.replace(/[^0-9]/g, '')})}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">Nota (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Aporte mensual enero"
                  className="w-full bg-[#0f111a] border border-gray-700/50 rounded-xl p-3 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={formAporte.nota}
                  onChange={e => setFormAporte({...formAporte, nota: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setModalAporteBolsillo({ visible: false, meta: null, bolsillo: null })}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!formAporte.monto) return;
                    const monto = parseInt(formAporte.monto);
                    const nuevoAporte: AporteMeta = {
                      id: Date.now(),
                      fecha: getColombiaDateOnly(),
                      monto: formAporte.tipo === 'retiro' ? -monto : monto,
                      tipo: formAporte.tipo,
                      nota: formAporte.nota || ''
                    };
                    
                    setMetasFinancieras(prev => prev.map(m => {
                      if (m.id !== meta.id) return m;
                      const metaMigrada = migrarMetaABolsillos(m);
                      
                      const bolsillosActualizados = metaMigrada.bolsillos.map(b => {
                        if (b.id !== bolsillo.id) return b;
                        const nuevoSaldo = formAporte.tipo === 'retiro' 
                          ? Math.max(0, b.saldo - monto)
                          : b.saldo + monto;
                        return {
                          ...b,
                          saldo: nuevoSaldo,
                          historialAportes: [...b.historialAportes, nuevoAporte]
                        };
                      });
                      
                      const nuevoSaldoTotal = bolsillosActualizados.reduce((sum, b) => sum + b.saldo, 0);
                      
                      return {
                        ...metaMigrada,
                        bolsillos: bolsillosActualizados,
                        montoActual: nuevoSaldoTotal
                      };
                    }));
                    
                    setModalAporteBolsillo({ visible: false, meta: null, bolsillo: null });
                    setFormAporte({ monto: '', tipo: 'aporte', nota: '' });
                  }}
                  disabled={!formAporte.monto}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:shadow-none"
                >
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default FinanzasPage;
