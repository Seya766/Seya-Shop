import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Sparkles, Trash2, AlertCircle, ChevronDown, FileText, TrendingUp, Users, HelpCircle } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Factura, GastoFijo, Transaccion } from '../utils/types';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

// Generar contexto de facturas para el prompt del sistema
const generateSystemPrompt = (facturas: Factura[], gastosFijos: GastoFijo[], transacciones: Transaccion[]) => {
  const pendientes = facturas.filter(f => !f.cobradoACliente);
  const pagadas = facturas.filter(f => f.cobradoACliente);
  const sinPagarProveedor = facturas.filter(f => !f.pagadoAProveedor);

  const totalPendiente = pendientes.reduce((s, f) => s + (f.cobroCliente - f.abono), 0);
  const totalCobrado = pagadas.reduce((s, f) => s + f.cobroCliente, 0);
  const gananciaTotal = facturas.reduce((s, f) => s + (f.cobroCliente - f.montoFactura), 0);
  const totalDeudaProveedores = sinPagarProveedor.reduce((s, f) => s + (f.montoFactura - (f.abonoProveedor || 0)), 0);

  // Agrupar por revendedor
  const deudorMap = new Map<string, { deuda: number; count: number }>();
  pendientes.forEach(f => {
    const key = f.revendedor || f.cliente;
    const existing = deudorMap.get(key) || { deuda: 0, count: 0 };
    existing.deuda += (f.cobroCliente - f.abono);
    existing.count++;
    deudorMap.set(key, existing);
  });
  const topDeudores = [...deudorMap.entries()]
    .sort((a, b) => b[1].deuda - a[1].deuda)
    .slice(0, 10);

  // Agrupar por empresa
  const empresaMap = new Map<string, number>();
  facturas.forEach(f => {
    const key = f.empresa || 'Sin empresa';
    empresaMap.set(key, (empresaMap.get(key) || 0) + 1);
  });
  const topEmpresas = [...empresaMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Gastos fijos
  const totalGastosFijos = gastosFijos.reduce((s, g) => s + g.monto, 0);

  // Transacciones recientes
  const transRecientes = transacciones
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 10);

  return `Eres el asistente inteligente de Seya Shop, un negocio de reventa de servicios y productos en Colombia.
Tu rol es ayudar al dueño del negocio con sus facturas, analizar finanzas y dar consejos prácticos.

DATOS ACTUALES DEL NEGOCIO:
- Total facturas registradas: ${facturas.length}
- Facturas pendientes de cobro: ${pendientes.length}
- Facturas cobradas: ${pagadas.length}
- Monto total pendiente por cobrar: $${totalPendiente.toLocaleString()} COP
- Total cobrado: $${totalCobrado.toLocaleString()} COP
- Ganancia total estimada: $${gananciaTotal.toLocaleString()} COP
- Deuda total con proveedores: $${totalDeudaProveedores.toLocaleString()} COP
- Facturas sin pagar a proveedor: ${sinPagarProveedor.length}

TOP DEUDORES (clientes/revendedores con saldo pendiente):
${topDeudores.length > 0 ? topDeudores.map(([nombre, data], i) => `${i + 1}. ${nombre}: $${data.deuda.toLocaleString()} COP (${data.count} facturas)`).join('\n') : 'No hay deudores pendientes'}

EMPRESAS MÁS FRECUENTES:
${topEmpresas.map(([empresa, count]) => `- ${empresa}: ${count} facturas`).join('\n')}

FACTURAS PENDIENTES (últimas 25):
${pendientes.slice(0, 25).map(f => {
    const resta = f.cobroCliente - f.abono;
    return `- ${f.cliente} | Rev: ${f.revendedor} | Emp: ${f.empresa} | Cobro: $${f.cobroCliente.toLocaleString()} | Abonado: $${f.abono.toLocaleString()} | Resta: $${resta.toLocaleString()} | Fecha: ${f.fechaDisplay}`;
  }).join('\n')}

GASTOS FIJOS MENSUALES: ${gastosFijos.length} gastos, total estimado: $${totalGastosFijos.toLocaleString()} COP
${gastosFijos.map(g => `- ${g.nombre}: $${g.monto.toLocaleString()} (${g.categoria})`).join('\n')}

TRANSACCIONES RECIENTES:
${transRecientes.map(t => `- ${t.tipo === 'ingreso' ? '+' : '-'}$${t.monto.toLocaleString()} | ${t.descripcion} | ${t.fecha}`).join('\n')}

INSTRUCCIONES:
- Responde siempre en español colombiano, de forma directa y práctica.
- Usa formato de dinero colombiano ($xxx.xxx COP).
- Cuando analices datos, sé específico con nombres y cifras.
- Si no puedes responder algo con los datos disponibles, dilo honestamente.
- Puedes dar consejos de negocio, sugerir acciones de cobro, analizar tendencias.
- Sé conciso pero completo. Usa listas y formatos claros.`;
};

