import {
  Wifi, Home, Droplets, Lightbulb, Smartphone, Tv, Car,
  Utensils, ShoppingCart, Heart, GraduationCap, Coffee,
  MoreHorizontal
} from 'lucide-react';
import type { CategoriasGastoConfig } from './types';

export const META_MENSUAL_NEGOCIO = 5000000;

export const CATEGORIAS_GASTO: CategoriasGastoConfig = {
  servicios: { nombre: 'Servicios', icon: Wifi, color: 'blue' },
  arriendo: { nombre: 'Arriendo', icon: Home, color: 'purple' },
  agua: { nombre: 'Agua', icon: Droplets, color: 'cyan' },
  luz: { nombre: 'Luz', icon: Lightbulb, color: 'yellow' },
  internet: { nombre: 'Internet', icon: Wifi, color: 'indigo' },
  telefono: { nombre: 'Teléfono', icon: Smartphone, color: 'green' },
  tv: { nombre: 'TV/Streaming', icon: Tv, color: 'red' },
  transporte: { nombre: 'Transporte', icon: Car, color: 'orange' },
  alimentacion: { nombre: 'Alimentación', icon: Utensils, color: 'amber' },
  mercado: { nombre: 'Mercado', icon: ShoppingCart, color: 'lime' },
  salud: { nombre: 'Salud', icon: Heart, color: 'pink' },
  educacion: { nombre: 'Educación', icon: GraduationCap, color: 'violet' },
  entretenimiento: { nombre: 'Entretenimiento', icon: Coffee, color: 'rose' },
  otros: { nombre: 'Otros', icon: MoreHorizontal, color: 'gray' }
};

export const COLORES_RANKING = [
  { bg: 'bg-gradient-to-r from-amber-500 to-yellow-500', text: 'text-amber-500', border: 'border-amber-500/30' },
  { bg: 'bg-gradient-to-r from-gray-400 to-gray-300', text: 'text-gray-400', border: 'border-gray-400/30' },
  { bg: 'bg-gradient-to-r from-amber-700 to-amber-600', text: 'text-amber-700', border: 'border-amber-700/30' },
  { bg: 'bg-purple-600', text: 'text-purple-400', border: 'border-purple-500/30' },
  { bg: 'bg-indigo-600', text: 'text-indigo-400', border: 'border-indigo-500/30' },
];

export const STORAGE_KEYS = {
  FACTURAS: 'seyaShopDB_v18_historial',
  REVENDEDORES_OCULTOS: 'seyaShop_hiddenResellers',
  PAGOS_REVENDEDORES: 'seyaShop_pagosRevendedores',
  GASTOS_FIJOS: 'seyaShop_gastosFijos',
  TRANSACCIONES: 'seyaShop_transacciones',
  META_AHORRO: 'seyaShop_metaAhorro',
  METAS_FINANCIERAS: 'seyaShop_metasFinancieras',
  PRESUPUESTO: 'seyaShop_presupuesto',
  FACTURAS_OCULTAS: 'seyaShop_facturasOcultas',
};
