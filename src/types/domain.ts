// Entidades Comerciales
export type Customer = { 
  id: string; 
  nombre: string; 
  name?: string;
  razonSocial: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  observaciones: string;
  activo: boolean;
}

export type Supplier = { 
  id: string; 
  nombre: string; 
  name?: string;
  razonSocial: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  observaciones: string;
  activo: boolean;
}

export type PriceList = {
  id: string;
  name: string;
  customerId?: string;
  items: {
    productId: string;
    price: number;
  }[];
  activo: boolean;
};

// Stock y Productos
export type ProductType = 'MERCADERIA' | 'INSUMO' | 'PRESENTACION';
export type UnitType = 'KG' | 'GRAMOS' | 'UNIDADES' | 'FETAS';

export type RecipeUnitType = 'gramos' | 'kilogramos' | 'unidades' | 'fetas';

export type RecipeItem = {
  ingredientProductId: string;
  ingredientName: string;
  quantity: number;
  unit: RecipeUnitType;
  pesoNeto?: number;
};

export type Recipe = {
  id: string;
  productId: string;
  productName: string;
  createdAt: string;
  updatedAt: string;
  items: RecipeItem[];
};

export function mapRecipeUnitToUnitType(unit: RecipeUnitType): UnitType {
  if (unit === 'kilogramos') return 'KG';
  if (unit === 'gramos') return 'GRAMOS';
  if (unit === 'unidades') return 'UNIDADES';
  if (unit === 'fetas') return 'FETAS';
  return 'KG';
}

export function mapUnitTypeToRecipeUnit(unit: string): RecipeUnitType {
  const u = String(unit).toUpperCase().trim();
  if (u === 'KG') return 'kilogramos';
  if (u === 'GRAMOS') return 'gramos';
  if (u === 'UNIDADES') return 'unidades';
  if (u === 'FETAS') return 'fetas';
  return 'gramos';
}

export type Product = { 
  id: string; 
  nombre: string; 
  type: ProductType; 
  unitType: UnitType;
  activo: boolean;
  precioComercial?: number;
  recipeItems?: RecipeItem[];
  recipeId?: string;
  recetaId?: string;
  pesoFeta?: number;
  pesoObjetivoGramos?: number;
  pesoObjetivoKg?: number;
  // Cliente al que se destina esta presentación (solo aplica a PRESENTACION)
  clienteAsignado?: string;
  // Legacy fields for other modules (to be deprecated)
  costoActual?: number;
  stockActual?: number;
  costoUltimaCompra?: number;
  fechaUltimaCompra?: string;
  mermaPorDefecto?: number;
  utilidadObjetivo?: number;
  mermaObjetivo?: number;
  precio150g?: number;
  precio250g?: number;
  precio500g?: number;
  precio1kg?: number;
  margenDeseado?: number;
  pricingMode?: 'AUTO' | 'MANUAL';
  // FASE 3 - Códigos de Balanza
  codigoBalanza?: number;
  nombreCortoBalanza?: string;
}

export type Equivalencia = {
  id: string;
  nombre: string;
  origen: string;
  destino: string;
  factor: number;
};

export type FinishedStock = {
  productId: string;
  disponible: number;
  rendimientoEstimado: number;
}

export type StockMovement = {
  id: string;
  productId: string;
  qty: number;
  type: 'PRODUCCION' | 'VENTA' | 'AJUSTE' | 'COMPRA' | 'PRODUCCION_STOCK' | 'PRODUCCION_PEDIDO' | 'MERMA_PRODUCCION';
  date: string;
  referenceId?: string;
  observaciones?: string;
  isDeleted: boolean;
  deletedAt?: number;
  productionStepId?: string;
  isReverted?: boolean;
  revertedAt?: string;
  revertedBy?: string;
  revertedReason?: string;
}

// Flujo Operativo
export type OrderStatus =
  | 'PENDIENTE'
  | 'EN_PRODUCCION'
  | 'PRODUCIDO'
  | 'ENTREGADO'
  | 'FACTURADO'
  | 'ANULADO';

