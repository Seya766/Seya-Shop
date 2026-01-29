import type { ComponentType } from 'react';

// =============================================
// TIPOS DEL NEGOCIO
// =============================================

export interface HistorialAbono {
  monto: number;
  fecha: string;
  tipo: 'pago_completo' | 'abono_parcial';
  migrated?: boolean;
}

export interface HistorialAbonoProveedor {
  monto: number;
  fecha: string;
  nota?: string;
}

export interface HistorialGarantia {
  fecha: string;
  motivo: string;
  costo: number;
  resolucion?: string; // 'reposicion' | 'devolucion' | 'reparacion'
}

export interface Factura {
  id: number;
  cliente: string;
  telefono: string;
  revendedor: string;
  empresa: string;
  montoFactura: number;
  porcentajeAplicado: number;
  costoInicial: number;
  costoGarantia: number;
  cobroCliente: number;
  abono: number;
  historialAbonos: HistorialAbono[];
  fechaPromesa: string | null;
  pagadoAProveedor: boolean;
  cobradoACliente: boolean;
  usoGarantia: boolean;
  fechaISO: string;
  fechaDisplay: string;
  fechaPagoReal: string | null;
  // Campos para abonos al proveedor (pagos parciales)
  abonoProveedor?: number;
  historialAbonosProveedor?: HistorialAbonoProveedor[];
  // Historial de garantías
  historialGarantia?: HistorialGarantia[];
  // Campos para garantía mejorada
  fechaGarantia?: string | null; // Fecha cuando se reportó la garantía
  garantiaResuelta?: boolean; // Si ya se resolvió
  fechaResolucionGarantia?: string | null; // Fecha cuando se resolvió
  motivoGarantia?: string | null; // Descripción del problema
}

export interface ResumenRevendedor {
  nombre: string;
  deudaTotal: number;
  facturasPendientes: number;
}

// Registro de pagos de revendedores
export interface DistribucionPago {
  facturaId: number;
  cliente: string;
  empresa: string;
  montoAplicado: number;
  saldoAnterior: number;
  saldoNuevo: number;
  completada: boolean;
}

export interface PagoRevendedor {
  id: number;
  revendedor: string;
  montoTotal: number;
  fecha: string;
  fechaRegistro: string;
  distribucion: DistribucionPago[];
  nota?: string;
}

// =============================================
// TIPOS DE FINANZAS PERSONALES
// =============================================

export type CategoriaGasto = 
  | 'servicios' | 'arriendo' | 'agua' | 'luz' | 'internet' 
  | 'telefono' | 'tv' | 'transporte' | 'alimentacion' 
  | 'mercado' | 'salud' | 'educacion' | 'entretenimiento' | 'otros';

// Historial de pago de un gasto fijo
export interface PagoGastoFijo {
  id: number;
  fecha: string; // fecha completa YYYY-MM-DD
  montoPagado: number; // monto real que pagaste
  mes: string; // "YYYY-MM" el mes al que corresponde
}

export interface GastoFijo {
  id: number;
  nombre: string;
  monto: number; // monto estimado/referencia
  categoria: CategoriaGasto;
  diaCorte: number;
  recordatorio: boolean;
  pagadoEsteMes: boolean;
  mesPagado?: string | null; // formato "YYYY-MM" para saber en qué mes se pagó
  fechaPago?: string | null; // fecha exacta del pago
  montoPagadoEsteMes?: number | null; // monto real pagado este mes
  historialPagos?: PagoGastoFijo[]; // historial de todos los pagos
  fechaCreacion: string;
}

export interface Transaccion {
  id: number;
  descripcion: string;
  monto: number;
  categoria: CategoriaGasto;
  tipo: 'ingreso' | 'gasto';
  fecha: string;
  fechaCreacion: string;
}

export interface MetaAhorro {
  monto: number;
  activa: boolean;
}

// =============================================
// METAS FINANCIERAS (CAJITAS NU BANK)
// =============================================

export interface AporteMeta {
  id: number;
  fecha: string;
  monto: number;
  tipo: 'aporte' | 'rendimiento' | 'retiro';
  nota?: string;
}

export interface Bolsillo {
  id: number;
  nombre: string;
  icono: string; // emoji (💜 Nu, 💵 Efectivo, 🏦 Banco, etc)
  tipo: 'nu' | 'efectivo' | 'banco' | 'otro';
  saldo: number;
  tasaRendimientoAnual: number; // % EA (Nu ~11.5%, efectivo 0%)
  historialAportes: AporteMeta[];
}

export interface MetaFinanciera {
  id: number;
  nombre: string;
  icono: string; // emoji
  montoObjetivo: number;
  montoActual: number; // se calcula sumando bolsillos, pero se mantiene para compatibilidad
  fechaInicio: string;
  fechaObjetivo?: string; // fecha límite opcional
  aporteMensualPlaneado: number; // cuánto planea aportar al mes
  prioridad: 'alta' | 'media' | 'baja';
  color: string;
  activa: boolean;
  // Sistema de bolsillos
  bolsillos: Bolsillo[];
  // Campos legacy (para migración de datos existentes)
  cajitaNubank?: string;
  tasaRendimientoAnual?: number;
  historialAportes?: AporteMeta[];
}

export interface FinanzasMes {
  ingresosNegocio: number;
  ingresosAdicionales: number;
  totalIngresos: number;
  totalGastosFijos: number;
  gastosVariables: number;
  totalGastos: number;
  balance: number;
  porcentajeGastos: number;
  estadoFinanciero: 'excelente' | 'bien' | 'precaucion' | 'critico';
}

export interface Alerta {
  tipo: 'critico' | 'precaucion';
  mensaje: string;
}

export interface EvaluacionFinanciera {
  alertas: Alerta[];
  consejos: string[];
  finanzas: FinanzasMes;
}

// =============================================
// TIPOS DE CONFIGURACIÓN
// =============================================

export interface CategoriaConfig {
  nombre: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  color: string;
}

export type CategoriasGastoConfig = Record<CategoriaGasto, CategoriaConfig>;
