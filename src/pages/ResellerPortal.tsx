import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import { STORAGE_KEYS } from '../utils/constants';
import { Download, FileText, Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Phone, Building2, User, CalendarDays, Receipt, Shield } from 'lucide-react';
import type { Factura, PagoRevendedor } from '../utils/types';

// Admin user ID - all data is stored under this path
const ADMIN_USER_ID = 'T8lrzfd7vFfab9SXAgMjl1AIHv33';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
  } catch {
    return iso.slice(0, 10);
  }
};

// Helper to get the storage key with tenant prefix
const getTenantKey = (baseKey: string, tenantId: string) => {
  if (tenantId === ADMIN_USER_ID) {
    return baseKey;
  }
  return `${tenantId}_${baseKey}`;
};

interface ShortLinkData {
  [code: string]: { userId: string; revendedor: string };
}

const ResellerPortal = () => {
  const { userId, revendedor, code } = useParams<{ userId?: string; revendedor?: string; code?: string }>();

  // Resolved values (either from direct params or short link)
  const [resolvedName, setResolvedName] = useState<string>(revendedor ? decodeURIComponent(revendedor) : '');
  const [resolvedTenantId, setResolvedTenantId] = useState<string>(userId ? decodeURIComponent(userId) : '');
  const [resolving, setResolving] = useState(!!code);

  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [facturasOcultas, setFacturasOcultas] = useState<number[]>([]);
  const [pagos, setPagos] = useState<PagoRevendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showPagadas, setShowPagadas] = useState(false);

  // Resolve short link code
  useEffect(() => {
    if (!code) return;

    const resolveShortLink = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        const shortLinksRef = doc(db, 'users', ADMIN_USER_ID, 'data', 'seyaShop_shortLinks');
        const unsub = onSnapshot(shortLinksRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data().value as ShortLinkData;
            const entry = data[code];
            if (entry) {
              setResolvedName(entry.revendedor);
              setResolvedTenantId(entry.userId);
              setResolving(false);
              return;
            }
          }
          setError('Enlace no válido o expirado');
          setResolving(false);
          setLoading(false);
        });

        return unsub;
      } catch {
        setError('Error de conexión');
        setResolving(false);
        setLoading(false);
      }
    };

    resolveShortLink();
  }, [code]);

  // Fetch data once we have resolved name and tenantId
  useEffect(() => {
    if (!resolvedName || !resolvedTenantId || resolving) return;

    let unsubFacturas: (() => void) | null = null;
    let unsubOcultas: (() => void) | null = null;
    let unsubPagos: (() => void) | null = null;

    const init = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        const nameLower = resolvedName.toLowerCase();

        // Listen for facturas
        const facturasKey = getTenantKey(STORAGE_KEYS.FACTURAS, resolvedTenantId);
        const facturasRef = doc(db, 'users', ADMIN_USER_ID, 'data', facturasKey);
        unsubFacturas = onSnapshot(facturasRef, (snap) => {
          if (snap.exists()) {
            const all: Factura[] = snap.data().value || [];
            setFacturas(all.filter(f => f.revendedor?.toLowerCase() === nameLower));
            setLastUpdate(new Date());
          }
          setLoading(false);
        }, (err) => {
          console.error('Error reading facturas:', err);
          setError('No se pudieron cargar los datos');
          setLoading(false);
        });

        // Listen for hidden invoices
        const ocultasKey = getTenantKey(STORAGE_KEYS.FACTURAS_OCULTAS, resolvedTenantId);
        const ocultasRef = doc(db, 'users', ADMIN_USER_ID, 'data', ocultasKey);
        unsubOcultas = onSnapshot(ocultasRef, (snap) => {
          if (snap.exists()) {
            setFacturasOcultas(snap.data().value || []);
          }
        });

        // Listen for pagos
        const pagosKey = getTenantKey(STORAGE_KEYS.PAGOS_REVENDEDORES, resolvedTenantId);
        const pagosRef = doc(db, 'users', ADMIN_USER_ID, 'data', pagosKey);
        unsubPagos = onSnapshot(pagosRef, (snap) => {
          if (snap.exists()) {
            const all: PagoRevendedor[] = snap.data().value || [];
            setPagos(all.filter(p => p.revendedor?.toLowerCase() === nameLower));
          }
        });
      } catch (err) {
        console.error('Init error:', err);
        setError('Error de conexión');
        setLoading(false);
      }
    };

    init();
    return () => {
      unsubFacturas?.();
      unsubOcultas?.();
      unsubPagos?.();
    };
  }, [resolvedName, resolvedTenantId, resolving]);

  // Filter out hidden invoices completely
  const facturasVisibles = facturas.filter(f => !facturasOcultas.includes(f.id));

  const pendientes = facturasVisibles
    .filter(f => f.pagadoAProveedor && !f.cobradoACliente)
    .map(f => ({ ...f, saldo: (f.cobroCliente || 0) - (f.abono || 0) }))
    .sort((a, b) => new Date(b.fechaISO || '').getTime() - new Date(a.fechaISO || '').getTime());

  const cobradas = facturasVisibles
    .filter(f => f.cobradoACliente)
    .sort((a, b) => new Date(b.fechaISO || '').getTime() - new Date(a.fechaISO || '').getTime());

  const totalPendiente = pendientes.reduce((s, f) => s + f.saldo, 0);
  const totalCobro = pendientes.reduce((s, f) => s + (f.cobroCliente || 0), 0);
  const totalAbonado = pendientes.reduce((s, f) => s + (f.abono || 0), 0);

  const pagosOrdenados = [...pagos].sort((a, b) =>
    new Date(b.fecha || b.fechaRegistro).getTime() - new Date(a.fecha || a.fechaRegistro).getTime()
  );

  const downloadHTML = () => {
    const html = generateHTML(resolvedName, pendientes, cobradas, pagosOrdenados, totalPendiente, totalCobro, totalAbonado);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Estado_${resolvedName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!resolvedName && !resolving) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center text-gray-400 p-4">
        <div className="text-center">
          <AlertCircle size={40} className="mx-auto mb-3 text-gray-600" />
          <p>Revendedor no especificado</p>
        </div>
      </div>
    );
  }

  if (loading || resolving) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Cargando tu estado de cuenta...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-medium mb-2">{error}</p>
          <p className="text-gray-500 text-sm">Verifica que el enlace sea correcto o contacta al administrador.</p>
        </div>
      </div>
    );
  }

  if (facturasVisibles.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/20 to-indigo-700/20 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-purple-400" />
          </div>
          <p className="text-white font-medium mb-1">Sin facturas</p>
          <p className="text-gray-500 text-sm">No hay facturas registradas para <strong className="text-gray-300">{resolvedName}</strong></p>
        </div>
      </div>
    );
  }

  const pctPago = totalCobro > 0 ? Math.round((totalAbonado / totalCobro) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0f111a] text-gray-100">
      {/* Animations CSS */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes growWidth {
          from { width: 0%; }
        }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out both; }
        .animate-fade-in-scale { animation: fadeInScale 0.5s ease-out both; }
        .animate-slide-in-right { animation: slideInRight 0.4s ease-out both; }
        .animate-grow-width { animation: growWidth 1s ease-out 0.5s both; }
        .stagger-1 { animation-delay: 0.1s; }
        .stagger-2 { animation-delay: 0.2s; }
        .stagger-3 { animation-delay: 0.3s; }
        .stagger-4 { animation-delay: 0.4s; }
        .stagger-5 { animation-delay: 0.5s; }
        .stagger-6 { animation-delay: 0.6s; }
        .stagger-7 { animation-delay: 0.7s; }
        .stagger-8 { animation-delay: 0.8s; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0f111a]/95 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20">S</div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">Seya</h1>
                <p className="text-[11px] text-gray-500">Estado de cuenta</p>
              </div>
            </div>
            <button
              onClick={downloadHTML}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-400 transition-colors border border-white/5"
            >
              <Download size={13} />
              Descargar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Welcome card */}
        <div className="bg-gradient-to-br from-purple-600/10 to-indigo-700/10 border border-purple-500/10 rounded-2xl p-5 sm:p-6 animate-fade-in-scale">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/30">
              {resolvedName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold text-xl capitalize">{resolvedName}</p>
              <p className="text-gray-500 text-xs">
                Actualizado {lastUpdate?.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' }) || '—'}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-black/20 rounded-xl p-4 text-center animate-fade-in-up stagger-1">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Deuda</p>
              <p className="text-lg font-bold text-red-400">{fmt(totalPendiente)}</p>
            </div>
            <div className="bg-black/20 rounded-xl p-4 text-center animate-fade-in-up stagger-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Abonado</p>
              <p className="text-lg font-bold text-emerald-400">{fmt(totalAbonado)}</p>
            </div>
            <div className="bg-black/20 rounded-xl p-4 text-center animate-fade-in-up stagger-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Facturas</p>
              <p className="text-lg font-bold text-white">{pendientes.length}</p>
            </div>
          </div>

          {/* Progress bar */}
          {totalCobro > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
                <span>Progreso de pago</span>
                <span className="font-medium text-gray-400">{pctPago}%</span>
              </div>
              <div className="w-full h-2.5 bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full animate-grow-width"
                  style={{ width: `${Math.min(100, pctPago)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Pending invoices */}
        {pendientes.length > 0 && (
          <section className="animate-fade-in-up stagger-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Receipt size={15} className="text-red-400" />
                Facturas pendientes
              </h2>
              <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium">
                {pendientes.length} {pendientes.length === 1 ? 'factura' : 'facturas'}
              </span>
            </div>
            <div className="space-y-3">
              {pendientes.map((f, idx) => (
                <div key={f.id} className="bg-[#151825] border border-white/[0.06] rounded-2xl p-4 sm:p-5 hover:border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 animate-slide-in-right" style={{ animationDelay: `${0.4 + idx * 0.1}s` }}>
                  {/* Client & date header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-purple-400 flex-shrink-0" />
                        <span className="text-sm font-semibold text-white truncate">{f.cliente}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 ml-[22px]">
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Building2 size={10} />
                          {f.empresa}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <CalendarDays size={10} />
                          {f.fechaDisplay || fmtDate(f.fechaISO)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="bg-black/20 rounded-xl p-3 sm:p-4 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Valor factura</span>
                      <span className="text-sm font-medium text-gray-300">{fmt(f.montoFactura || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Valor a cobrar</span>
                      <span className="text-sm font-medium text-white">{fmt(f.cobroCliente || 0)}</span>
                    </div>
                    {f.abono > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Abonado</span>
                        <span className="text-sm font-medium text-emerald-400">-{fmt(f.abono)}</span>
                      </div>
                    )}
                    <div className="border-t border-white/5 pt-2.5 flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-400">Saldo pendiente</span>
                      <span className="text-base font-bold text-red-400">{fmt(f.saldo)}</span>
                    </div>
                  </div>

                  {/* Garantia badge */}
                  {f.usoGarantia && (
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <Shield size={12} className={f.garantiaResuelta ? 'text-emerald-400' : 'text-amber-400'} />
                      <span className={`text-[11px] font-medium ${f.garantiaResuelta ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {f.garantiaResuelta ? 'Garantía resuelta' : 'En garantía'}
                      </span>
                    </div>
                  )}

                  {/* Abono progress for partial payments */}
                  {f.abono > 0 && f.cobroCliente > 0 && (
                    <div className="mt-2.5">
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/60 rounded-full"
                          style={{ width: `${Math.min(100, (f.abono / f.cobroCliente) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Payment history */}
        {pagosOrdenados.length > 0 && (
          <section className="animate-fade-in-up stagger-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Clock size={15} className="text-emerald-400" />
              Historial de pagos
            </h2>
            <div className="space-y-3">
              {pagosOrdenados.map(p => (
                <div key={p.id} className="bg-[#151825] border border-white/[0.06] rounded-2xl p-4 sm:p-5 hover:border-emerald-500/20 transition-all duration-300">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                      <CalendarDays size={11} />
                      {fmtDate(p.fecha)}
                    </span>
                    <span className="text-sm font-bold text-emerald-400">{fmt(p.montoTotal)}</span>
                  </div>
                  {p.distribucion && p.distribucion.length > 0 && (
                    <div className="space-y-1.5 mt-2 pt-2 border-t border-white/5">
                      {p.distribucion.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-500">
                            {d.cliente} <span className="text-gray-600">({d.empresa})</span>
                          </span>
                          <span className={d.completada ? 'text-emerald-500 font-medium' : 'text-gray-400'}>
                            {fmt(d.montoAplicado)}
                            {d.completada && <CheckCircle2 size={10} className="inline ml-1 -mt-0.5" />}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Paid invoices */}
        {cobradas.length > 0 && (
          <section className="animate-fade-in-up stagger-7">
            <button
              onClick={() => setShowPagadas(!showPagadas)}
              className="w-full flex items-center justify-between py-3 px-4 rounded-2xl bg-[#151825] border border-white/[0.06] text-sm text-gray-400 hover:bg-[#1a1e30] transition-colors"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500/50" />
                <span>Facturas pagadas</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400/70 px-1.5 py-0.5 rounded-full">{cobradas.length}</span>
              </span>
              {showPagadas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showPagadas && (
              <div className="mt-2 space-y-1.5">
                {cobradas.slice(0, 20).map(f => (
                  <div key={f.id} className="flex justify-between items-center py-2.5 px-4 rounded-xl bg-[#151825]/60 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="text-gray-400">{f.cliente}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-gray-600 text-[11px]">{f.empresa}</span>
                        <span className="text-gray-700 text-[11px]">&middot;</span>
                        <span className="text-gray-600 text-[11px]">{f.fechaDisplay || fmtDate(f.fechaISO)}</span>
                      </div>
                    </div>
                    <span className="text-emerald-500/50 font-medium text-xs">{fmt(f.cobroCliente || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Contact prompt */}
        {totalPendiente > 0 && (
          <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/10 rounded-2xl p-4 text-center animate-fade-in-up stagger-8">
            <Phone size={18} className="text-amber-400/60 mx-auto mb-2" />
            <p className="text-xs text-gray-400">
              Si tienes dudas sobre alguna factura, contacta al administrador.
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center pt-2 pb-8">
          <p className="text-[10px] text-gray-700">Seya Shop &middot; Datos en tiempo real</p>
        </footer>
      </main>
    </div>
  );
};

// ─── HTML Report Generator ────────────────────────────────────────────────

function generateHTML(
  name: string,
  pendientes: (Factura & { saldo: number })[],
  cobradas: Factura[],
  pagos: PagoRevendedor[],
  totalPendiente: number,
  totalCobro: number,
  totalAbonado: number,
): string {
  const hoy = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Bogota',
  });

  const f = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  const rowsPendientes = pendientes.map(inv => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#a0a0b0;font-size:13px">${inv.fechaDisplay || inv.fechaISO?.slice(0, 10) || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#e0e0e0;font-size:13px">${inv.cliente}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#a0a0b0;font-size:13px">${inv.empresa}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#a0a0b0;font-size:13px;text-align:right">${f(inv.montoFactura || 0)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#e0e0e0;font-size:13px;text-align:right">${f(inv.cobroCliente || 0)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#4ade80;font-size:13px;text-align:right">${inv.abono > 0 ? f(inv.abono) : '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#f87171;font-size:13px;font-weight:600;text-align:right">${f(inv.saldo)}</td>
    </tr>`).join('');

  const rowsPagos = pagos.map(p => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#a0a0b0;font-size:13px">${p.fecha || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#4ade80;font-size:13px;font-weight:600">${f(p.montoTotal)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#a0a0b0;font-size:13px">${(p.distribucion || []).map(d => `${d.cliente} (${d.empresa}): ${f(d.montoAplicado)}`).join('<br>')}</td>
    </tr>`).join('');

  const pct = totalCobro > 0 ? Math.round((totalAbonado / totalCobro) * 100) : 0;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Estado de cuenta - ${name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f111a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px}
.container{max-width:700px;margin:0 auto}
.header{text-align:center;margin-bottom:30px;padding:24px;background:linear-gradient(135deg,rgba(124,58,237,0.12),rgba(79,70,229,0.08));border:1px solid rgba(255,255,255,0.06);border-radius:16px}
.logo{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:12px;color:#fff;font-weight:700;font-size:20px;margin-bottom:12px}
h1{font-size:22px;color:#fff;margin-bottom:4px}
.subtitle{color:#8b8ba0;font-size:14px}
.cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px}
.card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px}
.card-label{font-size:11px;color:#6b6b80;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
.card-value{font-size:20px;font-weight:600}
.card-value.red{color:#f87171}
.card-value.green{color:#4ade80}
.card-value.white{color:#fff}
.progress{background:rgba(255,255,255,0.05);border-radius:8px;height:8px;overflow:hidden;margin-bottom:24px}
.progress-bar{height:100%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:8px;transition:width 0.5s}
section{margin-bottom:28px}
h2{font-size:14px;color:#8b8ba0;margin-bottom:12px;display:flex;align-items:center;gap:6px}
table{width:100%;border-collapse:collapse;background:rgba(255,255,255,0.02);border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.05)}
th{padding:10px 12px;text-align:left;font-size:11px;color:#6b6b80;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #1e1e2e;background:rgba(255,255,255,0.02)}
th:nth-child(n+4){text-align:right}
.footer{text-align:center;padding:20px 0;color:#4a4a5c;font-size:11px}
@media(max-width:600px){.cards{grid-template-columns:1fr}.card-value{font-size:16px}table{font-size:12px}}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">S</div>
    <h1>Estado de cuenta</h1>
    <p class="subtitle">${name} &middot; ${hoy}</p>
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-label">Por cobrar</div>
      <div class="card-value red">${f(totalPendiente)}</div>
    </div>
    <div class="card">
      <div class="card-label">Abonado</div>
      <div class="card-value green">${f(totalAbonado)}</div>
    </div>
    <div class="card">
      <div class="card-label">Facturas</div>
      <div class="card-value white">${pendientes.length}</div>
    </div>
  </div>

  <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>

  <section>
    <h2>&#128196; Facturas pendientes</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Servicio</th><th style="text-align:right">Valor</th><th style="text-align:right">Cobro</th><th style="text-align:right">Abonado</th><th style="text-align:right">Saldo</th></tr></thead>
      <tbody>${rowsPendientes}</tbody>
      <tfoot><tr>
        <td colspan="4" style="padding:10px 12px;font-weight:600;color:#fff;font-size:13px;border-top:2px solid #2a2a3e">TOTAL</td>
        <td style="padding:10px 12px;text-align:right;color:#fff;font-size:13px;font-weight:600;border-top:2px solid #2a2a3e">${f(totalCobro)}</td>
        <td style="padding:10px 12px;text-align:right;color:#4ade80;font-size:13px;font-weight:600;border-top:2px solid #2a2a3e">${f(totalAbonado)}</td>
        <td style="padding:10px 12px;text-align:right;color:#f87171;font-size:13px;font-weight:600;border-top:2px solid #2a2a3e">${f(totalPendiente)}</td>
      </tr></tfoot>
    </table>
  </section>

  ${pagos.length > 0 ? `
  <section>
    <h2>&#128176; Historial de pagos</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Monto</th><th>Distribución</th></tr></thead>
      <tbody>${rowsPagos}</tbody>
    </table>
  </section>` : ''}

  ${cobradas.length > 0 ? `
  <section>
    <h2>&#9989; Facturas pagadas (${cobradas.length})</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Servicio</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>${cobradas.slice(0, 20).map(inv => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #1e1e2e;color:#6b6b80;font-size:12px">${inv.fechaDisplay || inv.fechaISO?.slice(0, 10) || '—'}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #1e1e2e;color:#8b8ba0;font-size:12px">${inv.cliente}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #1e1e2e;color:#6b6b80;font-size:12px">${inv.empresa}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #1e1e2e;color:#4ade8060;font-size:12px;text-align:right">${f(inv.cobroCliente || 0)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>` : ''}

  <div class="footer">
    Seya Shop &middot; Generado el ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
  </div>
</div>
</body>
</html>`;
}

export default ResellerPortal;
