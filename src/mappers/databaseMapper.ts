import { parseNumber } from '../utils/format';
import type { Sale, Purchase, Customer, Supplier, SystemSettings, Mercaderia, Insumo, Presentacion } from '../types/database';

export class DatabaseMapper {
  static toDomainSale(data: any, id?: string): Sale {
    return {
      id: id || data.id,
      customerId: data.customerId || '',
      customerName: data.customerName || '',
      items: Array.isArray(data.items) ? data.items.map((item: any) => ({
        productId: item.productId || '',
        productName: item.productName || '',
        quantity: parseNumber(item.quantity),
        price: parseNumber(item.price),
        cost: parseNumber(item.cost)
      })) : [],
      subtotal: parseNumber(data.subtotal),
      discount: parseNumber(data.discount),
      total: parseNumber(data.total),
      status: data.status || 'pending',
      paymentStatus: data.paymentStatus || 'pending',
      paymentMethod: data.paymentMethod || 'cash',
      remitoNumber: data.remitoNumber || '',
      orderId: data.orderId || undefined,
      date: data.date || Date.now(),
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now()
    };
  }

  static toDomainPurchase(data: any, id?: string): Purchase {
    return {
      id: id || data.id,
      supplierId: data.supplierId || '',
      supplierName: data.supplierName || '',
      items: Array.isArray(data.items) ? data.items.map((item: any) => ({
        productId: item.productId || '',
        productName: item.productName || '',
        quantity: parseNumber(item.quantity),
        cost: parseNumber(item.cost)
      })) : [],
      total: parseNumber(data.total),
      status: data.status || 'pending',
      invoiceNumber: data.invoiceNumber || '',
      date: data.date || Date.now(),
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now()
    };
  }

  static toDomainCustomer(data: any, id?: string): Customer {
    return {
      id: id || data.id,
      name: data.name || '',
      cuit: data.cuit || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      creditLimit: parseNumber(data.creditLimit),
      currentBalance: parseNumber(data.currentBalance),
      paymentTerms: parseNumber(data.paymentTerms) || 30,
      isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now()
    };
  }

  static toDomainSupplier(data: any, id?: string): Supplier {
    return {
      id: id || data.id,
      name: data.name || '',
      cuit: data.cuit || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      category: data.category || '',
      isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now()
    };
  }

  static toDomainSettings(data: any): SystemSettings {
    return {
      empresa_nombre: data.empresa_nombre || '',
      empresa_razon: data.empresa_razon || '',
      empresa_cuit: data.empresa_cuit || '',
      empresa_direccion: data.empresa_direccion || '',
      empresa_telefono: data.empresa_telefono || '',
      empresa_email: data.empresa_email || '',
      empresa_whatsapp: data.empresa_whatsapp || '',
      empresa_instagram: data.empresa_instagram || '',
      
      comercial_listaDefault: data.comercial_listaDefault || '1',
      comercial_margenDefault: parseNumber(data.comercial_margenDefault) || 30,
      comercial_politicaDescuento: data.comercial_politicaDescuento || '1',
      
      costo_bolsa: parseNumber(data.costo_bolsa),
      costo_etiqueta: parseNumber(data.costo_etiqueta),
      costo_manoObra: parseNumber(data.costo_manoObra),
      
      ventas_numeracionAutomatica: typeof data.ventas_numeracionAutomatica === 'boolean' ? data.ventas_numeracionAutomatica : true,
      ventas_prefijoRemito: data.ventas_prefijoRemito || 'REM-0001',
      ventas_proximoNumero: parseNumber(data.ventas_proximoNumero) || 1000,
      ventas_observacionesDefault: data.ventas_observacionesDefault || '',
      ventas_textoPieRemito: data.ventas_textoPieRemito || '',
      ventas_firmaDigital: typeof data.ventas_firmaDigital === 'boolean' ? data.ventas_firmaDigital : true,
      
      stock_diasAlertaVencimiento: parseNumber(data.stock_diasAlertaVencimiento) || 15,
      stock_criticoGlobal: parseNumber(data.stock_criticoGlobal) || 10,
      stock_notificarEmail: typeof data.stock_notificarEmail === 'boolean' ? data.stock_notificarEmail : true,
      stock_permitirNegativo: typeof data.stock_permitirNegativo === 'boolean' ? data.stock_permitirNegativo : false,
      
      prod_mermaEstandar: parseNumber(data.prod_mermaEstandar) || 12,
      prod_unidadMedida: data.prod_unidadMedida || 'kg',
      
      clientes_diasPago: parseNumber(data.clientes_diasPago) || 30,
      clientes_limiteCredito: parseNumber(data.clientes_limiteCredito) || 500000,
      clientes_bloquearMorosos: typeof data.clientes_bloquearMorosos === 'boolean' ? data.clientes_bloquearMorosos : true,
      clientes_alertaMorosidad: data.clientes_alertaMorosidad || '2',
      
      tesoreria_fondoCajaFijo: parseNumber(data.tesoreria_fondoCajaFijo) || 50000,
      tesoreria_bancos: data.tesoreria_bancos || '',
      tesoreria_mediosPago: data.tesoreria_mediosPago || '',
      
      currencies: data.currencies || [
        { code: 'ARS', symbol: '$', rate: 1 },
        { code: 'USD', symbol: 'U$S', rate: 1000 }
      ],
      reinvestment_categories: data.reinvestment_categories || [
        'Maquinaria',
        'Vehículos',
        'Marketing',
        'Tecnología',
        'Infraestructura',
        'Mercadería estratégica',
        'Capital de trabajo'
      ],
      expense_categories: data.expense_categories || [
        'Mercadería',
        'Alquiler',
        'Servicios',
        'Sueldos',
      ]
    };
  }

  static toDomainMercaderia(data: any, id?: string): Mercaderia {
    return {
      id: id || data.id,
      name: data.name || '',
      category: data.category || 'fiambres',
      costoKg: parseNumber(data.costoKg),
      stockKg: parseNumber(data.stockKg),
      provider: data.provider || '',
      observations: data.observations || '',
      pesoFeta: parseNumber(data.pesoFeta) || 0,
      mermaEstimada: parseNumber(data.mermaEstimada) || 0,
      isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  static toDomainInsumo(data: any, id?: string): Insumo {
    return {
      id: id || data.id,
      name: data.name || '',
      costoUnitario: parseNumber(data.costoUnitario) || parseNumber(data.costoBolsa) || parseNumber(data.costoEtiqueta) || 0,
      stockUnidades: parseNumber(data.stockUnidades),
      observations: data.observations || '',
      isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  static toDomainPresentacion(data: any, id?: string): Presentacion {
    return {
      id: id || data.id,
      name: data.name || '',
      customerId: data.customerId || '',
      customerName: data.customerName || '',
      productoBaseId: data.productoBaseId || '',
      productoBaseName: data.productoBaseName || '',
      recetaId: data.recetaId || '',
      pesoObjetivoGramos: parseNumber(data.pesoObjetivoGramos) || parseNumber(data.gramajeVenta) || 200,
      cantidadFetasEstimada: parseNumber(data.cantidadFetasEstimada) || 0,
      bolsaId: data.bolsaId || '',
      bolsaName: data.bolsaName || '',
      etiquetaId: data.etiquetaId || '',
      etiquetaName: data.etiquetaName || '',
      precioVentaKg: parseNumber(data.precioVentaKg) || 0,
      manoObra: data.manoObra !== undefined ? parseNumber(data.manoObra) : undefined,
      observations: data.observations || '',
      isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }
}
export default DatabaseMapper;
