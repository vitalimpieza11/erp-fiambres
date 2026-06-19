import { getDocs, query, where, doc, updateDoc, runTransaction, collection, orderBy, limit, addDoc } from 'firebase/firestore';
import { db, COLLECTIONS, removeUndefinedFields } from '../../lib/firebase';
import type { Sale, Order, Customer, Product, SaleItem } from '../../types/domain';
import { convertQuantityToBaseUnit } from '../../lib/unitConverter';
import { truncateDecimals } from '../../lib/formatters';
import { normalizeOrder } from '../pedidos/ordersRepository';

export const salesRepository = {
  async fetchSalesData(): Promise<{
    sales: Sale[];
    orders: Order[];
    customers: Customer[];
    products: Product[];
    recipes: any[];
    equivalences: any[];
    packages: any[];
  }> {
    const [salesSnap, ordersSnap, customersSnap, productsSnap, recipesSnap, equivSnap, packagesSnap] = await Promise.all([
      getDocs(query(COLLECTIONS.SALES, where('isDeleted', '==', false), orderBy('date', 'desc'), limit(50))),
      getDocs(query(COLLECTIONS.ORDERS, where('isDeleted', '==', false), orderBy('fecha', 'desc'), limit(50))),
      getDocs(query(COLLECTIONS.CUSTOMERS, where('activo', '==', true))),
      getDocs(query(COLLECTIONS.PRODUCTS, where('activo', '==', true))),
      getDocs(COLLECTIONS.RECIPES),
      getDocs(COLLECTIONS.EQUIVALENCES),
      getDocs(COLLECTIONS.PACKAGES) // Fetch all for historical package mapping
    ]);

    return {
      sales: salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)),
      orders: ordersSnap.docs.map(d => normalizeOrder({ id: d.id, ...d.data() })),
      customers: customersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)),
      products: productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)),
      recipes: recipesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      equivalences: equivSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      packages: packagesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    };
  },

  async markOrderAsDelivered(orderId: string): Promise<void> {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, { status: 'ENTREGADO' });
  },

  async createSaleFromOrder(
    order: Order, 
    itemsToSell: SaleItem[], 
    finalTotal: number, 
    tipoComprobante?: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'PRESUPUESTO' | 'REMITO'
  ): Promise<void> {
    if (order.status !== 'ENTREGADO' && order.status !== 'PRODUCIDO') {
      throw new Error("El pedido debe estar entregado o producido para facturar.");
    }

    // Query all packages in STOCK before transaction
    const packagesSnap = await getDocs(query(COLLECTIONS.PACKAGES, where('status', '==', 'STOCK')));
    const allStockPackages = packagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    await runTransaction(db, async (transaction) => {
      // 1. READ product docs inside transaction (all reads must be first)
      const productDocs: Record<string, { ref: any, data: Product }> = {};
      for (const item of itemsToSell) {
        if (!productDocs[item.productId]) {
          const prodRef = doc(db, 'products', item.productId);
          const prodSnap = await transaction.get(prodRef);
          if (!prodSnap.exists()) {
            throw new Error(`Producto ${item.productId} no encontrado.`);
          }
          productDocs[item.productId] = {
            ref: prodRef,
            data: { id: prodSnap.id, ...prodSnap.data() } as Product
          };
        }
      }

      // 1b. READ settings inside transaction
      const settingsRef = doc(db, 'settings', 'global');
      const settingsSnap = await transaction.get(settingsRef);
      const usePackages = settingsSnap.exists() ? (settingsSnap.data()?.usePackages ?? false) : false;
      const allowNegativeStock = settingsSnap.exists() ? (settingsSnap.data()?.allowNegativeStock ?? true) : true;

      // Create Sale Ref
      const newSaleRef = doc(collection(db, 'sales'));
      const saleId = newSaleRef.id;

      // 2. STOCK DEDUCTION & VALIDATION
      for (const item of itemsToSell) {
        const pData = productDocs[item.productId].data;
        const pRef = productDocs[item.productId].ref;
        
        // Enforce commercial restriction at repository level
        if (pData.type !== 'PRESENTACION') {
          throw new Error(`El producto ${pData.nombre} no es de tipo PRESENTACION. No se pueden vender ni facturar productos de tipo ${pData.type}.`);
        }

        const currentStock = pData.stockActual || 0;
        const stockToDeduct = pData.unitType === 'KG' ? (item.pesoReal || item.cantidad) : item.cantidad;

        if (!allowNegativeStock && stockToDeduct > currentStock) {
          throw new Error(`Venta superior al stock disponible. La cantidad a vender de ${pData.nombre} (${stockToDeduct}) supera el stock disponible (${currentStock}).`);
        }
        if (item.pesoReal === undefined || item.pesoReal <= 0) {
          throw new Error(`La venta de ${pData.nombre} no contiene peso real registrado o es inválido.`);
        }

        if (item.pesoReal !== undefined && item.pesoReal < 0) {
          throw new Error("Los pesos de venta no pueden ser negativos.");
        }
        if (item.subtotal < 0) {
          throw new Error("Los importes de venta no pueden ser negativos.");
        }

        // Deduct finished stock Actual
        const newStock = truncateDecimals(currentStock - stockToDeduct, 3);
        transaction.update(pRef, { stockActual: newStock });

        // Generate VENTA stock movement
        const movRef = doc(collection(db, 'stock_movements'));
        transaction.set(movRef, {
          productId: item.productId,
          qty: -stockToDeduct,
          type: 'VENTA',
          date: new Date().toISOString(),
          referenceId: saleId,
          observaciones: `Venta Comercial: Remito ${saleId.slice(-8).toUpperCase()}`,
          isDeleted: false
        });
      }

      // Update package status to SOLD if usePackages = true
      if (usePackages) {
        const packageDocsToUpdate: any[] = [];
        for (const item of itemsToSell) {
          const prodPkgs = allStockPackages.filter(pkg => pkg.productId === item.productId);
          prodPkgs.sort((a, b) => {
            const aIsOrder = a.orderId === order.id ? 1 : 0;
            const bIsOrder = b.orderId === order.id ? 1 : 0;
            if (aIsOrder !== bIsOrder) return bIsOrder - aIsOrder;

            const aNoOrder = !a.orderId ? 1 : 0;
            const bNoOrder = !b.orderId ? 1 : 0;
            if (aNoOrder !== bNoOrder) return aNoOrder - bNoOrder;

            return new Date(a.producedAt).getTime() - new Date(b.producedAt).getTime();
          });
          const selectedForThisItem = prodPkgs.slice(0, Math.ceil(item.cantidad));
          packageDocsToUpdate.push(...selectedForThisItem);
        }

        packageDocsToUpdate.forEach(pkg => {
          const pkgRef = doc(db, 'packages', pkg.id);
          transaction.update(pkgRef, {
            status: 'SOLD',
            saleId: saleId
          });
        });
      }

      // Construct Sale items with frozen costs (cost fields and margin calculations strictly restricted to PRESENTACION)
      const mappedItems = itemsToSell.map(i => {
        const pData = productDocs[i.productId].data;
        const isPres = pData.type === 'PRESENTACION';
        
        return {
          productId: i.productId,
          cantidad: truncateDecimals(i.cantidad, 3),
          unidad: i.unidad,
          precioUnitario: Number(i.precioUnitario.toFixed(2)),
          subtotal: Number(i.subtotal.toFixed(2)),
          costoUnitario: i.costoUnitario !== undefined ? Number(i.costoUnitario.toFixed(2)) : undefined,
          costoTotal: i.costoTotal !== undefined ? Number(i.costoTotal.toFixed(2)) : undefined,
          rentabilidadBruta: isPres && i.rentabilidadBruta !== undefined ? Number(i.rentabilidadBruta.toFixed(2)) : undefined,
          // Nuevos campos estructurados congelados
          pesoReal: isPres && i.pesoReal !== undefined ? truncateDecimals(i.pesoReal, 3) : undefined,
          precioRealKg: isPres && i.precioRealKg !== undefined ? Number(i.precioRealKg.toFixed(2)) : undefined,
          importeReal: isPres && i.importeReal !== undefined ? Number(i.importeReal.toFixed(2)) : undefined,
          costoUnitarioHistorico: isPres && i.costoUnitarioHistorico !== undefined ? Number(i.costoUnitarioHistorico.toFixed(2)) : undefined,
          costoTotalHistorico: isPres && i.costoTotalHistorico !== undefined ? Number(i.costoTotalHistorico.toFixed(2)) : undefined
        };
      });

      const saleData: Omit<Sale, 'id'> = {
        orderId: order.id,
        customerId: order.customerId,
        date: new Date().toISOString(),
        items: mappedItems,
        totalAmount: Number(finalTotal.toFixed(2)),
        status: 'FACTURADO',
        paymentMethod: 'PENDIENTE',
        isDeleted: false,
        tipoComprobante: tipoComprobante || 'PRESUPUESTO'
      };

      // Sanitise saleData to remove undefined fields that crash Firestore using recursive helper
      const sanitizedSaleData = removeUndefinedFields(saleData);

      transaction.set(newSaleRef, sanitizedSaleData);

      // Update Order Status
      const orderRef = doc(db, 'orders', order.id);
      transaction.update(orderRef, { status: 'FACTURADO' });
    });
  },

  async createQuickSale(data: { customerId: string; date: string; items: SaleItem[]; totalAmount: number; observaciones?: string }): Promise<void> {
    const orderData = {
      customerId: data.customerId,
      fecha: data.date.split('T')[0], // YYYY-MM-DD
      observaciones: data.observaciones || 'Venta rápida (Pedido)',
      status: 'PENDIENTE' as const,
      items: data.items.map(item => ({
        productId: item.productId,
        cantidad: truncateDecimals(item.cantidad, 3),
        unidad: item.unidad,
        precioEstimado: Number(item.precioUnitario.toFixed(2)),
        subtotal: Number(item.subtotal.toFixed(2))
      })),
      totalEstimado: Number(data.totalAmount.toFixed(2)),
      isDeleted: false
    };

    await addDoc(COLLECTIONS.ORDERS, orderData);
  },

  async cobrarSale(sale: Sale, method: 'EFECTIVO_TRANSFERENCIA' | 'CUENTA_CORRIENTE', accountId?: string): Promise<void> {
    if (sale.status !== 'FACTURADO') throw new Error("La venta debe estar FACTURADA para cobrarse.");

    await runTransaction(db, async (transaction) => {
      // Update Sale
      const saleRef = doc(db, 'sales', sale.id);
      transaction.update(saleRef, {
        status: 'COBRADO',
        paymentMethod: method
      });

      if (method === 'CUENTA_CORRIENTE') {
        // Generar deuda en cuenta corriente mediante movimiento
        const movRef = doc(collection(db, 'customer_movements'));
        transaction.set(movRef, {
          customerId: sale.customerId,
          date: new Date().toISOString(),
          type: 'DEUDA',
          amount: sale.totalAmount, // deuda positiva
          referenceId: sale.id,
          observaciones: 'Venta a cuenta corriente',
          isDeleted: false
        });
      } else if (method === 'EFECTIVO_TRANSFERENCIA') {
        // Register Income in Caja
        const cajaMovRef = doc(collection(db, 'caja_movements'));
        transaction.set(cajaMovRef, {
          type: 'INCOME',
          amount: sale.totalAmount,
          date: new Date().toISOString(),
          category: 'VENTA',
          referenceId: sale.id,
          accountId,
          isDeleted: false
        });
      }
    });
  },

  async anularSale(sale: Sale): Promise<void> {
    // Query packages associated with this sale before running transaction
    const packagesSnap = await getDocs(query(COLLECTIONS.PACKAGES, where('saleId', '==', sale.id)));
    const packageDocs = packagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Find original caja movement to get its accountId
    let originalAccountId: string | undefined = undefined;
    if (sale.status === 'COBRADO' && sale.paymentMethod === 'EFECTIVO_TRANSFERENCIA') {
      const cajaSnap = await getDocs(query(
        COLLECTIONS.CAJA_MOVEMENTS,
        where('referenceId', '==', sale.id),
        where('type', '==', 'INCOME'),
        where('category', '==', 'VENTA'),
        where('isDeleted', '==', false)
      ));
      if (!cajaSnap.empty) {
        originalAccountId = (cajaSnap.docs[0].data() as any).accountId;
      }
    }

    await runTransaction(db, async (transaction) => {
      // 1. READ all products in the sale inside transaction (reads first)
      const productDocs: Record<string, { ref: any, data: Product }> = {};
      for (const item of sale.items || []) {
        if (!productDocs[item.productId]) {
          const prodRef = doc(db, 'products', item.productId);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists()) {
            productDocs[item.productId] = {
              ref: prodRef,
              data: { id: prodSnap.id, ...prodSnap.data() } as Product
            };
          }
        }
      }

      // 1b. READ settings
      const settingsRef = doc(db, 'settings', 'global');
      const settingsSnap = await transaction.get(settingsRef);
      const usePackages = settingsSnap.exists() ? (settingsSnap.data()?.usePackages ?? false) : false;

      // 2. WRITES
      // Mark Sale as canceled
      const saleRef = doc(db, 'sales', sale.id);
      transaction.update(saleRef, {
        status: 'ANULADO'
      });

      // Update Order if applicable
      if (sale.orderId) {
        const orderRef = doc(db, 'orders', sale.orderId);
        transaction.update(orderRef, { status: 'ENTREGADO' });
      }

      // Revert finished product stock for ALL items in the sale
      for (const item of sale.items || []) {
        const pDoc = productDocs[item.productId];
        if (pDoc) {
          const currentStock = pDoc.data.stockActual || 0;
          // Deduct quantity restored (using pesoReal if KG, or cantidad in units)
          const stockToRestore = pDoc.data.unitType === 'KG' ? (item.pesoReal || item.cantidad) : item.cantidad;
          
          transaction.update(pDoc.ref, {
            stockActual: truncateDecimals(currentStock + stockToRestore, 3)
          });

          // Register positive AJUSTE movement
          const movRef = doc(collection(db, 'stock_movements'));
          transaction.set(movRef, {
            productId: item.productId,
            qty: stockToRestore,
            type: 'AJUSTE',
            date: new Date().toISOString(),
            referenceId: sale.id,
            observaciones: `Reversión por venta anulada (Remito ${sale.id.slice(-8).toUpperCase()})`,
            isDeleted: false
          });
        }
      }

      // Revert Packages status if usePackages = true
      if (usePackages) {
        packageDocs.forEach(pkg => {
          const pkgRef = doc(db, 'packages', pkg.id);
          transaction.update(pkgRef, {
            status: 'STOCK',
            saleId: null
          });
        });
      }

      // Revert Finances
      if (sale.status === 'COBRADO') {
        if (sale.paymentMethod === 'CUENTA_CORRIENTE') {
          // Reversar deuda en cuenta corriente
          const ccMovRef = doc(collection(db, 'customer_movements'));
          transaction.set(ccMovRef, {
            customerId: sale.customerId,
            date: new Date().toISOString(),
            type: 'AJUSTE',
            amount: -sale.totalAmount, // reversar deuda
            referenceId: sale.id,
            observaciones: 'Anulación de venta a cuenta corriente',
            isDeleted: false
          });
        } else if (sale.paymentMethod === 'EFECTIVO_TRANSFERENCIA') {
          // Reversar ingreso de caja mediante egreso
          const cajaMovRef = doc(collection(db, 'caja_movements'));
          transaction.set(cajaMovRef, {
            type: 'EXPENSE',
            amount: sale.totalAmount,
            date: new Date().toISOString(),
            category: 'ANULACION_VENTA',
            referenceId: sale.id,
            accountId: originalAccountId,
            isDeleted: false
          });
        }
      }
    });
  },

  async deliverHistoricalSale(saleId: string, itemsWithWeights?: { productId: string; pesoReal: number }[]): Promise<void> {
    await runTransaction(db, async (transaction) => {
      const saleRef = doc(db, 'sales', saleId);
      const saleSnap = await transaction.get(saleRef);
      if (!saleSnap.exists()) {
        throw new Error("Venta no encontrada.");
      }
      const sale = { id: saleSnap.id, ...saleSnap.data() } as Sale;
      if (!sale.isHistorical) {
        throw new Error("Solo se puede registrar entrega física diferida para ventas históricas.");
      }
      if (sale.deliveryStatus === 'ENTREGADO') {
        throw new Error("Esta venta ya fue entregada.");
      }

      // Update product stocks & generate stock movements
      for (const item of sale.items || []) {
        const prodRef = doc(db, 'products', item.productId);
        const prodSnap = await transaction.get(prodRef);
        if (!prodSnap.exists()) {
          throw new Error(`Producto ${item.productId} no encontrado.`);
        }
        const prod = prodSnap.data() as Product;
        const currentStock = prod.stockActual || 0;
        
        let weightToDeduct = item.pesoReal || convertQuantityToBaseUnit(item.cantidad, item.unidad, prod);
        if (itemsWithWeights) {
          const provided = itemsWithWeights.find(w => w.productId === item.productId);
          if (provided) {
            weightToDeduct = provided.pesoReal;
          }
        }

        const newStock = truncateDecimals(currentStock - weightToDeduct, 3);
        transaction.update(prodRef, { stockActual: newStock });

        const movRef = doc(collection(db, 'stock_movements'));
        transaction.set(movRef, {
          id: movRef.id,
          productId: item.productId,
          qty: -weightToDeduct,
          type: 'VENTA',
          date: new Date().toISOString(),
          referenceId: saleId,
          observaciones: `Entrega de venta histórica pendiente. Ref: Remito ${saleId.slice(-8).toUpperCase()}`,
          isDeleted: false
        });
      }

      // Mark as delivered
      transaction.update(saleRef, {
        deliveryStatus: 'ENTREGADO'
      });
    });
  },

  async createHistoricalSale(data: {
    customerId: string;
    date: string;
    observaciones: string;
    totalAmount: number;
    costoTotal: number;
    deliveryStatus: 'PENDIENTE' | 'ENTREGADO';
    items: { productId: string; cantidad: number }[];
  }): Promise<void> {
    const saleData = {
      customerId: data.customerId,
      date: new Date(data.date).toISOString(),
      observaciones: data.observaciones,
      totalAmount: Number(data.totalAmount),
      costoTotal: Number(data.costoTotal),
      status: 'FACTURADO' as const,
      paymentMethod: 'PENDIENTE' as const,
      isDeleted: false,
      isHistorical: true,
      deliveryStatus: data.deliveryStatus,
      tipoComprobante: 'REMITO' as const,
      items: data.items.map(it => ({
        productId: it.productId,
        cantidad: truncateDecimals(Number(it.cantidad), 3),
        unidad: 'UNIDADES' as const,
        precioUnitario: 0,
        subtotal: 0
      }))
    };

    await addDoc(COLLECTIONS.SALES, saleData);
  },

  async updateSale(saleId: string, updatedData: Partial<Sale>): Promise<void> {
    const saleRef = doc(db, 'sales', saleId);
    await updateDoc(saleRef, updatedData);
  },

  async deleteSale(sale: Sale): Promise<void> {
    if (sale.status !== 'ANULADO') {
      throw new Error("La venta debe estar ANULADA para poder ser eliminada.");
    }
    const saleRef = doc(db, 'sales', sale.id);
    await updateDoc(saleRef, {
      isDeleted: true,
      deletedAt: Date.now()
    });
  }
};
