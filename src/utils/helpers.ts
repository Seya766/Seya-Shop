// =============================================
// HELPERS DE FECHA - TIMEZONE COLOMBIA
// =============================================

export const getColombiaISO = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
};

export const getColombiaDateOnly = (): string => {
  return getColombiaISO().slice(0, 10);
};

export const getColombiaDateDisplay = (): string => {
  return new Date().toLocaleDateString('es-CO', { 
    timeZone: 'America/Bogota',
    day: '2-digit', 
    month: 'short',
    year: 'numeric'
  });
};

export const obtenerHoraColombiana = (): string => {
  return new Date().toLocaleString('es-CO', { 
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'short',
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
};

// =============================================
// HELPERS DE FORMATO
// =============================================

export const formatearDinero = (valor: number): string => {
  return new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    maximumFractionDigits: 0 
  }).format(valor);
};

export const formatearDineroCorto = (valor: number): string => {
  if (valor >= 1000000) {
    return `$${(valor / 1000000).toFixed(1)}M`;
  } else if (valor >= 1000) {
    return `$${(valor / 1000).toFixed(0)}K`;
  }
  return formatearDinero(valor);
};

export const parsearDinero = (valor: string): number => {
  return parseFloat(String(valor).replace(/[^0-9]/g, '')) || 0;
};

// =============================================
// HELPERS DE CÁLCULO
// =============================================

export const calcularDiasRestantesGarantia = (fechaCreacion: string): number => {
  const fechaInicio = new Date(fechaCreacion);
  const fechaVencimiento = new Date(fechaInicio);
  fechaVencimiento.setDate(fechaInicio.getDate() + 30); 
  const hoy = new Date();
  const diferenciaTiempo = fechaVencimiento.getTime() - hoy.getTime();
  return Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));
};

export const calcularDiasParaCorte = (diaCorte: number): number => {
  const hoy = new Date();
  const diaActual = hoy.getDate();
  
  let diasParaCorte = diaCorte - diaActual;
  if (diasParaCorte < 0) {
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    diasParaCorte = (ultimoDiaMes - diaActual) + diaCorte;
  }
  return diasParaCorte;
};