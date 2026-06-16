import { getDocs, query, where, doc, updateDoc, runTransaction, collection, orderBy, limit, addDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Sale, Order, Customer, Product, SaleItem } from '../../types/domain';
import { convertQuantityToBaseUnit } from '../../lib/unitConverter';
import { truncateDecimals } from '../../lib/formatters';

export const salesRepository = {
  async fetchSalesData(): Promise<{
    sales: Sale[];
    orders: Order[];
    customers: Customer[];
    products: Product[];
  }> {
    const [salesSnap, ordersSnap, customersSnap, productsSnap] = await Promise.all([
      getDocs(query(COLLECTIONS.SALES, where('isDeleted', '==', false), orderBy('date', 'desc'), limit(50))),
      getDocs(query(COLLECTIONS.ORDERS, where('isDeleted', '==', false), orderBy('fecha', 'desc'), limit(50))),
      getDocs(query(COLLECTIONS.CUSTOMERS, where('activo', '==', true))),
      getDocs(query(COLLECTIONS.PRODUCTS, where('activo', '==', true)))
    ]);

    return {
      sales: salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)),
      orders: ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)),
      customers: customersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)),
      products: productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product))
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

    await runTransaction(db, async (transaction) => {
      // Create Sale
      const newSaleRef = doc(collection(db, 'sales'));
      const saleData: Omit<Sale, 'id'> = {
        orderId: order.id,
        customerId: order.customerId,
        date: new Date().toISOString(),
        items: itemsToSell.map(i => ({
          productId: i.productId,
          cantidad: truncateDecimals(i.cantidad, 3),
          unidad: i.unidad,
          precioUnitario: Number(i.precioUnitario.toFixed(2)),
          subtotal: Number(i.subtotal.toFixed(2))
        })),
        totalAmount: Number(finalTotal.toFixed(2)),
        status: 'FACTURADO',
        paymentMethod: 'PENDIENTE',
        isDeleted: false,
        tipoComprobante: tipoComprobante || 'PRESUPUESTO'
      };
      transaction.set(newSaleRef, saleData);

      // Update Order
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

  async cobrarSale(sale: Sale, method: 'EFECTIVO_TRANSFERENCIA' | 'CUENTA_CORRIENTE'): Promise<void> {
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
          isDeleted: false
        });
      }
    });
  },

  async anularSale(sale: Sale): Promise<void> {
    await runTransaction(db, async (transaction) => {
      // 1. READS first (if quick sale)
      const productDocs: { ref: any, data: Product }[] = [];
      if (!sale.orderId) {
        for (const item of sale.items || []) {
          const prodRef = doc(db, 'products', item.productId);
          const prodDoc = await transaction.get(prodRef);
          if (prodDoc.exists()) {
            productDocs.push({
              ref: prodRef,
              data: { id: prodDoc.id, ...prodDoc.data() } as Product
            });
          }
        }
      }

      // 2. WRITES second
      // Mark Sale as canceled
      const saleRef = doc(db, 'sales', sale.id);
      transaction.update(saleRef, {
        status: 'ANULADO'
      });

      // 1. Compensatory movements for Stock / Order status
      if (sale.orderId) {
        // Revert Order back to ENTREGADO
        const orderRef = doc(db, 'orders', sale.orderId);
        transaction.update(orderRef, { status: 'ENTREGADO' });
      } else {
        // Quick Sale: Revert Stock via compensatory movement
        for (const item of sale.items || []) {
          const pDoc = productDocs.find(x => x.data.id === item.productId);
          if (pDoc) {
            const currentStock = pDoc.data.stockActual || 0;
            const baseQty = convertQuantityToBaseUnit(item.cantidad, item.unidad, pDoc.data);
            transaction.update(pDoc.ref, {
              stockActual: currentStock + baseQty
            });

            // Register positive movement
            const movRef = doc(collection(db, 'stock_movements'));
            transaction.set(movRef, {
              productId: item.productId,
              qty: baseQty,
              type: 'AJUSTE',
              date: new Date().toISOString(),
              referenceId: sale.id,
              observaciones: 'Reversión por venta rápida anulada',
              isDeleted: false
            });
          }
        }
      }

      // 2. Compensatory movements for Finances
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
            isDeleted: false
          });
        }
      }
    });
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
