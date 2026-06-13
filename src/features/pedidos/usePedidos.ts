import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, getDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Order, Customer, Product, PriceList } from '../../types/domain';

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Order[]>([]);
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [listasPrecios, setListasPrecios] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pedidosSnap, clientesSnap, productosSnap, listasSnap] = await Promise.all([
        getDocs(query(COLLECTIONS.ORDERS, where('isDeleted', '==', false))),
        getDocs(query(COLLECTIONS.CUSTOMERS, where('activo', '==', true))),
        getDocs(query(COLLECTIONS.PRODUCTS, where('activo', '==', true))),
        getDocs(query(COLLECTIONS.PRICE_LISTS, where('activo', '==', true)))
      ]);

      setPedidos(pedidosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setClientes(clientesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      setProductos(productosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setListasPrecios(listasSnap.docs.map(d => ({ id: d.id, ...d.data() } as PriceList)));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const savePedido = async (pedido: Partial<Order>) => {
    try {
      if (pedido.id) {
        await updateDoc(doc(db, 'orders', pedido.id), pedido);
      } else {
        await addDoc(COLLECTIONS.ORDERS, { ...pedido, isDeleted: false });
      }
      await fetchData();
    } catch (error) {
      console.error("Error saving pedido:", error);
      throw error;
    }
  };

  const deletePedido = async (id: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), { isDeleted: true, deletedAt: Date.now() });
      await fetchData();
    } catch (error) {
      console.error("Error deleting pedido:", error);
      throw error;
    }
  };

  const changeStatus = async (id: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
      await fetchData();
    } catch (error) {
      console.error("Error changing status:", error);
      throw error;
    }
  };

  // Busca el precio de un producto para un cliente específico
  const getProductPrice = (productId: string, customerId: string): number => {
    // 1. Buscar lista asignada al cliente
    const clientList = listasPrecios.find(l => l.customerId === customerId);
    if (clientList) {
      const item = clientList.items.find(i => i.productId === productId);
      if (item && item.price > 0) return item.price;
    }

    // 2. Buscar en lista general (sin customerId)
    const generalList = listasPrecios.find(l => !l.customerId);
    if (generalList) {
      const item = generalList.items.find(i => i.productId === productId);
      if (item && item.price > 0) return item.price;
    }

    // 3. Fallback al precio sugerido por kg o unidad del producto base
    const product = productos.find(p => p.id === productId);
    if (product) {
      if (product.unitType === 'KG' && product.precioSugerido) return product.precioSugerido;
      if (product.unitType === 'UNIDADES' && product.precioSugerido) return product.precioSugerido;
    }

    return 0; // Sin precio
  };

  return {
    pedidos,
    clientes,
    productos,
    loading,
    savePedido,
    deletePedido,
    changeStatus,
    getProductPrice
  };
}
