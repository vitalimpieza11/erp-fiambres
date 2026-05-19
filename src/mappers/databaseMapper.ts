import { parseNumber } from '../utils/format';
import type { Product, Sale, Purchase, ProductionBatch, Customer, Supplier, SystemSettings } from '../types/database';

export class DatabaseMapper {
  static toDomainProduct(data: any, id?: string): Product {
    return {
      id: id || data.id,
      name: data.name || '',
      category: data.category || 'fiambres',
      brand: data.brand || '',
      provider: data.provider || '',
      observations: data.observations || '',
      isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
      
      costoHorma: parseNumber(data.costoHorma),
      pesoHorma: parseNumber(data.pesoHorma),
      pesoFeta: parseNumber(data.pesoFeta),
      mermaEstimada: parseNumber(data.mermaEstimada),
      gramajeVenta: parseNumber(data.gramajeVenta) || 200,
      
      costoBolsa: parseNumber(data.costoBolsa),
      costoEtiqueta: parseNumber(data.costoEtiqueta),
      manoObra: parseNumber(data.manoObra),
      margenDeseado: parseNumber(data.margenDeseado),
      precioManual: parseNumber(data.precioManual),
      
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

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

  static toDomainProductionBatch(data: any, id?: string): ProductionBatch {
    return {
      id: id || data.id,
      productId: data.productId || '',
      productName: data.productName || '',
      quantityProduced: parseNumber(data.quantityProduced),
      rawMaterialsUsed: Array.isArray(data.rawMaterialsUsed) ? data.rawMaterialsUsed.map((rm: any) => ({
        productId: rm.productId || '',
        quantity: parseNumber(rm.quantity)
      })) : [],
      cost: parseNumber(data.cost),
      mermaPercent: parseNumber(data.mermaPercent),
      status: data.status || 'planned',
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
      tesoreria_mediosPago: data.tesoreria_mediosPago || ''
    };
  }
}
export default DatabaseMapper;