export type OrderItem = {
  productId: string;
  cantidad: number;
  unidad: 'KG' | 'GRAMOS' | 'UNIDADES' | 'FETAS';
  precioEstimado: number;
  subtotal: number;
  pesoReal?: number;
  pesosReales?: number[];
  observaciones?: string;
  cantidadPaquetes?: number;
  pesoTotal?: number;
  pesoPromedio?: number;
  recipeItems?: any[];
  productionStepId?: string;
};


export type Order = { 
  id: string; 
  customerId: string; 
  fecha: string;
  observaciones: string;
  status: OrderStatus; 
  items: OrderItem[]; 
  totalEstimado: number;
  isDeleted: boolean;
  deletedAt?: number;
}

export type SaleStatus = 'PENDIENTE' | 'FACTURADO' | 'COBRADO' | 'ANULADO';
export type PaymentMethod = 'EFECTIVO_TRANSFERENCIA' | 'CUENTA_CORRIENTE' | 'PENDIENTE';

export type SaleItem = {
  productId: string;
  cantidad: number;
  unidad: 'KG' | 'GRAMOS' | 'UNIDADES' | 'FETAS';
  precioUnitario: number;
  subtotal: number;
  // Campos de infraestructura de costos (Fase 4 / Costo Histórico / Rentabilidad Real)
  costoUnitario?: number;
  costoTotal?: number;
  rentabilidadBruta?: number;
  // Nuevos campos para Rentabilidad Real y Peso Real
  pesoReal?: number;
  precioRealKg?: number;
  importeReal?: number;
  costoUnitarioHistorico?: number;
  costoTotalHistorico?: number;
  pesosReales?: number[];
  cantidadPaquetes?: number;
  pesoTotal?: number;
  pesoPromedio?: number;
  presentationType?: '150G' | '250G' | '500G' | '1KG';
};

export type RecipeSnapshotItem = {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
};

export type Package = {
  id?: string;
  productId: string;
  productName: string;
  weight: number;          // peso real en Kg
  costPerKg: number;       // costo de producción por Kg
  totalCost: number;       // costPerKg * weight
  status: 'STOCK' | 'SOLD';
  orderId?: string;        // pedido asociado si aplica
  saleId?: string;         // venta asociada si aplica
  producedAt: string;      // fecha de producción (ISO String)
  recipeSnapshot?: RecipeSnapshotItem[];
  productionStepId?: string;
  isReverted?: boolean;
  revertedAt?: string;
  revertedBy?: string;
  revertedReason?: string;
};

export type SystemSettings = {
  id?: string;
  usePackages: boolean;
  allowNegativeStock: boolean;
  // Empresa Configuration
  companyLogo?: string;
  companyRazonSocial?: string;
  companyNombreComercial?: string;
  companyDireccion?: string;
  companyCiudad?: string;
  companyProvincia?: string;
  companyTelefono?: string;
  companyEmail?: string;
  companyCuit?: string;
  companyCondicionIva?: string;
  companyIngresosBrutos?: string;
  companyObservacionesLegales?: string;
  // Costos de embalaje globales
  packagingSettings?: {
    bolsaProductId?: string;
    etiquetaProductId?: string;
    folexProductId?: string;
  };
};


export type Sale = { 
  id: string; 
  orderId?: string; 
  customerId: string; 
  date: string; 
  items: SaleItem[];
  totalAmount: number; 
  costoTotal?: number;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  isDeleted: boolean;
  deletedAt?: number;
  tipoComprobante?: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'PRESUPUESTO' | 'REMITO';
  isHistorical?: boolean;
  deliveryStatus?: 'REGISTRADA' | 'PENDIENTE' | 'ENTREGADO';
}

export type PurchaseItem = {
  productId: string;
  type: 'MERCADERIA' | 'INSUMO';
  quantity: number;
  unit: UnitType;
  unitCost: number;
  totalCost: number;
};

export type PurchasePayment = {
  accountId: string;
  amount: number;
};

