
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
  orderId?: string;
  date: number;
  createdAt: number;
  updatedAt: number;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  cost: number;
  itemType?: string;
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
  currency?: string;
  method: 'cash' | 'transfer' | 'cheque';
  origin?: 'cash' | 'bank';
  description: string;
  category: string; // e.g. 'sale', 'purchase', 'expense', 'withdrawal'
  referenceId?: string;
  date: number;
  createdAt: number;
  bankId?: string;
}

export interface ProfitDistribution {
  id?: string;
  date: number;
  amount: number;
  type: 'reinvestment' | 'distribution'; // 'reinvestment' for Reinversión, 'distribution' for Distribución Societaria
  observations: string;
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
  
  currencies: { code: string; symbol: string; rate: number }[];
  reinvestment_categories: string[];
  expense_categories: string[];
}

export interface RecipeIngredient {
  productId: string;
  productName: string;
  quantity: number; // weight (kg), percentage, or fetas count
}

export interface Recipe {
  id?: string;
  productId: string; // Presentation ID
  productName: string; // Presentation name
  customerId?: string; // Optional customer override
  customerName?: string;
  ingredients: RecipeIngredient[];
  costoManoObra: number;
  costoAdicional: number;
  method?: 'weight' | 'percentage' | 'fetas'; // POR PESO, POR PORCENTAJE, POR FETAS
  createdAt: number;
  updatedAt: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number; // number of packages or units ordered
  price: number; // unit price (custom or from list)
}

export interface Order {
  id?: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'pending' | 'in_production' | 'delivered' | 'invoiced';
  observations?: string;
  date: number;
  createdAt: number;
  updatedAt: number;
  // Automatically generated metadata
  rawMaterialNeeds?: { productId: string; productName: string; quantity: number }[];
  productionCost?: number;
  marginPercent?: number;
  saleId?: string;
  actualConsumptions?: Record<string, { value: number; unit: string }>;
  actualProduced?: Record<string, number>;
}

export interface Mercaderia {
  id?: string;
  name: string;
  category: string;
  costoKg: number;
  stockKg: number;
  provider: string; // proveedor habitual
  observations: string;
  pesoFeta: number; // for fetas recipe calculation
  mermaEstimada: number;
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface Insumo {
  id?: string;
  name: string;
  costoUnitario: number;
  stockUnidades: number;
  observations: string;
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface Presentacion {
  id?: string;
  name: string;
  customerId: string; // cliente
  customerName?: string;
  productoBaseId?: string; // productoBase (si aplica)
  productoBaseName?: string;
  recetaId?: string; // receta asociada (si aplica)
  pesoObjetivoGramos: number; // pesoObjetivoGramos
  cantidadFetasEstimada: number; // cantidadFetasEstimada
  bolsaId: string; // bolsa utilizada
  bolsaName?: string;
  etiquetaId: string; // etiqueta utilizada
  etiquetaName?: string;
  precioVentaKg: number; // precioVentaKg
  manoObra?: number; // Costo mano de obra (si corresponde)
  observations: string;
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

