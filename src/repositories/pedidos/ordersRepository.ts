import { getDocs, getDoc, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Order, Customer, Product, PriceList } from '../../types/domain';

export function normalizeOrder(order: any): Order {
  if (!order) return order;
  const norm = {
    ...order,
    totalEstimado: Number(order.totalEstimado || 0),
    items: (order.items || []).map((item: any) => ({
      ...item,
      cantidad: Number(item.cantidad || 0),
      precioEstimado: Number(item.precioEstimado || 0),
      subtotal: Number(item.subtotal || 0),
      pesoReal: item.pesoReal !== undefined ? (Number(item.pesoReal) || 0) : undefined,
      pesosReales: item.pesosReales ? item.pesosReales.map((w: any) => Number(w) || 0) : undefined,
      cantidadPaquetes: item.cantidadPaquetes !== undefined ? (Number(item.cantidadPaquetes) || 0) : undefined,
      pesoTotal: item.pesoTotal !== undefined ? (Number(item.pesoTotal) || 0) : undefined,
      pesoPromedio: item.pesoPromedio !== undefined ? (Number(item.pesoPromedio) || 0) : undefined
    }))
  };
  
  if (norm.status === 'PRODUCIDO' || norm.status === 'EN_PRODUCCION') {
    norm.items.forEach((it: any) => console.log('ORDEN_LEIDA', { productId: it.productId, pesoReal: it.pesoReal, pesosReales: it.pesosReales }));
  }

  return norm as Order;
}

export const ordersRepository = {
  async fetchOrdersData(): Promise<{
    orders: Order[];
    customers: Customer[];
    products: Product[];
    priceLists: PriceList[];
  }> {
    const [pedidosSnap, clientesSnap, productosSnap, listasSnap] = await Promise.all([
      getDocs(query(COLLECTIONS.ORDERS, where('isDeleted', '==', false))),
      getDocs(query(COLLECTIONS.CUSTOMERS, where('activo', '==', true))),
      getDocs(query(COLLECTIONS.PRODUCTS, where('activo', '==', true))),
      getDocs(query(COLLECTIONS.PRICE_LISTS, where('activo', '==', true)))
    ]);

    return {
      orders: pedidosSnap.docs.map(d => normalizeOrder({ id: d.id, ...d.data() })),
      customers: clientesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)),
      products: productosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)),
      priceLists: listasSnap.docs.map(d => ({ id: d.id, ...d.data() } as PriceList))
    };
  },

  async savePedido(pedido: Partial<Order>): Promise<void> {
    if (pedido.items) {
      for (const item of pedido.items) {
        const prodRef = doc(db, 'products', item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data() as Product;
          if (prodData.type !== 'PRESENTACION') {
            throw new Error(`El producto ${prodData.nombre} no es de tipo PRESENTACION. No se pueden agregar productos de tipo ${prodData.type} a un pedido.`);
          }
        }
      }
    }

    const sanitizedPedido = {
      ...pedido,
      totalEstimado: Number(pedido.totalEstimado || 0),
      items: (pedido.items || []).map(item => ({
        ...item,
        cantidad: Number(item.cantidad) || 0,
        precioEstimado: Number(item.precioEstimado) || 0,
        subtotal: Number(item.subtotal) || 0,
        pesoReal: item.pesoReal !== undefined ? Number(item.pesoReal) || 0 : undefined,
        pesosReales: item.pesosReales ? item.pesosReales.map(w => Number(w) || 0) : undefined,
        cantidadPaquetes: item.cantidadPaquetes !== undefined ? Number(item.cantidadPaquetes) || 0 : undefined,
        pesoTotal: item.pesoTotal !== undefined ? Number(item.pesoTotal) || 0 : undefined,
        pesoPromedio: item.pesoPromedio !== undefined ? Number(item.pesoPromedio) || 0 : undefined
      }))
    };

    if (pedido.id) {
      await updateDoc(doc(db, 'orders', pedido.id), sanitizedPedido);
    } else {
      await addDoc(COLLECTIONS.ORDERS, { ...sanitizedPedido, isDeleted: false });
    }
  },

  async deletePedido(id: string): Promise<void> {
    await updateDoc(doc(db, 'orders', id), { isDeleted: true, deletedAt: Date.now() });
  },

  async changeStatus(id: string, status: Order['status']): Promise<void> {
    await updateDoc(doc(db, 'orders', id), { status });
  }
};
