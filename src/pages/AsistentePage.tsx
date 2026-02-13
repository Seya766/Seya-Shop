import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, ArrowDown, Bot, User, AlertCircle, FileText, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';
import { formatearDinero } from '../utils/helpers';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AsistentePage = () => {
  const { facturas, gastosFijos, transacciones, presupuestoMensual } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Quick stats
  const facturasPendientes = facturas.filter(f => !f.cobradoACliente);
  const montoPorCobrar = facturasPendientes.reduce((sum, f) => sum + (f.cobroCliente - f.abono), 0);

  // Build system prompt with business context
  const buildSystemPrompt = useCallback((): string => {
    const totalFacturas = facturas.length;
    const pendientesCobro = facturas.filter(f => !f.cobradoACliente);
    const pendientesPago = facturas.filter(f => !f.pagadoAProveedor);
    const totalGastosFijos = gastosFijos.reduce((sum, g) => sum + g.monto, 0);

    const deudoresInfo = pendientesCobro.slice(0, 20).map(f =>
      `  - ${f.cliente} (${f.revendedor}): debe ${formatearDinero(f.cobroCliente - f.abono)} de ${formatearDinero(f.cobroCliente)}`
    ).join('\n');

    const gastosInfo = gastosFijos.map(g =>
      `  - ${g.nombre}: ${formatearDinero(g.monto)} (${g.pagadoEsteMes ? 'pagado' : 'pendiente'})`
    ).join('\n');

    const ultimasTransacciones = transacciones.slice(-10).map(t =>
      `  - ${t.fecha}: ${t.tipo === 'ingreso' ? '+' : '-'}${formatearDinero(t.monto)} - ${t.descripcion}`
    ).join('\n');

    return `Eres el asistente de IA de Seya Shop, un negocio de venta de servicios de telecomunicaciones en Colombia.

DATOS DEL NEGOCIO:
- Facturas totales: ${totalFacturas}
- Pendientes de cobro: ${pendientesCobro.length} (Total: ${formatearDinero(montoPorCobrar)})
- Pendientes de pago a proveedores: ${pendientesPago.length}
- Gastos fijos mensuales: ${formatearDinero(totalGastosFijos)}
- Presupuesto mensual: ${formatearDinero(presupuestoMensual)}

${pendientesCobro.length > 0 ? `DEUDORES:\n${deudoresInfo}` : 'No hay facturas pendientes de cobro.'}

${gastosFijos.length > 0 ? `GASTOS FIJOS:\n${gastosInfo}` : 'No hay gastos fijos registrados.'}

${transacciones.length > 0 ? `ÚLTIMAS TRANSACCIONES:\n${ultimasTransacciones}` : 'No hay transacciones registradas.'}

INSTRUCCIONES:
- Responde siempre en español colombiano
- Sé conciso, directo y útil
- Usa datos reales del negocio para responder
- Si necesitas más datos, dilo
- Formatea montos en pesos colombianos
- Puedes usar markdown para formatear respuestas`;
  }, [facturas, gastosFijos, transacciones, presupuestoMensual, montoPorCobrar]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!showScrollDown) {
      scrollToBottom();
    }
  }, [messages, showScrollDown, scrollToBottom]);

  // Detect scroll position
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
          max_tokens: 2048,
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
            // Skip malformed JSON chunks
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
    { label: 'Quiénes me deben?', prompt: '¿Quiénes son los clientes que me deben dinero? Dame un resumen con nombres y montos.' },
    { label: 'Ganancias del mes', prompt: '¿Cuánto he ganado este mes? Analiza mis ingresos y gastos.' },
    { label: 'Análisis financiero', prompt: 'Hazme un análisis completo de mi situación financiera actual.' },
    { label: 'Resumen del negocio', prompt: 'Dame un resumen general del estado de mi negocio.' },
  ];

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Quick Stats Bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <FileText size={14} className="text-amber-400" />
          <span className="text-xs text-amber-300">{facturasPendientes.length} pendientes</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <DollarSign size={14} className="text-emerald-400" />
          <span className="text-xs text-emerald-300">Por cobrar: {formatearDinero(montoPorCobrar)}</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-gradient-to-tr from-cyan-600 to-blue-600 p-4 rounded-2xl shadow-lg shadow-cyan-500/25 mb-4">
              <Bot size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Asistente IA</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-md">
              Pregúntame sobre tu negocio, analiza tus finanzas o pide recomendaciones basadas en tus datos.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {quickSuggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setInput(s.prompt)}
                  className="px-3 py-2.5 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 hover:border-cyan-500/30 rounded-xl text-sm text-gray-300 hover:text-cyan-300 transition-all text-left"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                  : 'bg-gray-800/80 border border-gray-700/50 text-gray-200'
              }`}>
                {msg.content || (msg.role === 'assistant' && isLoading ? (
                  <span className="flex items-center gap-2 text-gray-400">
                    <span className="flex gap-1">
                      <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </span>
                ) : msg.content)}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll down button */}
      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-28 right-6 p-2.5 bg-gray-800 border border-gray-700 rounded-full shadow-lg hover:bg-gray-700 transition-colors z-10"
        >
          <ArrowDown size={16} className="text-gray-300" />
        </button>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-2 px-4 py-2 bg-red-900/30 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-sm overflow-hidden"
          >
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="border-t border-gray-800/50 px-4 py-3">
        {messages.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
            {quickSuggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => setInput(s.prompt)}
                className="flex-shrink-0 px-3 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 rounded-lg text-xs text-gray-400 hover:text-cyan-300 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={clearChat}
            className="p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-colors"
            title="Limpiar chat"
          >
            <Trash2 size={18} />
          </button>
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre tu negocio..."
              rows={1}
              className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 focus:border-cyan-500/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/25"
              style={{ maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white rounded-xl transition-all shadow-lg shadow-cyan-500/25 disabled:shadow-none"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AsistentePage;
