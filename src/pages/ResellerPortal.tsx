import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import { STORAGE_KEYS } from '../utils/constants';
import { Download, RefreshCw, FileText, Clock, AlertCircle } from 'lucide-react';
import type { Factura, PagoRevendedor } from '../utils/types';

const USER_ID = 'T8lrzfd7vFfab9SXAgMjl1AIHv33';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
  } catch {
    return iso.slice(0, 10);
  }
};

const ResellerPortal = () => {
  const { revendedor } = useParams<{ revendedor: string }>();
  const name = decodeURIComponent(revendedor || '');

  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [pagos, setPagos] = useState<PagoRevendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!name) return;

    let unsubFacturas: (() => void) | null = null;
    let unsubPagos: (() => void) | null = null;

    const init = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        // Real-time listener for facturas
        const facturasRef = doc(db, 'users', USER_ID, 'data', STORAGE_KEYS.FACTURAS);
        unsubFacturas = onSnapshot(facturasRef, (snap) => {
          if (snap.exists()) {
            const all: Factura[] = snap.data().value || [];
            setFacturas(all.filter(f => f.revendedor === name));
            setLastUpdate(new Date());
          }
          setLoading(false);
        }, (err) => {
          console.error('Error reading facturas:', err);
          setError('No se pudieron cargar los datos');
          setLoading(false);
        });

        // Real-time listener for pagos
        const pagosRef = doc(db, 'users', USER_ID, 'data', STORAGE_KEYS.PAGOS_REVENDEDORES);
        unsubPagos = onSnapshot(pagosRef, (snap) => {
          if (snap.exists()) {
            const all: PagoRevendedor[] = snap.data().value || [];
            setPagos(all.filter(p => p.revendedor === name));
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
      unsubPagos?.();
    };
  }, [name]);

  const pendientes = facturas
    .filter(f => !f.cobradoACliente)
    .map(f => ({ ...f, saldo: (f.cobroCliente || 0) - (f.abono || 0) }))
    .sort((a, b) => new Date(b.fechaISO || '').getTime() - new Date(a.fechaISO || '').getTime());

  const cobradas = facturas
    .filter(f => f.cobradoACliente)
    .sort((a, b) => new Date(b.fechaISO || '').getTime() - new Date(a.fechaISO || '').getTime());

  const totalPendiente = pendientes.reduce((s, f) => s + f.saldo, 0);
  const totalCobro = pendientes.reduce((s, f) => s + (f.cobroCliente || 0), 0);
  const totalAbonado = pendientes.reduce((s, f) => s + (f.abono || 0), 0);

  const pagosOrdenados = [...pagos].sort((a, b) =>
    new Date(b.fecha || b.fechaRegistro).getTime() - new Date(a.fecha || a.fechaRegistro).getTime()
  );

  const downloadHTML = () => {
    const html = generateHTML(name, pendientes, cobradas, pagosOrdenados, totalPendiente, totalCobro, totalAbonado);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Estado_${name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!name) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center text-gray-400">
        <p>Revendedor no especificado</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (facturas.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-4">
        <div className="text-center">
          <FileText size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No se encontraron facturas para <strong className="text-white">{name}</strong></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f111a] text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0f111a]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm">S</div>
                <span className="text-lg font-semibold text-white">Seya</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Estado de cuenta &middot; {name}</p>
            </div>
            <button
              onClick={downloadHTML}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition-colors"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Descargar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Por cobrar</p>
            <p className="text-lg font-semibold text-red-400">{fmt(totalPendiente)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Abonado</p>
            <p className="text-lg font-semibold text-emerald-400">{fmt(totalAbonado)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Facturas</p>
            <p className="text-lg font-semibold text-white">{pendientes.length}</p>
            <p className="text-[10px] text-gray-600">pendientes</p>
          </div>
        </div>

        {/* Total bar */}
        {totalCobro > 0 && (
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Progreso de pago</span>
              <span>{Math.round((totalAbonado / totalCobro) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (totalAbonado / totalCobro) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Pending invoices */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <FileText size={14} />
            Facturas pendientes
          </h2>
          <div className="space-y-2">
            {pendientes.map(f => (
              <div key={f.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-sm font-medium text-white">{f.cliente}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{f.empresa}</span>
                      <span className="text-xs text-gray-600">&middot;</span>
                      <span className="text-xs text-gray-500">{f.fechaDisplay || fmtDate(f.fechaISO)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-400">{fmt(f.saldo)}</span>
                </div>
                {f.abono > 0 && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">Cobro: {fmt(f.cobroCliente)}</span>
                    <span className="text-emerald-500">Abonado: {fmt(f.abono)}</span>
                  </div>
                )}
                {f.usoGarantia && (
                  <div className="mt-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${f.garantiaResuelta ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {f.garantiaResuelta ? 'Garantia resuelta' : 'En garantia'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Payment history */}
        {pagosOrdenados.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Clock size={14} />
              Historial de pagos
            </h2>
            <div className="space-y-2">
              {pagosOrdenados.map(p => (
                <div key={p.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">{fmtDate(p.fecha)}</span>
                    <span className="text-sm font-semibold text-emerald-400">{fmt(p.montoTotal)}</span>
                  </div>
                  {p.distribucion && p.distribucion.length > 0 && (
                    <div className="space-y-1 mt-2 pt-2 border-t border-white/5">
                      {p.distribucion.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-500">{d.cliente} ({d.empresa})</span>
                          <span className={d.completada ? 'text-emerald-500' : 'text-gray-400'}>
                            {fmt(d.montoAplicado)}
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

        {/* Recently paid */}
        {cobradas.length > 0 && (
          <section>
            <details className="group">
              <summary className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2 cursor-pointer list-none">
                <span className="group-open:rotate-90 transition-transform">&#9654;</span>
                Facturas pagadas ({cobradas.length})
              </summary>
              <div className="space-y-1 mt-2">
                {cobradas.slice(0, 20).map(f => (
                  <div key={f.id} className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/[0.02] text-sm">
                    <div>
                      <span className="text-gray-400">{f.cliente}</span>
                      <span className="text-gray-600 text-xs ml-2">{f.empresa} &middot; {f.fechaDisplay || fmtDate(f.fechaISO)}</span>
                    </div>
                    <span className="text-emerald-500/60">{fmt(f.cobroCliente || 0)}</span>
                  </div>
                ))}
              </div>
            </details>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center pt-4 pb-8">
          {lastUpdate && (
            <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
              <RefreshCw size={10} />
              Actualizado {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' })}
            </p>
          )}
          <p className="text-[10px] text-gray-700 mt-1">Seya Shop &middot; Datos en tiempo real</p>
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
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Servicio</th><th style="text-align:right">Cobro</th><th style="text-align:right">Abonado</th><th style="text-align:right">Saldo</th></tr></thead>
      <tbody>${rowsPendientes}</tbody>
      <tfoot><tr>
        <td colspan="3" style="padding:10px 12px;font-weight:600;color:#fff;font-size:13px;border-top:2px solid #2a2a3e">TOTAL</td>
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
