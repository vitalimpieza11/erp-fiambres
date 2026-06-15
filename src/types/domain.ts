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

export type RecipeItem = {
  productId: string;
  quantity: number;
  unit: UnitType;
};

export type Recipe = {
  id: string;
  finishedProductId: string;
  ingredientes: { productId: string; cantidad: number; unit?: string }[];
  activo?: boolean;
};

export type Product = { 
  id: string; 
  nombre: string; 
  type: ProductType; 
  unitType: UnitType;
  activo: boolean;
  precioSugerido?: number;
  precioComercial?: number;
  recipeItems?: RecipeItem[];
  recipeId?: string;
  recetaId?: string;
  pesoFeta?: number;
  pesoObjetivoGramos?: number;
  // Legacy fields for other modules (to be deprecated)
  costoActual?: number;
  stockActual?: number;
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
  type: 'PRODUCCION' | 'VENTA' | 'AJUSTE' | 'COMPRA';
  date: string;
  referenceId?: string;
  observaciones?: string;
  isDeleted: boolean;
  deletedAt?: number;
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
  observaciones?: string;
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
};

export type Sale = { 
  id: string; 
  orderId?: string; 
  customerId: string; 
  date: string; 
  items: SaleItem[];
  totalAmount: number; 
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  isDeleted: boolean;
  deletedAt?: number;
}

export type PurchaseItem = {
  productId: string;
  type: 'MERCADERIA' | 'INSUMO';
  quantity: number;
  unit: UnitType;
  unitCost: number;
  totalCost: number;
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
  paymentMethod: 'CONTADO' | 'CUENTA_CORRIENTE' | 'MIXTA';
  montoPagado: number;
  montoCuentaCorriente: number;
  status: 'ACTIVE' | 'VOIDED';
  reversalOf?: string | null;
  isDeleted: boolean;
  deletedAt?: number;
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
  sourceType: 'APORTE' | 'RETIRO' | 'AJUSTE' | 'ANULACION';
  sourceId: string;
  reversalOf: string | null;
  amount: number;
  description?: string;
  linkedCajaMovementId?: string;
  isDeleted: boolean;
  deletedAt?: number;
}
