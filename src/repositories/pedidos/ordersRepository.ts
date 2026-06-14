import { getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Order, Customer, Product, PriceList } from '../../types/domain';

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
      orders: pedidosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)),
      customers: clientesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)),
      products: productosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)),
      priceLists: listasSnap.docs.map(d => ({ id: d.id, ...d.data() } as PriceList))
    };
  },

  async savePedido(pedido: Partial<Order>): Promise<void> {
    if (pedido.id) {
      await updateDoc(doc(db, 'orders', pedido.id), pedido);
    } else {
      await addDoc(COLLECTIONS.ORDERS, { ...pedido, isDeleted: false });
    }
  },

  async deletePedido(id: string): Promise<void> {
    await updateDoc(doc(db, 'orders', id), { isDeleted: true, deletedAt: Date.now() });
  },

  async changeStatus(id: string, status: Order['status']): Promise<void> {
    await updateDoc(doc(db, 'orders', id), { status });
  }
};