export type Purchase = {
  id: string;
  type: 'PURCHASE' | 'PURCHASE_REVERSAL';
  supplierId: string;
  date: string;
  items: PurchaseItem[];
  subtotal: number;
  impuestos: number | null;
  total: number;
  paymentMethod: 'CONTADO' | 'CUENTA_CORRIENTE' | 'MIXTA' | 'MULTIPLES';
  montoPagado: number;
  montoCuentaCorriente: number;
  payments?: PurchasePayment[];
  status: 'ACTIVE' | 'VOIDED';
  reversalOf?: string | null;
  isDeleted: boolean;
  deletedAt?: number;
  isHistorical?: boolean;
};

export type CustomerMovement = {
  id: string;
  customerId: string;
  date: string;
  type: 'DEUDA' | 'PAGO' | 'AJUSTE';
  amount: number; // positive for deuda, negative for pago? Actually, just amount and type.
  referenceId?: string; // sale id or payment id
  observaciones?: string;
  isDeleted: boolean;
  deletedAt?: number;
}

export type SupplierMovement = {
  id: string;
  supplierId: string;
  date: string;
  type: 'COMPRA' | 'PAGO' | 'AJUSTE' | 'ANULACION';
  amount: number;
  observaciones?: string;
  sourceType: 'COMPRA' | 'PAGO' | 'AJUSTE' | 'REVERSAL_COMPRA' | 'REVERSAL_PAGO' | 'REVERSAL_AJUSTE' | string;
  sourceId: string;
  reversalOf: string | null;
  isDeleted: boolean;
  deletedAt?: number;
}

// Finanzas y Societario
export type CajaMovement = { 
  id: string; 
  type: 'INCOME' | 'EXPENSE'; 
  amount: number; 
  date: string; 
  category: string;
  description?: string;
  // referenceId está DEPRECADO en V2, usar sourceId en su lugar
  referenceId?: string; 
  operation?: 'MOVEMENT' | 'REVERSAL';
  reasonType?: string;
  sourceType?: string;
  sourceId?: string;
  shareholderId?: string;
  reversalOf?: string | null;
  isDeleted: boolean;
  deletedAt?: number;
  accountId?: string;
}

export type Shareholder = {
  id: string;
  nombre: string;
  type: 'ACTIVO' | 'INVERSOR' | 'OPERATIVO';
  participacionPorcentaje: number;
  activo: boolean;
}

export type ShareholderMovement = {
  id: string;
  shareholderId: string;
  date: string;
  sourceType: 'APORTE' | 'RETIRO' | 'AJUSTE' | 'ANULACION' | 'APORTE_CAPITALIZACION';
  sourceId: string;
  reversalOf: string | null;
  amount: number;
  description?: string;
  linkedCajaMovementId?: string;
  isDeleted: boolean;
  deletedAt?: number;
  tipoAporte?: 'DINERO' | 'BIEN';
  descripcionBien?: string;
  estado?: 'ACTIVO' | 'ANULADO';
  fechaAnulacion?: string;
  usuarioAnulacion?: string;
  motivoAnulacion?: string;
}

export type FinancialAccount = {
  id: string;
  nombre: string;
  tipo: 'EFECTIVO' | 'BANCO' | 'BILLETERA_VIRTUAL';
  activa: boolean;
  createdAt: number;
};

export type ShareholderLoanPayment = {
  id: string;
  amount: number;
  date: string;
  description: string;
  linkedCajaMovementId?: string;
  type?: 'PAYMENT' | 'CAPITALIZATION';
};

export type ShareholderLoan = {
  id: string;
  shareholderId: string;
  shareholderName: string;
  amount: number;
  date: string;
  description: string;
  remainingAmount: number;
  status: 'PENDIENTE' | 'PAGADO';
  isDeleted: boolean;
  payments?: ShareholderLoanPayment[];
  // FASE 5: liga al movimiento INCOME de caja creado al registrar el préstamo
  linkedCajaMovementId?: string;
};

export type ProductionItem = {
  id: string;
  orderId: string;
  orderItemId?: string;
  productId: string;
  pesoReal: number;
  fecha: string;
  operario?: string;
};

export type Arqueo = {
  id?: string;
  date: string;
  accountId: string;
  accountName: string;
  billetes: {
    [key: number]: number;
  };
  monedas: number;
  totalContado: number;
  saldoInicial: number;
  ingresos: number;
  egresos: number;
  saldoTeorico: number;
  diferencia: number;
  observaciones?: string;
};


