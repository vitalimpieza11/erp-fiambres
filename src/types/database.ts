
export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number; // For legacy retrocompatibility
  price: number; // For legacy retrocompatibility
  cost: number; // For legacy retrocompatibility
  packages?: string[]; // IDs of physical packages (ProductPackage)
  pesoRealTotal?: number;
}

export interface ProductPackage {
  id?: string;
  productId: string; // ID of Presentacion
  productName: string;
  productionDate: number;
  saleDate?: number;
  weight: number; // peso real en kg
  cost: number; // costo real del paquete (pesoReal x costoKg)
  status: 'Disponible' | 'Reservado' | 'Vendido';
  orderId?: string; // Pedido origen
  customerId?: string; // Cliente final
  saleId?: string; // Venta final
  createdAt: number;
  updatedAt: number;
}

export interface Sale {
  id?: string;
  customerId: string;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number; // Manual discount
  total: number; // For legacy retrocompatibility
  grossTotal?: number; // Phase 5B
  commercialDiscount?: number; // Phase 5B (Listas de precios / Special prices)
  netTotal?: number; // Phase 5B (grossTotal - commercialDiscount - discount)
  saldoPendiente: number;
  status: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'ANULADA';
  paymentMethod?: string;
  remitoNumber?: string;
  invoiceNumber?: string;
  orderId?: string;
  date: number;
  createdAt: number;
  updatedAt: number;
}

export interface PaymentReceipt {
  id?: string;
  customerId: string;
  customerName: string;
  date: number;
  amount: number;
  method: string;
  appliedInvoices: { saleId: string; invoiceNumber: string; amountApplied: number }[];
  unallocatedAmount: number;
  observations: string;
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

export interface PurchasePayment {
  method: string;
  amount: number;
  partnerId?: string;
}

export interface Purchase {
  id?: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  total: number;
  status: 'pending' | 'completed' | 'cancelled' | 'PAGADA' | 'PENDIENTE' | 'PARCIAL';
  payments?: PurchasePayment[];
  amountPaid?: number;
  pendingBalance?: number;
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
  type: 'in' | 'out' | 'transfer';
  amount: number;
  currency?: string;
  method: string; // Free now: 'cash', 'transfer', 'cheque', or custom
  origin?: 'cash' | 'bank' | 'socio'; // Legacy
  description: string;
  category: string; // e.g. 'sale', 'purchase', 'expense', 'withdrawal', 'aporte_socio', 'inversion_inicial', 'bien_capital'
  referenceId?: string;
  date: number;
  createdAt: number;
  bankId?: string; // Legacy
  
  // Flexible Accounts
  accountId?: string;
  toAccountId?: string; // For transfers
  partnerId?: string; // For Aportes de Socio
  aporteType?: 'dinero' | 'bien_capital' | 'vehiculo' | 'mercaderia' | 'equipamiento' | 'tecnologia' | 'otro';
  tipoMovimiento?: 'APORTE_SOCIO' | string;
  destino?: 'caja' | 'banco' | 'activo' | string;
  
  // Relations
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  
  // Status y Pasivos
  status?: 'completado' | 'pendiente' | 'anulado';
  dueDate?: number; // Vencimiento para pasivos
  originalAmount?: number; // Importe original (si es pago parcial)
  pendingAmount?: number; // Saldo pendiente
  
  // Manual Override & Audit
  isManualOverride?: boolean;
  sourceModule?: 'MANUAL' | 'VENTAS' | 'COMPRAS' | 'SOCIOS' | 'SISTEMA' | string;
  isEditable?: boolean;
  isDeletable?: boolean;
  auditLog?: {
    date: number;
    user: string;
    action: string;
    previousValues: Partial<CashMovement>;
    newValues: Partial<CashMovement>;
  }[];
}



export interface ErpEventLog {
  id?: string;
  type: 'SALE' | 'PURCHASE' | 'PRODUCTION';
  timestamp: number;
  status: 'success' | 'failed';
  affectedDocuments: string[];
  error?: string;
}

export interface PartnerTransaction {
  id?: string;
  partnerId: string;
  date: number;
  amount: number;
  type: "APORTE" | "RETIRO" | "DEVOLUCION";
  contributionType?: "DINERO" | "MERCADERIA" | "MAQUINARIA" | "INSUMOS" | "SERVICIOS";
  method: "CAJA" | "BANCO" | "TRANSFERENCIA" | "COMPENSACION";
  referenceId?: string;
  description: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  createdAt: number;
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
  priceListId?: string;
  priceListName?: string;
  specialPrices?: Record<string, { mode: 'price' | 'margin', value: number }>;
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
  currentBalance?: number;
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

  // Configuración Comercial
  comercial_margenRiesgo: number;
  comercial_margenOptimo: number;
  comercial_alertaCostoAumento: number;
}

export interface RecipeIngredient {
  productId: string;
  productName: string;
  quantity: number; // weight (kg), percentage, or fetas count
}

export interface Recipe {
  id?: string;
  name?: string; // Recipe independent name
  productId?: string; // Optional Presentation ID for legacy support
  productName?: string; // Optional Presentation name
  customerId?: string; // Optional customer override
  customerName?: string;
  ingredients: RecipeIngredient[];
  costoManoObra: number;
  costoAdicional: number;
  method?: 'weight' | 'percentage' | 'fetas'; // POR PESO, POR PORCENTAJE, POR FETAS
  usarMermaEnCosto?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number; // number of packages or units ordered (INTENCIÓN DE COMPRA)
  price?: number; // legacy
  producedPackages?: string[]; // IDs of ProductPackage generated for this order item
}

export interface Order {
  id?: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  subtotal?: number;
  discount?: number; // Manual discount
  total?: number; // For legacy retrocompatibility
  grossTotal?: number; // Phase 5B
  commercialDiscount?: number; // Phase 5B
  netTotal?: number; // Phase 5B
  status: 'PENDIENTE' | 'EN_PRODUCCION' | 'PRODUCIDO' | 'ENTREGADO' | 'FACTURADO' | 'CERRADO';
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
  actualProduced?: Record<string, number[]>; // array of weights in kg
  mermaGlobalPorcentaje?: number;
  realProductionCost?: number;
  finalChargedAmount?: number;
}

export interface Mercaderia {
  id?: string;
  name: string;
  category: string;
  costoKg: number;
  precioSugeridoKg?: number;
  precioComercialKg?: number;
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
  recetaId?: string; // Legacy
  recipeId?: string; // ID real de la receta
  recipeName?: string; // Nombre real de la receta
  pesoObjetivoGramos: number; // pesoObjetivoGramos
  cantidadFetasEstimada: number; // cantidadFetasEstimada
  bolsaId?: string; // bolsa utilizada
  bolsaName?: string;
  etiquetaId?: string; // etiqueta utilizada
  etiquetaName?: string;
  precioSugeridoKg?: number;
  precioComercialKg: number; // precioComercialKg
  manoObra?: number; // Costo mano de obra (si corresponde)
  observations: string;
  isActive: boolean;
  commercialStatus?: 'activo' | 'destacado' | 'lanzamiento' | 'promocion' | 'descontinuado';
  unidadesPorCaja?: number;
  createdAt?: number;
  updatedAt?: number;
}

