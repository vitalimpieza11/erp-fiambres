export interface Product {
  id?: string;
  name: string;
  category: string;
  brand: string;
  provider: string;
  observations: string;
  isActive: boolean;

  costoHorma: number;
  pesoHorma: number;
  
  pesoFeta: number;
  mermaEstimada: number;
  gramajeVenta: number;
  
  costoBolsa: number;
  costoEtiqueta: number;
  manoObra: number;
  
  margenDeseado: number;
  precioManual: number;

  createdAt?: number;
  updatedAt?: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  cost: number;
}

export interface Sale {
  id?: string;
  customerId: string;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'partial';
  paymentMethod: string;
  remitoNumber?: string;
  date: number;
  createdAt: number;
  updatedAt: number;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  cost: number;
}

export interface Purchase {
  id?: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  invoiceNumber?: string;
  date: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProductionItem {
  productId: string;
  quantity: number;
}

export interface ProductionBatch {
  id?: string;
  productId: string;
  productName: string;
  quantityProduced: number; // in packets or kg
  rawMaterialsUsed: ProductionItem[];
  cost: number;
  mermaPercent: number;
  status: 'planned' | 'in_progress' | 'completed';
  date: number;
  createdAt: number;
  updatedAt: number;
}

export interface StockMovement {
  id?: string;
  productId: string;
  productName: string;
  quantity: number; // positive for input, negative for output
  type: 'in' | 'out' | 'adjustment';
  referenceType: 'sale' | 'purchase' | 'production' | 'manual';
  referenceId?: string;
  date: number;
  observations?: string;
  createdAt: number;
}

export interface CashMovement {
  id?: string;
  type: 'in' | 'out';
  amount: number;
  method: 'cash' | 'transfer' | 'cheque';
  description: string;
  category: string; // e.g. 'sale', 'purchase', 'expense', 'withdrawal'
  referenceId?: string;
  date: number;
  createdAt: number;
}

export interface ErpEventLog {
  id?: string;
  type: 'SALE' | 'PURCHASE' | 'PRODUCTION';
  timestamp: number;
  status: 'success' | 'failed';
  affectedDocuments: string[];
  error?: string;
}

export interface Customer {
  id?: string;
  name: string;
  cuit: string;
  email: string;
  phone: string;
  address: string;
  creditLimit: number;
  currentBalance: number;
  paymentTerms: number; // e.g. 30 days
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Supplier {
  id?: string;
  name: string;
  cuit: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SystemSettings {
  empresa_nombre: string;
  empresa_razon: string;
  empresa_cuit: string;
  empresa_direccion: string;
  empresa_telefono: string;
  empresa_email: string;
  empresa_whatsapp: string;
  empresa_instagram: string;
  
  comercial_listaDefault: string;
  comercial_margenDefault: number;
  comercial_politicaDescuento: string;
  
  costo_bolsa: number;
  costo_etiqueta: number;
  costo_manoObra: number;
  
  ventas_numeracionAutomatica: boolean;
  ventas_prefijoRemito: string;
  ventas_proximoNumero: number;
  ventas_observacionesDefault: string;
  ventas_textoPieRemito: string;
  ventas_firmaDigital: boolean;
  
  stock_diasAlertaVencimiento: number;
  stock_criticoGlobal: number;
  stock_notificarEmail: boolean;
  stock_permitirNegativo: boolean;
  
  prod_mermaEstandar: number;
  prod_unidadMedida: string;
  
  clientes_diasPago: number;
  clientes_limiteCredito: number;
  clientes_bloquearMorosos: boolean;
  clientes_alertaMorosidad: string;
  
  tesoreria_fondoCajaFijo: number;
  tesoreria_bancos: string;
  tesoreria_mediosPago: string;
}