const SUGERENCIAS = [
  { icon: FileText, text: 'Resumen general del negocio', color: 'purple' },
  { icon: Users, text: 'Quiénes me deben más dinero?', color: 'amber' },
  { icon: TrendingUp, text: 'Análisis de ganancias', color: 'emerald' },
  { icon: HelpCircle, text: 'Qué facturas debería cobrar primero?', color: 'blue' },
];

const AsistentePage = () => {
  const { facturas, gastosFijos, transacciones } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const systemPrompt = useMemo(
    () => generateSystemPrompt(facturas, gastosFijos, transacciones),
    [facturas, gastosFijos, transacciones]
  );

  // Scroll al último mensaje
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Detectar si necesita botón de scroll
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!isNearBottom);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isLoading) return;

    setError(null);
    const userMessage: ChatMessage = { id: Date.now(), role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    if (!text) setInput('');
    setIsLoading(true);

    try {
      const apiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: messageText },
      ];

      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error?.message || `Error ${response.status}`);
      }

      const assistantMessage: ChatMessage = { id: Date.now() + 1, role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMessage]);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No se pudo leer la respuesta');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: last.content + content };
                return updated;
              });
            }
          } catch {
            // Chunk incompleto, ignorar
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 2, role: 'assistant', content: `No pude conectarme con la IA. ${errorMsg}` },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, systemPrompt]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // Stats rápidos para la UI
  const pendientes = facturas.filter(f => !f.cobradoACliente).length;
  const totalPendiente = facturas
    .filter(f => !f.cobradoACliente)
    .reduce((s, f) => s + (f.cobroCliente - f.abono), 0);

  return (
    <div className="max-w-4xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-cyan-600 to-blue-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/25">
              <Bot className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Asistente IA</h1>
              <span className="text-xs text-cyan-400/70">Powered by GPT OSS 120B</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Stats rápidos */}
            <div className="hidden sm:flex items-center gap-3 text-xs mr-2">
              <span className="text-gray-400">
                <span className="text-amber-400 font-semibold">{pendientes}</span> pendientes
              </span>
              <span className="text-gray-400">
                <span className="text-emerald-400 font-semibold">${(totalPendiente / 1000).toFixed(0)}K</span> por cobrar
              </span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-2 rounded-lg border border-gray-700/50 text-gray-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-900/20 transition-all"
                title="Limpiar chat"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 space-y-4 relative"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6"
            >
              <div className="bg-gradient-to-tr from-cyan-600/20 to-blue-600/20 p-6 rounded-2xl border border-cyan-500/20">
                <Sparkles className="w-10 h-10 text-cyan-400" />
              </div>
            </motion.div>
            <h2 className="text-xl font-bold text-white mb-2">Hola! Soy tu asistente</h2>
            <p className="text-gray-400 text-sm text-center max-w-md mb-6">
              Puedo ayudarte a analizar tus facturas, identificar deudores, calcular ganancias y darte consejos para tu negocio.
            </p>

            {/* Sugerencias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGERENCIAS.map((sug, i) => {
                const Icon = sug.icon;
                const colorClasses: Record<string, string> = {
                  purple: 'border-purple-500/30 hover:bg-purple-900/20 hover:border-purple-500/50 text-purple-300',
                  amber: 'border-amber-500/30 hover:bg-amber-900/20 hover:border-amber-500/50 text-amber-300',
                  emerald: 'border-emerald-500/30 hover:bg-emerald-900/20 hover:border-emerald-500/50 text-emerald-300',
                  blue: 'border-blue-500/30 hover:bg-blue-900/20 hover:border-blue-500/50 text-blue-300',
                };
                return (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => sendMessage(sug.text)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-gray-800/30 transition-all text-sm text-left ${colorClasses[sug.color]}`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span>{sug.text}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-md'
                        : 'bg-gray-800/80 border border-gray-700/50 text-gray-200 rounded-bl-md'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-xs text-cyan-400/60">
                        <Bot size={12} />
                        <span>Asistente</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content || (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Indicador de carga */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-gray-800/80 border border-gray-700/50 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs text-cyan-400/60 mb-1.5">
                    <Bot size={12} />
                    <span>Asistente</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-gray-400 text-sm">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    <span className="ml-1">Pensando...</span>
                  </span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Botón scroll down */}
        <AnimatePresence>
          {showScrollDown && messages.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToBottom}
              className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600/50 p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors z-10"
            >
              <ChevronDown size={16} className="text-gray-300" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4"
          >
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-red-300">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-white">x</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="p-4 border-t border-gray-800/50">
        <div className="flex items-end gap-2 bg-gray-800/50 border border-gray-700/50 rounded-xl p-2 focus-within:border-cyan-500/40 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregúntame sobre tus facturas..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none resize-none max-h-32 px-2 py-1.5"
            style={{ minHeight: '36px' }}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className={`p-2.5 rounded-lg transition-all shrink-0 ${
              input.trim() && !isLoading
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40'
                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-gray-600 text-center mt-2">
          La IA tiene acceso a tus datos de facturas para darte respuestas personalizadas
        </p>
      </div>
    </div>
  );
};

export default AsistentePage;
