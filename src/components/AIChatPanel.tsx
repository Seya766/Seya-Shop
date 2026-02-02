import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, ArrowDown, Bot, User, AlertCircle, FileText, DollarSign, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';
import { formatearDinero, formatearDineroCorto } from '../utils/helpers';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

const AIChatPanel = ({ isOpen, onToggle }: AIChatPanelProps) => {
  const { facturas, gastosFijos, transacciones, presupuestoMensual, facturasOcultas, metasFinancieras, metaAhorro, pagosRevendedores } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      fecha_hoy: hoy,
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
        ingresos_registrados: mesActual.ingresos,
        gastos_registrados: mesActual.gastos,
        balance: mesActual.ingresos - mesActual.gastos,
      },
      mes_anterior: {
        periodo: prevMonth,
        facturas: mesPasado.count,
        ventas: mesPasado.ventas,
        ganancia_bruta: mesPasado.ganancia,
        ingresos: mesPasado.ingresos,
        gastos: mesPasado.gastos,
        balance: mesPasado.ingresos - mesPasado.gastos,
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
      ).map(([nombre, facturas]) => ({
        revendedor: nombre,
        total: (facturas as Array<{saldo: number}>).reduce((s, f) => s + f.saldo, 0),
        facturas,
      })).sort((a, b) => b.total - a.total),
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

    return `Eres Seya AI. Hoy es ${hoy}.

QUIÉN ERES: Sos el asistente inteligente integrado en Seya Shop, la app de gestión de negocio del usuario. No sos un chatbot externo — sos parte de la app. Tenés acceso directo a todos los datos en tiempo real. Hablá como un socio de confianza que conoce el negocio por dentro.

EL NEGOCIO: El usuario vende servicios de telecomunicaciones en Colombia a través de revendedores. Usa esta app para:
- NEGOCIO: crear facturas, pagar proveedores, cobrar clientes, registrar abonos parciales, manejar garantías (30 días), gestionar revendedores, ver estadísticas y ranking de servicios
- FINANZAS: gastos fijos con día de corte, ingresos/gastos, metas de ahorro con bolsillos (Nu Bank 11.5% EA, efectivo, bancos), análisis de gastos, insights financieros, presupuesto mensual

DATOS EN TIEMPO REAL:
${JSON.stringify(data, null, 2)}

CÓMO RESPONDER:
- Español colombiano, natural y directo. Nada de frases genéricas ni "según los datos proporcionados"
- Respondé como si estuvieras viendo la app junto con el usuario — porque literalmente tenés los mismos datos
- Usá los números exactos del JSON. Nunca inventes cifras
- Cuando te pregunten por fechas, montos o detalles de facturas, buscá en el JSON y respondé con precisión
- Si te preguntan sobre la app, podés opinar, explicar funcionalidades y sugerir mejoras — la conocés toda
- Sé proactivo: si ves algo importante (deuda vieja, gasto alto, meta atrasada), mencionalo
- Formateá montos como pesos colombianos ($X.XXX.XXX)
- Usá markdown para formatear: **negrita**, listas con -, encabezados con ##
- Respuestas concisas pero completas. No repitas los datos en tablas enormes a menos que te lo pidan`;
  }, [facturasVisibles, gastosFijos, transacciones, presupuestoMensual, metasFinancieras, metaAhorro, pagosRevendedores, montoPorCobrar]);

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

  // Send message
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMessage]);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

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
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No se pudo leer la respuesta');

      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

          const data = trimmedLine.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              accumulated += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: accumulated };
                return updated;
              });
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      if (!accumulated) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: 'No se recibió respuesta. Intenta de nuevo.' };
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
    setError(null);
    setIsLoading(false);
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
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-[#0f111a] border-l border-gray-800/50 z-[90] flex flex-col shadow-2xl shadow-black/50"
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
