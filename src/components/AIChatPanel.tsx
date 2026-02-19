import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, ArrowDown, Bot, User, AlertCircle, FileText, DollarSign, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';
import { useTenant } from '../context/TenantContext';
import { formatearDineroCorto, getColombiaISO, getColombiaDateOnly, obtenerHoraColombiana } from '../utils/helpers';
import type { Factura, Transaccion, CategoriaGasto, GastoFijo } from '../utils/types';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const CHAT_STORAGE_KEY = 'seya-ai-chat';

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string; // function name for tool response messages
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

// Action confirmation state - supports multiple tool calls
interface PendingAction {
  tool_calls: ToolCall[];
  descriptions: string[];
  messages: ChatMessage[];
}

interface AIChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

// Simple markdown renderer
const renderInline = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++} className="font-semibold text-white">{match[2]}</strong>);
    } else if (match[4]) {
      parts.push(<code key={key++} className="bg-gray-700/50 px-1 py-0.5 rounded text-cyan-300 text-xs">{match[4]}</code>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
};

const renderMarkdown = (text: string): React.ReactNode => {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  const collectList = () => {
    const items: React.ReactNode[] = [];
    while (i < lines.length) {
      const l = lines[i];
      // Top-level list item: *, -, +
      if (/^[\*\-\+]\s/.test(l)) {
        items.push(
          <li key={items.length} className="ml-4 list-disc">{renderInline(l.replace(/^[\*\-\+]\s/, ''))}</li>
        );
        i++;
      }
      // Sub-item (indented *, -, +)
      else if (/^\s+[\*\-\+]\s/.test(l)) {
        items.push(
          <li key={items.length} className="ml-8 list-circle text-gray-400">{renderInline(l.replace(/^\s+[\*\-\+]\s/, ''))}</li>
        );
        i++;
      }
      // Numbered list
      else if (/^\d+[\.\)]\s/.test(l)) {
        items.push(
          <li key={items.length} className="ml-4 list-decimal">{renderInline(l.replace(/^\d+[\.\)]\s/, ''))}</li>
        );
        i++;
      }
      else {
        break;
      }
    }
    return <ul key={blocks.length} className="space-y-0.5 my-1">{items}</ul>;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push(
        <pre key={blocks.length} className="bg-gray-900/80 p-3 rounded-lg overflow-x-auto text-xs my-2 border border-gray-700/50">
          <code className="text-gray-300">{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Header
    const headerMatch = line.match(/^(#{1,3})\s(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const sizes = ['text-base font-bold', 'text-sm font-bold', 'text-sm font-semibold'];
      blocks.push(
        <p key={blocks.length} className={`${sizes[level - 1]} text-white mt-2 mb-1`}>
          {renderInline(headerMatch[2])}
        </p>
      );
      i++;
      continue;
    }

    // List items
    if (/^[\*\-\+]\s/.test(line) || /^\s+[\*\-\+]\s/.test(line) || /^\d+[\.\)]\s/.test(line)) {
      blocks.push(collectList());
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular text
    blocks.push(
      <p key={blocks.length} className="my-0.5">{renderInline(line)}</p>
    );
    i++;
  }

  return <>{blocks}</>;
};

// Tool definitions for Groq function calling
// NOTE: Optional params use type array ["string","null"] because Llama sometimes sends null for omitted fields
const AI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'crear_factura',
      description: 'Crea una nueva factura/venta en el sistema. Usa esto cuando el usuario pida crear, agregar o registrar una factura nueva.',
      parameters: {
        type: 'object',
        properties: {
          cliente: { type: 'string', description: 'Nombre o número del cliente' },
          telefono: { type: ['string', 'null'], description: 'Teléfono del cliente' },
          revendedor: { type: ['string', 'null'], description: 'Nombre del revendedor. Si no se especifica, usar "Directo"' },
          empresa: { type: 'string', description: 'Nombre del servicio o producto (ej: Wom, Movistar, Samsung)' },
          montoFactura: { type: 'number', description: 'Monto de la factura del proveedor' },
          porcentaje: { type: ['number', 'null'], description: 'Porcentaje de cobro al cliente (ej: 40 para 40%). Si se da, cobroCliente = montoFactura * porcentaje / 100' },
          cobroCliente: { type: ['number', 'null'], description: 'Monto directo a cobrar al cliente. Usar solo si no se da porcentaje' },
        },
        required: ['cliente', 'empresa', 'montoFactura'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'modificar_factura',
      description: 'Modifica una factura existente. Busca por nombre de cliente. Solo enviar los campos que se quieren cambiar.',
      parameters: {
        type: 'object',
        properties: {
          cliente: { type: 'string', description: 'Nombre del cliente para buscar la factura a modificar' },
          nuevo_cliente: { type: ['string', 'null'], description: 'Nuevo nombre del cliente' },
          nuevo_telefono: { type: ['string', 'null'], description: 'Nuevo teléfono' },
          nuevo_revendedor: { type: ['string', 'null'], description: 'Nuevo revendedor' },
          nueva_empresa: { type: ['string', 'null'], description: 'Nuevo servicio/producto' },
          nuevo_montoFactura: { type: ['number', 'null'], description: 'Nuevo monto de factura' },
          nuevo_cobroCliente: { type: ['number', 'null'], description: 'Nuevo monto a cobrar al cliente' },
          nuevo_porcentaje: { type: ['number', 'null'], description: 'Nuevo porcentaje de cobro. Recalcula cobroCliente automáticamente' },
          nueva_fecha: { type: ['string', 'null'], description: 'Nueva fecha de la factura en formato YYYY-MM-DD (ej: 2025-02-03)' },
          nueva_fecha_cobro: { type: ['string', 'null'], description: 'Cambiar la fecha en que se cobró al cliente, formato YYYY-MM-DD' },
        },
        required: ['cliente'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'eliminar_factura',
      description: 'Elimina una factura del sistema. Busca por nombre de cliente.',
      parameters: {
        type: 'object',
        properties: {
          cliente: { type: 'string', description: 'Nombre del cliente de la factura a eliminar' },
        },
        required: ['cliente'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'registrar_abono',
      description: 'Registra un pago/abono de un cliente a una factura existente pendiente de cobro.',
      parameters: {
        type: 'object',
        properties: {
          cliente: { type: 'string', description: 'Nombre del cliente que paga' },
          monto: { type: ['number', 'null'], description: 'Monto del abono. Si no se especifica, se paga el saldo completo' },
          tipo: { type: ['string', 'null'], enum: ['total', 'parcial'], description: 'Si es pago total o parcial. Default: total' },
        },
        required: ['cliente'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crear_transaccion',
      description: 'Registra un ingreso o gasto en la sección de Finanzas.',
      parameters: {
        type: 'object',
        properties: {
          descripcion: { type: 'string', description: 'Descripción de la transacción' },
          monto: { type: 'number', description: 'Monto de la transacción' },
          tipo: { type: 'string', enum: ['ingreso', 'gasto'], description: 'Tipo: ingreso o gasto' },
          categoria: { type: ['string', 'null'], enum: ['servicios', 'arriendo', 'agua', 'luz', 'internet', 'telefono', 'tv', 'transporte', 'alimentacion', 'mercado', 'salud', 'educacion', 'entretenimiento', 'otros'], description: 'Categoría. Default: otros' },
        },
        required: ['descripcion', 'monto', 'tipo'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'marcar_pagado_proveedor',
      description: 'Marca una factura como pagada al proveedor. Busca por nombre de cliente.',
      parameters: {
        type: 'object',
        properties: {
          cliente: { type: 'string', description: 'Nombre del cliente de la factura a marcar como pagada' },
        },
        required: ['cliente'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'eliminar_transaccion',
      description: 'Elimina una transacción (ingreso o gasto) existente. Busca por descripción.',
      parameters: {
        type: 'object',
        properties: {
          descripcion: { type: 'string', description: 'Descripción o parte del nombre de la transacción a eliminar' },
        },
        required: ['descripcion'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'modificar_transaccion',
      description: 'Modifica una transacción (ingreso o gasto) existente. Busca por descripción. Solo enviar campos a cambiar.',
      parameters: {
        type: 'object',
        properties: {
          descripcion: { type: 'string', description: 'Descripción de la transacción a buscar' },
          nueva_descripcion: { type: ['string', 'null'], description: 'Nueva descripción' },
          nuevo_monto: { type: ['number', 'null'], description: 'Nuevo monto' },
          nuevo_tipo: { type: ['string', 'null'], enum: ['ingreso', 'gasto'], description: 'Cambiar tipo' },
          nueva_categoria: { type: ['string', 'null'], enum: ['servicios', 'arriendo', 'agua', 'luz', 'internet', 'telefono', 'tv', 'transporte', 'alimentacion', 'mercado', 'salud', 'educacion', 'entretenimiento', 'otros'], description: 'Nueva categoría' },
        },
        required: ['descripcion'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'crear_gasto_fijo',
      description: 'Crea un gasto fijo mensual recurrente (ej: arriendo, internet, servicios).',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del gasto fijo' },
          monto: { type: 'number', description: 'Monto mensual estimado' },
          categoria: { type: ['string', 'null'], enum: ['servicios', 'arriendo', 'agua', 'luz', 'internet', 'telefono', 'tv', 'transporte', 'alimentacion', 'mercado', 'salud', 'educacion', 'entretenimiento', 'otros'], description: 'Categoría. Default: otros' },
          diaCorte: { type: ['number', 'null'], description: 'Día del mes en que se paga (1-31). Default: 1' },
        },
        required: ['nombre', 'monto'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'modificar_gasto_fijo',
      description: 'Modifica un gasto fijo existente. Busca por nombre. Solo enviar campos a cambiar.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del gasto fijo a buscar' },
          nuevo_nombre: { type: ['string', 'null'], description: 'Nuevo nombre' },
          nuevo_monto: { type: ['number', 'null'], description: 'Nuevo monto mensual' },
          nueva_categoria: { type: ['string', 'null'], enum: ['servicios', 'arriendo', 'agua', 'luz', 'internet', 'telefono', 'tv', 'transporte', 'alimentacion', 'mercado', 'salud', 'educacion', 'entretenimiento', 'otros'], description: 'Nueva categoría' },
          nuevo_diaCorte: { type: ['number', 'null'], description: 'Nuevo día de corte' },
        },
        required: ['nombre'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'eliminar_gasto_fijo',
      description: 'Elimina un gasto fijo. Busca por nombre.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del gasto fijo a eliminar' },
        },
        required: ['nombre'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'marcar_gasto_fijo_pagado',
      description: 'Marca un gasto fijo como pagado este mes.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del gasto fijo' },
          montoPagado: { type: ['number', 'null'], description: 'Monto real pagado (si difiere del estimado)' },
        },
        required: ['nombre'],
      },
    },
  },
];

const AIChatPanel = ({ isOpen, onToggle }: AIChatPanelProps) => {
  const { facturas, setFacturas, gastosFijos, setGastosFijos, transacciones, setTransacciones, presupuestoMensual, facturasOcultas, metasFinancieras, metaAhorro, pagosRevendedores } = useData();
  const { currentTenant } = useTenant();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filter out hidden invoices
  const facturasVisibles = facturas.filter(f => !facturasOcultas.includes(f.id));

  // Quick stats (null-safe)
  const facturasPendientes = facturasVisibles.filter(f => !f.cobradoACliente);
  const montoPorCobrar = facturasPendientes.reduce((sum, f) => sum + ((f.cobroCliente || 0) - (f.abono || 0)), 0);

  // Build system prompt
  const buildSystemPrompt = useCallback((): string => {
    const now = new Date();
    const hoy = now.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Bogota' });
    const horaExacta = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const pendientesCobro = facturasVisibles.filter(f => !f.cobradoACliente);
    const pendientesPago = facturasVisibles.filter(f => !f.pagadoAProveedor);
    const totalPorCobrar = pendientesCobro.reduce((sum, f) => sum + ((f.cobroCliente || 0) - (f.abono || 0)), 0);
    const totalGastosFijos = gastosFijos.reduce((sum, g) => sum + (g.monto || 0), 0);
    const gastosFijosPendientes = gastosFijos.filter(g => !g.pagadoEsteMes);

    // Monthly data
    const facturasEsteMes = facturasVisibles.filter(f => f.fechaISO?.startsWith(currentMonth));
    const facturasMesPasado = facturasVisibles.filter(f => f.fechaISO?.startsWith(prevMonth));
    const transEsteMes = transacciones.filter(t => t.fecha?.startsWith(currentMonth));
    const transMesPasado = transacciones.filter(t => t.fecha?.startsWith(prevMonth));

    const calc = (fs: typeof facturasVisibles) => ({
      count: fs.length,
      ventas: fs.reduce((s, f) => s + (f.cobroCliente || 0), 0),
      ganancia: fs.reduce((s, f) => s + ((f.cobroCliente || 0) - (f.costoInicial || 0)), 0),
      cobrado: fs.filter(f => f.cobradoACliente).reduce((s, f) => s + (f.cobroCliente || 0), 0),
    });
    const calcTx = (ts: typeof transacciones) => ({
      ingresos: ts.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + (t.monto || 0), 0),
      gastos: ts.filter(t => t.tipo === 'gasto').reduce((s, t) => s + (t.monto || 0), 0),
    });

    const mesActual = { ...calc(facturasEsteMes), ...calcTx(transEsteMes) };
    const mesPasado = { ...calc(facturasMesPasado), ...calcTx(transMesPasado) };

    // Build structured data object
    const data = {
      usuario_actual: {
        nombre: currentTenant?.name || 'Usuario',
        tienda: currentTenant?.shopName || 'Seya Shop',
        es_admin: currentTenant?.isAdmin || false,
      },
      fecha_hoy: hoy,
      hora_actual: horaExacta,
      resumen: {
        facturas_totales: facturasVisibles.length,
        pendientes_cobro: { cantidad: pendientesCobro.length, monto: totalPorCobrar },
        pendientes_pago_proveedor: pendientesPago.length,
        presupuesto_mensual: presupuestoMensual,
        meta_ahorro_general: { monto: metaAhorro.monto || 0, activa: metaAhorro.activa },
      },
      mes_actual: {
        periodo: currentMonth,
        facturas: mesActual.count,
        ventas: mesActual.ventas,
        ganancia_bruta: mesActual.ganancia,
        cobrado: mesActual.cobrado,
        ingresos_extra: mesActual.ingresos,
        gastos: mesActual.gastos,
        // Balance REAL: ganancia de facturas + ingresos extra - gastos
        balance_total: mesActual.ganancia + mesActual.ingresos - mesActual.gastos,
        // Desglose para claridad
        _explicacion_balance: `Ganancia facturas (${mesActual.ganancia}) + Ingresos extra (${mesActual.ingresos}) - Gastos (${mesActual.gastos}) = ${mesActual.ganancia + mesActual.ingresos - mesActual.gastos}`,
      },
      mes_anterior: {
        periodo: prevMonth,
        facturas: mesPasado.count,
        ventas: mesPasado.ventas,
        ganancia_bruta: mesPasado.ganancia,
        ingresos_extra: mesPasado.ingresos,
        gastos: mesPasado.gastos,
        balance_total: mesPasado.ganancia + mesPasado.ingresos - mesPasado.gastos,
      },
      deudores: Object.entries(
        pendientesCobro.reduce((acc, f) => {
          const key = f.revendedor || f.cliente;
          if (!acc[key]) acc[key] = [];
          acc[key].push({
            cliente: f.cliente,
            telefono: f.telefono || null,
            servicio: f.empresa || null,
            fecha: f.fechaDisplay || f.fechaISO?.slice(0, 10) || null,
            fechaISO: f.fechaISO || null,
            cobro: f.cobroCliente || 0,
            abono: f.abono || 0,
            saldo: (f.cobroCliente || 0) - (f.abono || 0),
            garantia: f.usoGarantia ? { motivo: f.motivoGarantia, resuelta: f.garantiaResuelta } : null,
            promesa_pago: f.fechaPromesa || null,
          });
          return acc;
        }, {} as Record<string, unknown[]>)
      ).map(([nombre, facturas]) => {
        const total = (facturas as Array<{saldo: number}>).reduce((s, f) => s + f.saldo, 0);
        const totalCobro = (facturas as Array<{cobro: number}>).reduce((s, f) => s + f.cobro, 0);
        const totalAbono = (facturas as Array<{abono: number}>).reduce((s, f) => s + f.abono, 0);
        return {
          revendedor: nombre,
          cantidad_facturas: facturas.length,
          total_cobro: totalCobro,
          total_abonado: totalAbono,
          saldo_pendiente: total,
          facturas,
        };
      }).sort((a, b) => b.saldo_pendiente - a.saldo_pendiente),
      garantias_pendientes: facturasVisibles.filter(f => f.usoGarantia && !f.garantiaResuelta).map(f => ({
        cliente: f.cliente, revendedor: f.revendedor, servicio: f.empresa,
        fecha: f.fechaDisplay || f.fechaISO?.slice(0, 10),
        motivo: f.motivoGarantia, reportada: f.fechaGarantia,
      })),
      facturas_cobradas_recientes: facturasVisibles
        .filter(f => f.cobradoACliente)
        .sort((a, b) => new Date(b.fechaISO || '').getTime() - new Date(a.fechaISO || '').getTime())
        .slice(0, 30)
        .map(f => ({
          fecha: f.fechaDisplay || f.fechaISO?.slice(0, 10),
          cliente: f.cliente, revendedor: f.revendedor, servicio: f.empresa,
          cobrado: f.cobroCliente || 0,
          costo: f.costoInicial || 0,
          ganancia: (f.cobroCliente || 0) - (f.costoInicial || 0),
        })),
      pendientes_pago_proveedor: pendientesPago.slice(0, 30).map(f => ({
        fecha: f.fechaDisplay || f.fechaISO?.slice(0, 10),
        cliente: f.cliente, revendedor: f.revendedor, servicio: f.empresa,
        monto_factura: f.montoFactura || 0, abonado_proveedor: f.abonoProveedor || 0,
      })),
      gastos_fijos: {
        total_mensual: totalGastosFijos,
        pendientes_este_mes: gastosFijosPendientes.length,
        monto_pendiente: gastosFijosPendientes.reduce((s, g) => s + (g.monto || 0), 0),
        detalle: gastosFijos.map(g => ({
          nombre: g.nombre, monto: g.monto, categoria: g.categoria,
          dia_corte: g.diaCorte, pagado: g.pagadoEsteMes,
          monto_pagado: g.montoPagadoEsteMes || null,
        })),
      },
      transacciones_recientes: transacciones.slice(-30).map(t => ({
        fecha: t.fecha, tipo: t.tipo, monto: t.monto,
        categoria: t.categoria, descripcion: t.descripcion,
      })),
      metas_financieras: metasFinancieras.filter(m => m.activa).map(m => {
        const totalBolsillos = m.bolsillos?.reduce((s, b) => s + (b.saldo || 0), 0) || 0;
        const montoReal = totalBolsillos || m.montoActual || 0;
        return {
          nombre: m.nombre,
          icono: m.icono,
          objetivo: m.montoObjetivo,
          ahorrado: montoReal,
          progreso_pct: Math.round((montoReal / (m.montoObjetivo || 1)) * 100),
          faltante: (m.montoObjetivo || 0) - montoReal,
          aporte_mensual_planeado: m.aporteMensualPlaneado,
          prioridad: m.prioridad,
          fecha_inicio: m.fechaInicio,
          fecha_objetivo: m.fechaObjetivo || null,
          bolsillos: m.bolsillos?.map(b => ({
            nombre: b.nombre,
            tipo: b.tipo,
            saldo: b.saldo || 0,
            rendimiento_anual_pct: b.tasaRendimientoAnual,
            ultimos_aportes: b.historialAportes?.slice(-5).map(a => ({
              fecha: a.fecha, monto: a.monto, tipo: a.tipo,
            })),
          })) || [],
        };
      }),
      pagos_revendedores: pagosRevendedores.slice(-15).map(p => ({
        fecha: p.fecha, revendedor: p.revendedor,
        monto: p.montoTotal, nota: p.nota || null,
      })),
    };

    const shopName = currentTenant?.shopName || 'Seya Shop';
    const userName = currentTenant?.name || 'Usuario';

    return `Eres el asistente de ${shopName}. Hoy es ${hoy}, son las ${horaExacta}. Estás hablando con ${userName}.

⚠️ IMPORTANTE: Sos un asistente conversacional que TAMBIÉN puede ejecutar acciones. La MAYORÍA de las veces solo vas a CONVERSAR - responder preguntas, dar información, chatear. Solo usás herramientas cuando el usuario EXPLÍCITAMENTE te pida hacer algo en la app (crear, eliminar, modificar datos). Si el usuario pregunta algo de conocimiento general o solo quiere charlar, RESPONDÉ NORMALMENTE SIN USAR HERRAMIENTAS.

QUIÉN ERES: Sos el asistente inteligente integrado en ${shopName}, la app de gestión de negocio de ${userName}. No sos un chatbot externo — sos parte de la app. Tenés acceso directo a todos los datos en tiempo real. Hablá como un socio de confianza que conoce el negocio por dentro. Podés responder preguntas generales, dar consejos, chatear, Y TAMBIÉN ejecutar acciones en la app cuando te lo pidan.

EL NEGOCIO: El usuario vende servicios de telecomunicaciones en Colombia a través de revendedores. Usa esta app para:
- NEGOCIO: crear facturas, pagar proveedores, cobrar clientes, registrar abonos parciales, manejar garantías (30 días), gestionar revendedores, ver estadísticas y ranking de servicios
- FINANZAS: gastos fijos con día de corte, ingresos/gastos, metas de ahorro con bolsillos (Nu Bank 11.5% EA, efectivo, bancos), análisis de gastos, insights financieros, presupuesto mensual

DATOS EN TIEMPO REAL:
${JSON.stringify(data, null, 2)}

ACCIONES QUE PODÉS EJECUTAR (usa las herramientas/tools cuando el usuario lo pida):
FACTURAS:
- crear_factura: Crear factura nueva. Soporta porcentaje (ej: al 40% = montoFactura * 0.40)
- modificar_factura: Modificar campos de factura existente
- eliminar_factura: Eliminar factura
- registrar_abono: Registrar pago/abono de un cliente
- marcar_pagado_proveedor: Marcar factura como pagada al proveedor
TRANSACCIONES:
- crear_transaccion: Registrar ingreso o gasto en Finanzas
- modificar_transaccion: Modificar transacción existente (descripción, monto, tipo, categoría)
- eliminar_transaccion: Eliminar transacción existente
GASTOS FIJOS:
- crear_gasto_fijo: Crear gasto fijo mensual recurrente
- modificar_gasto_fijo: Modificar gasto fijo (nombre, monto, categoría, día de corte)
- eliminar_gasto_fijo: Eliminar gasto fijo
- marcar_gasto_fijo_pagado: Marcar gasto fijo como pagado este mes
⚠️ REGLAS CRÍTICAS - CUÁNDO USAR HERRAMIENTAS ⚠️

**PRIMERO PREGUNTATE: ¿El usuario quiere que YO HAGA algo en SU APP?**
- Si la respuesta es NO → NO uses herramientas, solo respondé con texto
- Si la respuesta es SÍ → Usá la herramienta apropiada

**NUNCA uses herramientas para:**
- Preguntas generales de conocimiento ("qué cuesta el pollo", "quién es el presidente", "cómo cocinar arroz")
- Conversación casual ("hola", "cómo estás", "gracias")
- Preguntas sobre tus capacidades ("qué puedes hacer", "puedes eliminar facturas?")
- Consultas de datos ("cuánto me debe X", "muéstrame las facturas", "qué gastos tengo")
- Cualquier cosa que NO sea una acción explícita sobre los datos de la app

**SÍ usá herramientas SOLO cuando el usuario diga EXPLÍCITAMENTE:**
- "Creá/Agregá/Registrá..." una factura, gasto, ingreso
- "Eliminá/Borrá..." una factura, transacción, etc.
- "Modificá/Cambiá..." algún dato existente
- "Marcá como pagado..." una factura o gasto
- "Gasté X en Y" o "Me pagaron X" (acciones implícitas de registro)

**Verbos de CONSULTA (NO usar herramientas):** mostrar, ver, listar, cuánto, cuántos, cuáles, dime, dame, quiénes, revisar, analizar, resumir, explicar, cómo, qué es, por qué

**Verbos de ACCIÓN (SÍ usar herramientas):** crear, agregar, modificar, cambiar, eliminar, borrar, registrar, marcar, pagar, gasté, pagué, me pagaron, compré

**REGLAS ADICIONALES:**
- NUNCA uses textos de ejemplo/placeholder como valores reales
- Si falta info para una acción (nombre, monto), PREGUNTÁ antes de ejecutar
- Si te piden MODIFICAR algo, usá la herramienta de modificar, NO crear uno nuevo
- **MÚLTIPLES ACCIONES**: Si el usuario menciona VARIOS gastos/ingresos en UN mensaje (ej: "gasté 50k en Frisby, 30k en Uber"), ejecutá MÚLTIPLES tool_calls - una por cada acción

⛔⛔⛔ ERROR CRÍTICO A EVITAR - LEÉ ESTO ⛔⛔⛔
**NUNCA re-ejecutes acciones de mensajes anteriores del chat.**
- Cada mensaje del usuario es INDEPENDIENTE
- Si el usuario YA registró gastos antes y ahora PREGUNTA algo ("cuánto llevamos", "qué gastos hay"), eso es una CONSULTA - respondé con texto, NO vuelvas a crear los gastos
- Si ves "✅" en mensajes anteriores, esas acciones YA SE EJECUTARON. NO las repitas.
- El historial de chat es solo CONTEXTO, no son nuevas instrucciones
- Solo ejecutá herramientas para el ÚLTIMO mensaje del usuario, y SOLO si ese mensaje pide una ACCIÓN

Ejemplo de lo que NO debes hacer:
- Usuario: "gasté 50k en comida" → Vos: ejecutás crear_transaccion ✅
- Usuario: "cuánto llevo de gastos?" → Vos: NO ejecutes crear_transaccion de nuevo, solo RESPONDÉ con el total

CÓMO RESPONDER:
- Español colombiano, natural y directo. Nada de frases genéricas ni "según los datos proporcionados"
- Respondé como si estuvieras viendo la app junto con el usuario — porque literalmente tenés los mismos datos
- Usá los números exactos del JSON. Nunca inventes cifras
- ARITMÉTICA: NUNCA hagas sumas manuales paso a paso. Los campos "saldo_pendiente", "total_cobro", "total_abonado" en cada deudor ya están PRE-CALCULADOS y son EXACTOS. Usá esos valores directamente. Si te piden verificar un total, mostrá el campo pre-calculado, NO sumes factura por factura
- Cuando te pregunten por fechas, montos o detalles de facturas, buscá en el JSON y respondé con precisión
- Si te preguntan sobre la app, podés opinar, explicar funcionalidades y sugerir mejoras — la conocés toda
- Sé proactivo: si ves algo importante (deuda vieja, gasto alto, meta atrasada), mencionalo
- Formateá montos como pesos colombianos ($X.XXX.XXX)
- Usá markdown para formatear: **negrita**, listas con -, encabezados con ##
- Respuestas concisas pero completas. No repitas los datos en tablas enormes a menos que te lo pidan
- NUNCA digas que podés hacer algo que no está en tus herramientas. Si no podés, decilo honestamente`;
  }, [facturasVisibles, gastosFijos, transacciones, presupuestoMensual, metasFinancieras, metaAhorro, pagosRevendedores, montoPorCobrar, currentTenant]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!showScrollDown && isOpen) {
      scrollToBottom();
    }
  }, [messages, showScrollDown, scrollToBottom, isOpen]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!isAtBottom);
  };

  // Persist chat to localStorage
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
      } else {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    } catch { /* ignore quota errors */ }
  }, [messages]);

  // Execute a tool call - returns result string
  const executeTool = useCallback((toolCall: ToolCall): string => {
    // Strip null values - LLM sometimes sends null for optional params it doesn't want to change
    const rawArgs = JSON.parse(toolCall.function.arguments);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawArgs)) {
      if (v !== null && v !== undefined) args[k] = v;
    }
    const name = toolCall.function.name;

    if (name === 'crear_factura') {
      const pct = args.porcentaje || 0;
      const cobro = pct > 0 ? Math.round(args.montoFactura * pct / 100) : (args.cobroCliente || args.montoFactura);
      const nuevaFactura: Factura = {
        id: Date.now(),
        cliente: args.cliente,
        telefono: args.telefono || '',
        revendedor: args.revendedor || 'Directo',
        empresa: args.empresa,
        montoFactura: args.montoFactura,
        porcentajeAplicado: pct,
        costoInicial: args.montoFactura,
        costoGarantia: 0,
        cobroCliente: cobro,
        abono: 0,
        historialAbonos: [],
        fechaPromesa: null,
        pagadoAProveedor: false,
        cobradoACliente: false,
        usoGarantia: false,
        fechaISO: getColombiaISO(),
        fechaDisplay: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' }),
        fechaPagoReal: null,
        fechaGarantia: null,
        garantiaResuelta: false,
        fechaResolucionGarantia: null,
        motivoGarantia: null,
      };
      setFacturas(prev => [nuevaFactura, ...prev]);
      const pctStr = pct > 0 ? ` (${pct}% de $${args.montoFactura.toLocaleString('es-CO')})` : '';
      return JSON.stringify({ ok: true, message: `Factura creada: ${args.cliente} - ${args.empresa} | Cobro: $${cobro.toLocaleString('es-CO')}${pctStr}` });
    }

    if (name === 'modificar_factura') {
      const searchTerm = args.cliente.toLowerCase();
      const factura = facturas.find(f =>
        !facturasOcultas.includes(f.id) &&
        (f.cliente.toLowerCase().includes(searchTerm) || f.revendedor?.toLowerCase().includes(searchTerm))
      );
      if (!factura) return JSON.stringify({ ok: false, message: `No se encontró factura para "${args.cliente}"` });

      // Accept both naming conventions (nuevo_X and X) - LLM may confuse crear/modificar field names
      const newPct = args.nuevo_porcentaje ?? args.porcentaje;
      const newMonto = args.nuevo_montoFactura ?? args.montoFactura;
      const newCobro = args.nuevo_cobroCliente ?? args.cobroCliente;
      const newCliente = args.nuevo_cliente;
      const newTelefono = args.nuevo_telefono;
      const newRevendedor = args.nuevo_revendedor;
      const newEmpresa = args.nueva_empresa ?? args.empresa;

      // Compute final values upfront so result message is accurate
      const baseMonto = newMonto ?? factura.montoFactura;
      let finalCobro = factura.cobroCliente || 0;
      let finalPct = factura.porcentajeAplicado || 0;
      const changes: string[] = [];

      if (newMonto != null && newMonto !== factura.montoFactura) changes.push(`monto factura: $${baseMonto.toLocaleString('es-CO')}`);
      if (newPct != null) {
        finalPct = newPct;
        finalCobro = Math.round(baseMonto * newPct / 100);
        changes.push(`${newPct}% → cobro $${finalCobro.toLocaleString('es-CO')}`);
      } else if (newCobro != null) {
        finalCobro = newCobro;
        changes.push(`cobro: $${finalCobro.toLocaleString('es-CO')}`);
      }
      if (newEmpresa && newEmpresa !== factura.empresa) changes.push(`servicio: ${newEmpresa}`);
      if (newCliente) changes.push(`cliente: ${newCliente}`);
      if (newTelefono) changes.push(`teléfono: ${newTelefono}`);
      if (newRevendedor) changes.push(`revendedor: ${newRevendedor}`);

      // Date changes
      const newFecha = args.nueva_fecha as string | undefined;
      const newFechaCobro = args.nueva_fecha_cobro as string | undefined;
      if (newFecha) {
        const d = new Date(newFecha + 'T12:00:00');
        changes.push(`fecha: ${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' })}`);
      }
      if (newFechaCobro) {
        const d = new Date(newFechaCobro + 'T12:00:00');
        changes.push(`fecha cobro: ${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' })}`);
      }

      setFacturas(prev => prev.map(f => {
        if (f.id !== factura.id) return f;
        const updated = { ...f };
        if (newCliente) updated.cliente = newCliente as string;
        if (newTelefono) updated.telefono = newTelefono as string;
        if (newRevendedor) updated.revendedor = newRevendedor as string;
        if (newEmpresa) updated.empresa = newEmpresa as string;
        if (newMonto != null) {
          updated.montoFactura = baseMonto as number;
          updated.costoInicial = baseMonto as number;
        }
        if (newPct != null) {
          updated.porcentajeAplicado = finalPct;
          updated.cobroCliente = finalCobro;
        } else if (newCobro != null) {
          updated.cobroCliente = finalCobro;
        }
        // Change invoice creation date
        if (newFecha) {
          updated.fechaISO = newFecha;
          const d = new Date(newFecha + 'T12:00:00');
          updated.fechaDisplay = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' });
        }
        // Change collection date (update last historialAbonos entry + fechaPagoReal)
        if (newFechaCobro) {
          if (updated.historialAbonos && updated.historialAbonos.length > 0) {
            updated.historialAbonos = [...updated.historialAbonos];
            updated.historialAbonos[updated.historialAbonos.length - 1] = {
              ...updated.historialAbonos[updated.historialAbonos.length - 1],
              fecha: newFechaCobro,
            };
          }
          updated.fechaPagoReal = newFechaCobro;
        }
        return updated;
      }));

      const changesStr = changes.length > 0 ? changes.join(', ') : 'sin cambios detectados';
      return JSON.stringify({ ok: true, message: `Factura de ${factura.cliente} (${factura.empresa}) modificada: ${changesStr}` });
    }

    if (name === 'eliminar_factura') {
      const searchTerm = args.cliente.toLowerCase();
      const factura = facturas.find(f =>
        !facturasOcultas.includes(f.id) &&
        (f.cliente.toLowerCase().includes(searchTerm) || f.revendedor?.toLowerCase().includes(searchTerm))
      );
      if (!factura) return JSON.stringify({ ok: false, message: `No se encontró factura para "${args.cliente}"` });

      setFacturas(prev => prev.filter(f => f.id !== factura.id));
      return JSON.stringify({ ok: true, message: `Factura eliminada: ${factura.cliente} - ${factura.empresa} ($${(factura.cobroCliente || 0).toLocaleString('es-CO')})` });
    }

    if (name === 'registrar_abono') {
      const searchTerm = args.cliente.toLowerCase();
      const factura = facturas.find(f =>
        !f.cobradoACliente && !facturasOcultas.includes(f.id) &&
        (f.cliente.toLowerCase().includes(searchTerm) || f.revendedor?.toLowerCase().includes(searchTerm))
      );
      if (!factura) return JSON.stringify({ ok: false, message: `No se encontró factura pendiente para "${args.cliente}"` });

      const saldo = (factura.cobroCliente || 0) - (factura.abono || 0);
      const esPagoTotal = !args.tipo || args.tipo === 'total' || (args.monto && args.monto >= saldo);
      const montoAbono = esPagoTotal ? saldo : (args.monto || saldo);

      setFacturas(prev => prev.map(f => {
        if (f.id !== factura.id) return f;
        const historial = [...(f.historialAbonos || []), {
          monto: montoAbono,
          fecha: getColombiaDateOnly(),
          tipo: esPagoTotal ? 'pago_completo' as const : 'abono_parcial' as const,
        }];
        const totalAbonado = (f.abono || 0) + montoAbono;
        const completado = totalAbonado >= (f.cobroCliente || 0);
        return { ...f, abono: totalAbonado, cobradoACliente: completado, historialAbonos: historial, fechaPromesa: completado ? null : f.fechaPromesa };
      }));
      return JSON.stringify({ ok: true, message: `Abono registrado: $${montoAbono} para ${factura.cliente} (${factura.empresa}). ${esPagoTotal ? 'Factura pagada completamente.' : `Saldo restante: $${saldo - montoAbono}`}` });
    }

    if (name === 'crear_transaccion') {
      const nueva: Transaccion = {
        id: Date.now(),
        descripcion: args.descripcion,
        monto: args.monto,
        categoria: (args.categoria || 'otros') as CategoriaGasto,
        tipo: args.tipo,
        fecha: getColombiaDateOnly(),
        fechaCreacion: getColombiaISO(),
      };
      setTransacciones(prev => [nueva, ...prev]);
      return JSON.stringify({ ok: true, message: `${args.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado: ${args.descripcion} por $${args.monto}` });
    }

    if (name === 'marcar_pagado_proveedor') {
      const searchTerm = args.cliente.toLowerCase();
      const factura = facturas.find(f =>
        !f.pagadoAProveedor && !facturasOcultas.includes(f.id) &&
        (f.cliente.toLowerCase().includes(searchTerm) || f.revendedor?.toLowerCase().includes(searchTerm))
      );
      if (!factura) return JSON.stringify({ ok: false, message: `No se encontró factura pendiente de pago a proveedor para "${args.cliente}"` });

      setFacturas(prev => prev.map(f =>
        f.id === factura.id ? { ...f, pagadoAProveedor: true, fechaPagoReal: obtenerHoraColombiana() } : f
      ));
      return JSON.stringify({ ok: true, message: `Factura de ${factura.cliente} (${factura.empresa}) marcada como pagada al proveedor` });
    }

    if (name === 'eliminar_transaccion') {
      const searchTerm = args.descripcion.toLowerCase();
      const tx = transacciones.find(t => t.descripcion.toLowerCase().includes(searchTerm));
      if (!tx) return JSON.stringify({ ok: false, message: `No se encontró transacción "${args.descripcion}"` });
      setTransacciones(prev => prev.filter(t => t.id !== tx.id));
      return JSON.stringify({ ok: true, message: `${tx.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} eliminado: ${tx.descripcion} ($${tx.monto.toLocaleString('es-CO')})` });
    }

    if (name === 'modificar_transaccion') {
      const searchTerm = args.descripcion.toLowerCase();
      const tx = transacciones.find(t => t.descripcion.toLowerCase().includes(searchTerm));
      if (!tx) return JSON.stringify({ ok: false, message: `No se encontró transacción "${args.descripcion}"` });
      const changes: string[] = [];
      setTransacciones(prev => prev.map(t => {
        if (t.id !== tx.id) return t;
        const updated = { ...t };
        if (args.nueva_descripcion) { updated.descripcion = args.nueva_descripcion; changes.push(`descripción: ${args.nueva_descripcion}`); }
        if (args.nuevo_monto != null) { updated.monto = args.nuevo_monto; changes.push(`monto: $${args.nuevo_monto.toLocaleString('es-CO')}`); }
        if (args.nuevo_tipo) { updated.tipo = args.nuevo_tipo; changes.push(`tipo: ${args.nuevo_tipo}`); }
        if (args.nueva_categoria) { updated.categoria = args.nueva_categoria as CategoriaGasto; changes.push(`categoría: ${args.nueva_categoria}`); }
        return updated;
      }));
      const changesStr = changes.length > 0 ? changes.join(', ') : 'sin cambios detectados';
      return JSON.stringify({ ok: true, message: `Transacción "${tx.descripcion}" modificada: ${changesStr}` });
    }

    if (name === 'crear_gasto_fijo') {
      const nuevo: GastoFijo = {
        id: Date.now(),
        nombre: args.nombre,
        monto: args.monto,
        categoria: (args.categoria || 'otros') as CategoriaGasto,
        diaCorte: args.diaCorte || 1,
        recordatorio: true,
        pagadoEsteMes: false,
        fechaCreacion: getColombiaISO(),
      };
      setGastosFijos(prev => [...prev, nuevo]);
      return JSON.stringify({ ok: true, message: `Gasto fijo creado: ${args.nombre} por $${args.monto.toLocaleString('es-CO')}/mes (día ${nuevo.diaCorte})` });
    }

    if (name === 'modificar_gasto_fijo') {
      const searchTerm = args.nombre.toLowerCase();
      const gasto = gastosFijos.find(g => g.nombre.toLowerCase().includes(searchTerm));
      if (!gasto) return JSON.stringify({ ok: false, message: `No se encontró gasto fijo "${args.nombre}"` });
      const changes: string[] = [];
      setGastosFijos(prev => prev.map(g => {
        if (g.id !== gasto.id) return g;
        const updated = { ...g };
        if (args.nuevo_nombre) { updated.nombre = args.nuevo_nombre; changes.push(`nombre: ${args.nuevo_nombre}`); }
        if (args.nuevo_monto != null) { updated.monto = args.nuevo_monto; changes.push(`monto: $${args.nuevo_monto.toLocaleString('es-CO')}`); }
        if (args.nueva_categoria) { updated.categoria = args.nueva_categoria as CategoriaGasto; changes.push(`categoría: ${args.nueva_categoria}`); }
        if (args.nuevo_diaCorte != null) { updated.diaCorte = args.nuevo_diaCorte; changes.push(`día de corte: ${args.nuevo_diaCorte}`); }
        return updated;
      }));
      const changesStr = changes.length > 0 ? changes.join(', ') : 'sin cambios detectados';
      return JSON.stringify({ ok: true, message: `Gasto fijo "${gasto.nombre}" modificado: ${changesStr}` });
    }

    if (name === 'eliminar_gasto_fijo') {
      const searchTerm = args.nombre.toLowerCase();
      const gasto = gastosFijos.find(g => g.nombre.toLowerCase().includes(searchTerm));
      if (!gasto) return JSON.stringify({ ok: false, message: `No se encontró gasto fijo "${args.nombre}"` });
      setGastosFijos(prev => prev.filter(g => g.id !== gasto.id));
      return JSON.stringify({ ok: true, message: `Gasto fijo eliminado: ${gasto.nombre} ($${gasto.monto.toLocaleString('es-CO')}/mes)` });
    }

    if (name === 'marcar_gasto_fijo_pagado') {
      const searchTerm = args.nombre.toLowerCase();
      const gasto = gastosFijos.find(g => g.nombre.toLowerCase().includes(searchTerm));
      if (!gasto) return JSON.stringify({ ok: false, message: `No se encontró gasto fijo "${args.nombre}"` });
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const montoPagado = args.montoPagado || gasto.monto;
      setGastosFijos(prev => prev.map(g => {
        if (g.id !== gasto.id) return g;
        return { ...g, pagadoEsteMes: true, mesPagado: currentMonth, fechaPago: getColombiaDateOnly(), montoPagadoEsteMes: montoPagado };
      }));
      return JSON.stringify({ ok: true, message: `Gasto fijo "${gasto.nombre}" marcado como pagado: $${montoPagado.toLocaleString('es-CO')}` });
    }

    return JSON.stringify({ ok: false, message: 'Acción no reconocida' });
  }, [facturas, facturasOcultas, setFacturas, transacciones, setTransacciones, gastosFijos, setGastosFijos]);

  // Describe a tool call in human-readable Spanish
  const describeToolCall = (toolCall: ToolCall): string => {
    const args = JSON.parse(toolCall.function.arguments);
    const name = toolCall.function.name;
    if (name === 'crear_factura') {
      const pct = args.porcentaje || 0;
      const cobro = pct > 0 ? Math.round(args.montoFactura * pct / 100) : (args.cobroCliente || args.montoFactura);
      return `Crear factura: ${args.cliente} - ${args.empresa} | Cobro: $${cobro.toLocaleString('es-CO')}${pct > 0 ? ` (${pct}%)` : ''}`;
    }
    if (name === 'modificar_factura') {
      const cambios: string[] = [];
      const pct = args.nuevo_porcentaje ?? args.porcentaje;
      const cobro = args.nuevo_cobroCliente ?? args.cobroCliente;
      const monto = args.nuevo_montoFactura ?? args.montoFactura;
      const empresa = args.nueva_empresa ?? args.empresa;
      if (pct != null) cambios.push(`porcentaje: ${pct}%`);
      if (cobro != null) cambios.push(`cobro: $${cobro.toLocaleString('es-CO')}`);
      if (monto != null) cambios.push(`monto: $${monto.toLocaleString('es-CO')}`);
      if (empresa) cambios.push(`servicio: ${empresa}`);
      if (args.nuevo_cliente) cambios.push(`cliente: ${args.nuevo_cliente}`);
      return `Modificar factura de ${args.cliente}${cambios.length > 0 ? ` → ${cambios.join(', ')}` : ''}`;
    }
    if (name === 'eliminar_factura') return `Eliminar factura de ${args.cliente}`;
    if (name === 'registrar_abono') return `Registrar ${args.tipo === 'parcial' ? 'abono parcial' : 'pago'} de ${args.cliente}${args.monto ? ` por $${args.monto.toLocaleString('es-CO')}` : ' (saldo completo)'}`;
    if (name === 'crear_transaccion') return `Registrar ${args.tipo}: ${args.descripcion} por $${args.monto.toLocaleString('es-CO')}`;
    if (name === 'marcar_pagado_proveedor') return `Marcar factura de ${args.cliente} como pagada al proveedor`;
    if (name === 'eliminar_transaccion') return `Eliminar transacción: "${args.descripcion}"`;
    if (name === 'modificar_transaccion') {
      const cambios: string[] = [];
      if (args.nueva_descripcion) cambios.push(`desc: ${args.nueva_descripcion}`);
      if (args.nuevo_monto != null) cambios.push(`monto: $${args.nuevo_monto.toLocaleString('es-CO')}`);
      if (args.nuevo_tipo) cambios.push(`tipo: ${args.nuevo_tipo}`);
      return `Modificar transacción "${args.descripcion}"${cambios.length > 0 ? ` → ${cambios.join(', ')}` : ''}`;
    }
    if (name === 'crear_gasto_fijo') return `Crear gasto fijo: ${args.nombre} ($${args.monto.toLocaleString('es-CO')}/mes)`;
    if (name === 'modificar_gasto_fijo') {
      const cambios: string[] = [];
      if (args.nuevo_nombre) cambios.push(`nombre: ${args.nuevo_nombre}`);
      if (args.nuevo_monto != null) cambios.push(`monto: $${args.nuevo_monto.toLocaleString('es-CO')}`);
      if (args.nuevo_diaCorte != null) cambios.push(`día: ${args.nuevo_diaCorte}`);
      return `Modificar gasto fijo "${args.nombre}"${cambios.length > 0 ? ` → ${cambios.join(', ')}` : ''}`;
    }
    if (name === 'eliminar_gasto_fijo') return `Eliminar gasto fijo: ${args.nombre}`;
    if (name === 'marcar_gasto_fijo_pagado') return `Marcar como pagado: ${args.nombre}${args.montoPagado ? ` ($${args.montoPagado.toLocaleString('es-CO')})` : ''}`;
    return 'Acción desconocida';
  };

  // Detect if a message is clearly a QUERY (asking for info) vs an ACTION (wants to do something)
  // This is CRITICAL - if it's a query, we don't even send tools to the API
  const isQueryNotAction = useCallback((text: string): boolean => {
    const lowerText = text.toLowerCase().trim();

    // Strong query indicators - these are DEFINITELY queries
    const strongQueryPatterns = [
      /^(cu[aá]nt[oa]?s?|qu[eé]|qui[eé]n(es)?|d[oó]nde|c[oó]mo|por\s*qu[eé]|cu[aá]l(es)?)\b/i, // Questions starting with interrogative
      /\?$/, // Ends with question mark
      /^(dame|dime|mu[eé]str(a|ame)|list(a|ame)|ver|revis(a|ar)|anali(za|zar)|resum(e|en|ir)|explic(a|ar))\b/i, // Info requests
      /^(hola|hey|buenos?\s+(d[ií]as?|tardes?|noches?)|gracias|ok|vale|ent(iendo|endido)|perfecto)\b/i, // Greetings/acknowledgments
      /(llevamos|tenemos|hay|tengo|tienes?|tiene|est[aá]n?|van|vamos)\s+(de\s+)?(gastos?|ingresos?|facturas?|deud|este\s+mes)/i, // Status queries
      /^(qui[eé]n|cu[aá]nto|cu[aá]les?)\s+(me\s+)?debe/i, // "who owes me"
      /(total|suma|resumen|balance|estado|situaci[oó]n)\s+(de|del|este|actual)/i, // Summary requests
      /\b(qu[eé]\s+(puedo|puedes|pod[eé]s)|ayud(a|ame)|funciona|sirve|hace)\b/i, // Help/capability questions
    ];

    // Strong action indicators - these are DEFINITELY actions
    const strongActionPatterns = [
      /^(registr[aá]|cre[aá]|agreg[aá]|a[ñn]ad[eéií]|elimin[aá]|borr[aá]|modific[aá]|cambi[aá]|marc[aá])\b/i, // Direct commands
      /^(pon|coloc[aá]|met[eéií]|ingres[aá])\s+(un\s+)?(gasto|ingreso|factura)/i, // Direct action on data
      /\b(gast[eéo]|compr[eéo]|pagu[eéo])\s+[\d$]/i, // "I spent X"
      /\b(me\s+pagaron|recib[ií])\s+[\d$]/i, // "I received X"
      /[\d.,]+\s*(mil|k)\s+(en|por|de|pesos)/i, // Money amounts with action context
      /\b(necesito|quiero|podr[ií]as?|hay\s+que|toca|deber[ií]as?|por\s*favor)\s+(que\s+)?(cre[ea]|agreg[au]|registr[ae]|elimin[ae]|borr[ae]|modific[au]|cambi[ae]|marc[au]|pon[eg]|met[ea])/i, // Indirect action requests: "necesito que crees", "quiero que agregues"
      /\bcre[ea](me|r)?\s+(una?\s+)?(factura|gasto|ingreso|transacci[oó]n)/i, // "crea una factura", "crear factura", "creame una factura"
    ];

    // Check for strong query patterns first
    if (strongQueryPatterns.some(p => p.test(lowerText))) {
      // Double-check it's not also an action (like "cuanto gaste? pon un gasto de 50k")
      if (!strongActionPatterns.some(p => p.test(lowerText))) {
        return true; // It's a query
      }
    }

    // Check for clear action patterns
    if (strongActionPatterns.some(p => p.test(lowerText))) {
      return false; // It's an action
    }

    // General knowledge questions (not about the app data)
    const generalKnowledgePatterns = [
      /\b(qu[eé]\s+(es|son|cuesta|vale|significa)|c[oó]mo\s+(se\s+)?(hace|cocina|prepara|funciona))\b/i,
      /\b(presidente|clima|tiempo|noticias|d[oó]lar|precio)\b/i,
      /\b(en\s+colombia|en\s+el\s+mundo|actualmente)\b/i,
    ];
    if (generalKnowledgePatterns.some(p => p.test(lowerText))) {
      return true; // General knowledge = no action needed
    }

    // Default: if there's no clear action pattern, treat as query (safer)
    return !strongActionPatterns.some(p => p.test(lowerText));
  }, []);

  // Process message history to prevent re-execution of previous actions
  // This is CRITICAL to make the AI intelligent - it should only act on the LAST user message
  const processMessagesForAPI = useCallback((messagesToSend: ChatMessage[]): ChatMessage[] => {
    if (messagesToSend.length === 0) return messagesToSend;

    // Find the last user message index
    let lastUserIndex = -1;
    for (let i = messagesToSend.length - 1; i >= 0; i--) {
      if (messagesToSend[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return messagesToSend;

    // Action-like patterns that indicate the user wanted to DO something (not just ask)
    const actionPatterns = [
      /\b(gast[eéo]|compr[eéo]|pagu[eéo]|regist(ra|ré)|cre[aé]|agreg[aé]|a[ñn]ad[eéií]|elimin[aé]|borr[aé]|modific[aé]|cambi[aé]|marc[aé])\b/i,
      /\b(ingres[aé]|met[ií]|pon|coloc[aé])\s+(un\s+)?(gasto|ingreso|factura)/i,
      /\$\s*[\d.,]+\s*(mil|k|en|por|de)/i,
      /[\d.,]+\s*(mil|k)\s+(en|por|de|pesos)/i,
      /\b(necesito|quiero|podr[ií]as?|hay\s+que|toca|por\s*favor)\s+(que\s+)?(cre[ea]|agreg[au]|registr[ae]|elimin[ae]|borr[ae]|modific[au]|cambi[ae]|marc[au])/i,
      /\bcre[ea](me|r)?\s+(una?\s+)?(factura|gasto|ingreso|transacci[oó]n)/i,
    ];

    // Query patterns that indicate the user is ASKING, not DOING
    const queryPatterns = [
      /^(cu[aá]nt|qu[eé]|qui[eé]n|d[oó]nde|c[oó]mo|por\s*qu[eé]|cu[aá]l|dame|dime|mu[eé]str|list|ver|revis|anali|resum|explic)/i,
      /\?$/,
      /(llevamos|tenemos|hay|tengo|tiene|est[aá]n?)\s+(de\s+)?(gastos?|ingresos?|facturas?|deud)/i,
    ];

    // Check if a message looks like an action request
    const looksLikeAction = (text: string): boolean => {
      const lowerText = text.toLowerCase();
      // If it matches query patterns, it's NOT an action
      if (queryPatterns.some(p => p.test(lowerText))) return false;
      // If it matches action patterns, it IS an action
      return actionPatterns.some(p => p.test(lowerText));
    };

    // Process messages: mark old action requests as completed
    return messagesToSend.map((msg, index) => {
      // Keep tool messages and assistant messages as-is
      if (msg.role !== 'user') return msg;

      // Keep the LAST user message exactly as-is (this is what we want to process)
      if (index === lastUserIndex) return msg;

      // For PREVIOUS user messages that look like actions, mark them as already executed
      if (looksLikeAction(msg.content)) {
        // Check if the NEXT assistant message indicates it was completed (has ✅)
        const nextMsg = messagesToSend[index + 1];
        const wasCompleted = nextMsg && nextMsg.role === 'assistant' && nextMsg.content.includes('✅');
        const wasCancelled = nextMsg && nextMsg.role === 'assistant' && nextMsg.content.toLowerCase().includes('cancelad');

        if (wasCompleted) {
          return { ...msg, content: `[ACCIÓN YA EJECUTADA - NO REPETIR] ${msg.content}` };
        } else if (wasCancelled) {
          return { ...msg, content: `[ACCIÓN CANCELADA - NO EJECUTAR] ${msg.content}` };
        }
      }

      return msg;
    });
  }, []);

  // Call AI API (non-streaming for tool calls, streaming for text)
  const callAI = useCallback(async (messagesToSend: ChatMessage[], forceNoTools = false): Promise<{ content: string; tool_calls?: ToolCall[] }> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // CRITICAL: Process messages to prevent re-execution of previous actions
    const processedMessages = processMessagesForAPI(messagesToSend);

    // For API, format messages correctly for Groq's OpenAI-compatible endpoint
    const apiMessages = processedMessages.map(m => {
      if (m.tool_call_id) {
        // Tool response: must include name of the function
        return { role: 'tool' as const, content: m.content, tool_call_id: m.tool_call_id, name: m.name || '' };
      }
      if (m.tool_calls) {
        // Assistant message with tool calls: content must be null, not empty string
        return { role: m.role, content: m.content || null, tool_calls: m.tool_calls };
      }
      return { role: m.role, content: m.content };
    });

    // CRITICAL: Determine if we should even send tools
    // If the last user message is clearly a query, DON'T send tools - this prevents the AI from making tool calls for queries
    const lastUserMsg = messagesToSend.filter(m => m.role === 'user').pop();
    const shouldIncludeTools = !forceNoTools && lastUserMsg && !isQueryNotAction(lastUserMsg.content);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...apiMessages,
        ],
        ...(shouldIncludeTools ? { tools: AI_TOOLS } : {}),
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let detail = response.statusText;
      try {
        const parsed = JSON.parse(errorBody);
        detail = parsed?.error?.message || parsed?.message || detail;
      } catch { /* use statusText */ }

      // If Groq failed to generate/validate a function call, retry without tools (text-only)
      if (response.status === 400 && (detail.includes('Failed to call a function') || detail.includes('tool call validation failed'))) {
        const retryResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: 'system', content: buildSystemPrompt() },
              ...apiMessages,
            ],
            temperature: 0.7,
            max_tokens: 4096,
          }),
          signal: controller.signal,
        });
        if (!retryResponse.ok) throw new Error(`Error ${response.status}: ${detail}`);
        const retryResult = await retryResponse.json();
        const retryChoice = retryResult.choices?.[0]?.message;
        return { content: retryChoice?.content || '' };
      }

      throw new Error(`Error ${response.status}: ${detail}`);
    }

    const result = await response.json();
    const choice = result.choices?.[0]?.message;
    return { content: choice?.content || '', tool_calls: choice?.tool_calls };
  }, [buildSystemPrompt, processMessagesForAPI, isQueryNotAction]);

  // Handle confirmed action execution - supports multiple tool calls
  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;
    const { tool_calls, messages: contextMessages } = pendingAction;
    setPendingAction(null);
    setIsLoading(true);

    try {
      // Execute all tool calls
      const results: { ok: boolean; message: string }[] = [];
      const toolResponses: ChatMessage[] = [];

      for (const tool_call of tool_calls) {
        const result = executeTool(tool_call);
        const parsed = JSON.parse(result);
        results.push(parsed);
        toolResponses.push({
          role: 'tool',
          content: result,
          tool_call_id: tool_call.id,
          name: tool_call.function.name,
        });
      }

      const successCount = results.filter(r => r.ok).length;
      const failCount = results.length - successCount;

      // Build summary message
      let summaryMessage = '';
      if (results.length === 1) {
        // Single action
        summaryMessage = results[0].ok ? `✅ ${results[0].message}` : `❌ ${results[0].message}`;
      } else {
        // Multiple actions
        const successMsgs = results.filter(r => r.ok).map(r => `• ${r.message}`);
        const failMsgs = results.filter(r => !r.ok).map(r => `• ${r.message}`);

        if (successCount > 0) {
          summaryMessage += `✅ **${successCount} accion${successCount > 1 ? 'es' : ''} ejecutada${successCount > 1 ? 's' : ''}:**\n${successMsgs.join('\n')}`;
        }
        if (failCount > 0) {
          if (summaryMessage) summaryMessage += '\n\n';
          summaryMessage += `❌ **${failCount} error${failCount > 1 ? 'es' : ''}:**\n${failMsgs.join('\n')}`;
        }
      }

      // Try to get AI's natural language response if all succeeded
      if (successCount > 0 && failCount === 0) {
        try {
          const assistantToolMsg: ChatMessage = { role: 'assistant', content: '', tool_calls };
          const fullConversation = [...contextMessages, assistantToolMsg, ...toolResponses];
          // Force no tools for the follow-up response - we just want a natural language summary
          const aiResponse = await callAI(fullConversation, true);

          if (aiResponse.content) {
            summaryMessage = `✅ ${aiResponse.content}`;
          }
        } catch {
          // AI follow-up failed, use our summary
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: summaryMessage };
        return updated;
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error ejecutando acciones';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `❌ Error: ${errorMsg}` };
        return updated;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [pendingAction, executeTool, callAI]);

  const cancelAction = useCallback(() => {
    if (!pendingAction) return;
    setPendingAction(null);
    setMessages(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { role: 'assistant', content: 'Acción cancelada.' };
      return updated;
    });
  }, [pendingAction]);

  // Send message
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setPendingAction(null);
    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMessage]);

    try {
      const aiResponse = await callAI(newMessages);

      if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
        // AI wants to perform actions - ask for confirmation
        const toolCalls = aiResponse.tool_calls;
        const descriptions = toolCalls.map(tc => describeToolCall(tc));
        setPendingAction({ tool_calls: toolCalls, descriptions, messages: newMessages });

        let confirmText: string;
        if (toolCalls.length === 1) {
          confirmText = aiResponse.content
            ? `${aiResponse.content}\n\n**¿Confirmar acción?**`
            : `Quiero ejecutar: **${descriptions[0]}**\n\n**¿Confirmar?**`;
        } else {
          const listDesc = descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');
          confirmText = aiResponse.content
            ? `${aiResponse.content}\n\n**${toolCalls.length} acciones a ejecutar:**\n${listDesc}\n\n**¿Confirmar todas?**`
            : `Voy a ejecutar **${toolCalls.length} acciones:**\n${listDesc}\n\n**¿Confirmar todas?**`;
        }

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: confirmText };
          return updated;
        });
      } else {
        // Regular text response
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: aiResponse.content || 'No se recibió respuesta. Intenta de nuevo.' };
          return updated;
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const clearChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setError(null);
    setIsLoading(false);
    setPendingAction(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickSuggestions = [
    { label: 'Deudores', prompt: '¿Quiénes son los clientes que me deben dinero? Dame un resumen con nombres y montos.' },
    { label: 'Ganancias', prompt: '¿Cuánto he ganado este mes? Analiza mis ingresos y gastos.' },
    { label: 'Análisis', prompt: 'Hazme un análisis completo de mi situación financiera actual.' },
    { label: 'Resumen', prompt: 'Dame un resumen general del estado de mi negocio.' },
  ];

  return (
    <>
      {/* Floating toggle button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={onToggle}
            className="fixed bottom-6 right-6 p-4 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-full shadow-lg shadow-cyan-500/30 text-white z-[90] hover:shadow-cyan-500/50 transition-shadow"
          >
            <Bot size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Backdrop - mobile only */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-[89] sm:bg-transparent"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-16 right-0 bottom-0 w-full sm:w-[420px] bg-[#0f111a] border-l border-gray-800/50 z-[90] flex flex-col shadow-2xl shadow-black/50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50 bg-[#161b2c]/80">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-cyan-600 to-blue-600 p-2 rounded-xl shadow-lg shadow-cyan-500/25">
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm">Seya AI</h2>
                  <p className="text-[10px] text-cyan-400/60">Tu agente de negocio</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Limpiar chat"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  onClick={onToggle}
                  className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/50 bg-gray-900/30">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
                <FileText size={12} className="text-amber-400" />
                <span className="text-[10px] text-amber-300">{facturasPendientes.length} pend.</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                <DollarSign size={12} className="text-emerald-400" />
                <span className="text-[10px] text-emerald-300">{formatearDineroCorto(montoPorCobrar)}</span>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="bg-gradient-to-tr from-cyan-600 to-blue-600 p-4 rounded-2xl shadow-lg shadow-cyan-500/25 mb-4">
                    <Bot size={28} className="text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-white mb-1">Seya AI</h2>
                  <p className="text-gray-400 text-xs mb-4 max-w-xs">
                    Soy tu agente inteligente. Analizo tus datos y te ayudo a tomar decisiones para tu negocio.
                  </p>
                  <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                    {quickSuggestions.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => setInput(s.prompt)}
                        className="px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 hover:border-cyan-500/30 rounded-xl text-xs text-gray-300 hover:text-cyan-300 transition-all text-left"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center mt-0.5">
                      <Bot size={14} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                      : 'bg-gray-800/80 border border-gray-700/50 text-gray-200'
                  }`}>
                    {msg.content ? (
                      msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content
                    ) : (
                      msg.role === 'assistant' && isLoading && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      )
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center mt-0.5">
                      <User size={14} className="text-white" />
                    </div>
                  )}
                </motion.div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* Scroll down */}
            {showScrollDown && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-24 right-6 p-2 bg-gray-800 border border-gray-700 rounded-full shadow-lg hover:bg-gray-700 transition-colors z-10"
              >
                <ArrowDown size={14} className="text-gray-300" />
              </button>
            )}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-3 mb-2 px-3 py-2 bg-red-900/30 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-xs overflow-hidden"
                >
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action confirmation buttons */}
            <AnimatePresence>
              {pendingAction && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-3 mb-2 p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-xl overflow-hidden"
                >
                  {pendingAction.descriptions.length === 1 ? (
                    <p className="text-xs text-cyan-300 mb-2 font-medium">{pendingAction.descriptions[0]}</p>
                  ) : (
                    <div className="mb-2">
                      <p className="text-xs text-cyan-300 font-medium mb-1">{pendingAction.descriptions.length} acciones:</p>
                      <ul className="text-xs text-cyan-200/80 space-y-0.5">
                        {pendingAction.descriptions.map((desc, i) => (
                          <li key={i} className="truncate">• {desc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={confirmAction}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <CheckCircle size={14} />
                      {pendingAction.descriptions.length > 1 ? `Confirmar (${pendingAction.descriptions.length})` : 'Confirmar'}
                    </button>
                    <button
                      onClick={cancelAction}
                      disabled={isLoading}
                      className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 text-xs font-medium rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div className="border-t border-gray-800/50 px-3 py-3 bg-[#161b2c]/50">
              {messages.length > 0 && (
                <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                  {quickSuggestions.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setInput(s.prompt)}
                      className="flex-shrink-0 px-2.5 py-1 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 rounded-lg text-[10px] text-gray-400 hover:text-cyan-300 transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pregunta sobre tu negocio..."
                    rows={1}
                    className="w-full px-3.5 py-2.5 bg-gray-800/50 border border-gray-700/50 focus:border-cyan-500/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/25"
                    style={{ maxHeight: '100px' }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white rounded-xl transition-all shadow-lg shadow-cyan-500/25 disabled:shadow-none"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatPanel;
