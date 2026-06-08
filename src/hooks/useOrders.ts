import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Order, OrderItem, Recipe, Mercaderia, Insumo, Presentacion } from '../types/database';
import { DatabaseMapper } from '../mappers/databaseMapper';
import { calculatePresentationCost, getPresentationConsumption } from '../core/calculations';

export const useOrders = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            customerId: data.customerId || '',
            customerName: data.customerName || '',
            items: data.items || [],
            subtotal: Number(data.subtotal) || 0,
            discount: Number(data.discount) || 0,
            total: Number(data.total) || 0,
            status: data.status || 'pending',
            observations: data.observaciones || data.observations || '',
            date: data.date || Date.now(),
            createdAt: data.createdAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
            rawMaterialNeeds: data.rawMaterialNeeds || [],
            productionCost: Number(data.productionCost) || 0,
            marginPercent: Number(data.marginPercent) || 0,
            saleId: data.saleId || undefined,
            actualConsumptions: data.actualConsumptions || undefined,
            actualProduced: data.actualProduced || undefined,
          });
        });
        setOrders(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setOrders([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const calculateOrderMetrics = (
    items: OrderItem[],
    customerId: string,
    presentaciones: Presentacion[],
    mercaderias: Mercaderia[],
    insumos: Insumo[],
    recipes: Recipe[]
  ) => {
    let productionCost = 0;
    const needsMap: Record<string, { productId: string; productName: string; quantity: number }> = {};

    items.forEach((item) => {
      const pres = presentaciones.find(p => p.id === item.productId);
      if (!pres) return;

      const unitCost = calculatePresentationCost(pres, mercaderias, insumos, recipes);
      productionCost += unitCost * item.quantity;

      const consumption = getPresentationConsumption(pres, item.quantity, mercaderias, insumos, recipes);
      consumption.forEach((c) => {
        if (!c.isInsumo) {
          if (needsMap[c.id]) {
            needsMap[c.id].quantity += c.quantity;
          } else {
            needsMap[c.id] = {
              productId: c.id,
              productName: c.name,
              quantity: c.quantity
            };
          }
        }
      });
    });

    const rawMaterialNeeds = Object.values(needsMap);

    return {
      rawMaterialNeeds,
      productionCost,
    };
  };

  const saveOrder = async (
    order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'rawMaterialNeeds' | 'productionCost' | 'marginPercent'>,
    legacyRecipes?: Recipe[],
    id?: string
  ) => {
    // Fetch current definitions to calculate metrics
    const [presSnap, mercSnap, insSnap, recSnap] = await Promise.all([
      getDocs(collection(db, 'presentaciones')),
      getDocs(collection(db, 'mercaderias')),
      getDocs(collection(db, 'insumos')),
      getDocs(collection(db, 'recipes'))
    ]);

    const presentaciones: Presentacion[] = [];
    presSnap.forEach(d => presentaciones.push(DatabaseMapper.toDomainPresentacion(d.data(), d.id)));

    const mercaderias: Mercaderia[] = [];
    mercSnap.forEach(d => mercaderias.push(DatabaseMapper.toDomainMercaderia(d.data(), d.id)));

    const insumos: Insumo[] = [];
    insSnap.forEach(d => insumos.push(DatabaseMapper.toDomainInsumo(d.data(), d.id)));

    const recipes: Recipe[] = [];
    recSnap.forEach(d => {
      const data = d.data();
      recipes.push({
        id: d.id,
        productId: data.productId || '',
        productName: data.productName || '',
        customerId: data.customerId || undefined,
        customerName: data.customerName || undefined,
        ingredients: data.ingredients || [],
        costoManoObra: Number(data.costoManoObra) || 0,
        costoAdicional: Number(data.costoAdicional) || 0,
        method: data.method || 'weight',
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now(),
      });
    });

    const { rawMaterialNeeds, productionCost } = calculateOrderMetrics(
      order.items,
      order.customerId,
      presentaciones,
      mercaderias,
      insumos,
      recipes
    );
    const marginPercent = order.total > 0 ? ((order.total - productionCost) / order.total) * 100 : 0;

    const orderPayload = {
      ...order,
      rawMaterialNeeds,
      productionCost,
      marginPercent,
      updatedAt: Date.now()
    };

    if (id) {
      const existingOrder = orders.find(o => o.id === id);
      if (existingOrder && (existingOrder.status === 'delivered' || existingOrder.status === 'invoiced')) {
        throw new Error('Este pedido ya impactó stock. Debe anularse y generarse uno nuevo.');
      }
      const ref = doc(db, 'orders', id);
      await updateDoc(ref, orderPayload as any);
      return id;
    } else {
      const ref = doc(collection(db, 'orders'));
      await setDoc(ref, { ...orderPayload, createdAt: Date.now() } as any);
      return ref.id;
    }
  };

  const deleteOrder = async (id: string) => {
    const targetOrder = orders.find(o => o.id === id);
    if (!targetOrder) throw new Error('Pedido no encontrado');

    // If it has a sale, we must fetch the sale to know if it was CC so we can revert the balance
    let saleData: any = null;
    if (targetOrder.saleId) {
      const saleSnap = await getDocs(query(collection(db, 'sales'), where('__name__', '==', targetOrder.saleId)));
      if (!saleSnap.empty) {
        saleData = saleSnap.docs[0].data();
      }
    }

    const batch = writeBatch(db);
    const ref = doc(db, 'orders', id);
    batch.delete(ref);

    // 1. Delete production stock movements
    const prodStockSnap = await getDocs(query(collection(db, 'stock_movements'), where('referenceId', '==', id)));
    prodStockSnap.forEach(d => batch.delete(d.ref));

    // 2. Revert sale
    if (targetOrder.saleId) {
      const saleId = targetOrder.saleId;
      batch.delete(doc(db, 'sales', saleId));

      const saleStockSnap = await getDocs(query(collection(db, 'stock_movements'), where('referenceId', '==', saleId)));
      saleStockSnap.forEach(d => batch.delete(d.ref));

      const saleCashSnap = await getDocs(query(collection(db, 'cash_movements'), where('referenceId', '==', saleId)));
      saleCashSnap.forEach(d => batch.delete(d.ref));
    }

    await batch.commit();

    // 3. Revert customer balance if sale was CC
    if (saleData && saleData.paymentMethod === 'cc') {
      const customerRef = doc(db, 'customers', targetOrder.customerId);
      await runTransaction(db, async (transaction) => {
        const custSnap = await transaction.get(customerRef);
        if (custSnap.exists()) {
          const currentBalance = custSnap.data().currentBalance || 0;
          transaction.update(customerRef, {
            currentBalance: currentBalance - (saleData.total || 0),
            updatedAt: Date.now()
          });
        }
      }).catch(e => console.error('Error reverting customer balance:', e));
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    newStatus: Order['status'],
    options?: {
      paymentMethod?: string;
      discount?: number;
      shippingCost?: number;
      /**
       * Map of `${orderId}_${presentacionId}_${mercaderiaId}` → qty in Kg (real consumption).
       * If provided for a given key, overrides the theoretical consumption.
       */
      actualConsumptions?: Record<string, number>;
      /**
       * Map of `${presentacionId}` → real units produced.
       * If provided, overrides the theoretical quantity from the order item.
       */
      actualProduced?: Record<string, number>;
    }
  ) => {
    const orderRef = doc(db, 'orders', orderId);

    // ── DELIVERED: Producción como transformación de stock ──────────────────
    // A) Descuenta mercaderías (kg) e insumos (u) consumidos en producción
    // B) Incrementa presentaciones (u) producidas (stock de producto terminado)
    // REGLA: Ventas NO tocan mercaderías. Solo presentaciones.
    if (newStatus === 'delivered') {
      const targetOrder = orders.find(o => o.id === orderId);
      if (!targetOrder) throw new Error('Pedido no encontrado.');

      const [presSnap, mercSnap, insSnap, recSnap] = await Promise.all([
        getDocs(collection(db, 'presentaciones')),
        getDocs(collection(db, 'mercaderias')),
        getDocs(collection(db, 'insumos')),
        getDocs(collection(db, 'recipes'))
      ]);

      const presentaciones: Presentacion[] = [];
      presSnap.forEach(d => presentaciones.push(DatabaseMapper.toDomainPresentacion(d.data(), d.id)));

      const mercaderias: Mercaderia[] = [];
      mercSnap.forEach(d => mercaderias.push(DatabaseMapper.toDomainMercaderia(d.data(), d.id)));

      const insumos: Insumo[] = [];
      insSnap.forEach(d => insumos.push(DatabaseMapper.toDomainInsumo(d.data(), d.id)));

      const recipes: Recipe[] = [];
      recSnap.forEach(d => {
        const data = d.data();
        recipes.push({
          id: d.id,
          productId: data.productId || '',
          productName: data.productName || '',
          customerId: data.customerId || undefined,
          customerName: data.customerName || undefined,
          ingredients: data.ingredients || [],
          costoManoObra: Number(data.costoManoObra) || 0,
          costoAdicional: Number(data.costoAdicional) || 0,
          method: data.method || 'weight',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        });
      });

      const batch = writeBatch(db);

      // ── A) Descontar mercaderías e insumos (PRODUCCIÓN → CONSUMO) ──────────
      targetOrder.items.forEach((item) => {
        const pres = presentaciones.find(p => p.id === item.productId);
        if (!pres) return;

        const consumption = getPresentationConsumption(pres, item.quantity, mercaderias, insumos, recipes);
        consumption.forEach((c) => {
          const stockMovRef = doc(collection(db, 'stock_movements'));

          let finalQty = c.quantity;
          // Apply real (operator-adjusted) consumption if provided
          const customKey = `${orderId}_${item.productId}_${c.id}`;
          if (options?.actualConsumptions && options.actualConsumptions[customKey] !== undefined) {
            finalQty = options.actualConsumptions[customKey];
          }

          const isReal = options?.actualConsumptions && options.actualConsumptions[customKey] !== undefined;
          const movement = {
            productId: c.id,
            productName: c.name,
            quantity: -Math.abs(finalQty),
            type: 'out',
            referenceType: 'production',
            referenceId: orderId,
            date: Date.now(),
            observations: `Consumo ${c.isInsumo ? 'Insumo' : 'Mercadería'} en Producción Pedido: ${orderId}${isReal ? ' (Ajuste Real)' : ''}`,
            createdAt: Date.now()
          };
          batch.set(stockMovRef, movement);
        });
      });

      // ── B) Incrementar presentaciones (PRODUCCIÓN → STOCK TERMINADO) ───────
      // El stock de presentaciones se genera aquí, no en ventas.
      targetOrder.items.forEach((item) => {
        const pres = presentaciones.find(p => p.id === item.productId);
        if (!pres) return;

        // Use real produced qty if provided and > 0, otherwise theoretical order quantity
        const rawProduced = options?.actualProduced?.[item.productId];
        const producedQty = (rawProduced !== undefined && rawProduced > 0) ? rawProduced : item.quantity;

        if (producedQty <= 0) return;

        const presMovRef = doc(collection(db, 'stock_movements'));
        const isRealProduced = options?.actualProduced && options.actualProduced[item.productId] !== undefined;
        const presMovement = {
          productId: item.productId,
          productName: item.productName,
          quantity: Math.abs(producedQty),
          type: 'in',
          referenceType: 'production',
          referenceId: orderId,
          date: Date.now(),
          observations: `Producción Pedido: ${orderId} → ${pres.name}${isRealProduced ? ' (Cant. Real)' : ''}`,
          createdAt: Date.now()
        };
        batch.set(presMovRef, presMovement);
      });

      batch.update(orderRef, { status: 'delivered', updatedAt: Date.now() });
      await batch.commit();

    // ── INVOICED: Crea venta que consume SOLO presentaciones ────────────────
    // REGLA: La venta descuenta únicamente el stock de presentaciones (producto terminado).
    // Las mercaderías ya fueron descontadas en la etapa de producción (delivered).
    } else if (newStatus === 'invoiced') {
      const targetOrder = orders.find(o => o.id === orderId);
      if (!targetOrder) throw new Error('Pedido no encontrado.');

      // Fetch presentaciones for cost calculation
      const [presSnap, mercSnap, insSnap, recSnap] = await Promise.all([
        getDocs(collection(db, 'presentaciones')),
        getDocs(collection(db, 'mercaderias')),
        getDocs(collection(db, 'insumos')),
        getDocs(collection(db, 'recipes'))
      ]);

      const presentaciones: Presentacion[] = [];
      presSnap.forEach(d => presentaciones.push(DatabaseMapper.toDomainPresentacion(d.data(), d.id)));
      const mercaderias: Mercaderia[] = [];
      mercSnap.forEach(d => mercaderias.push(DatabaseMapper.toDomainMercaderia(d.data(), d.id)));
      const insumos: Insumo[] = [];
      insSnap.forEach(d => insumos.push(DatabaseMapper.toDomainInsumo(d.data(), d.id)));
      const recipes: Recipe[] = [];
      recSnap.forEach(d => {
        const data = d.data();
        recipes.push({
          id: d.id,
          productId: data.productId || '',
          productName: data.productName || '',
          customerId: data.customerId || undefined,
          customerName: data.customerName || undefined,
          ingredients: data.ingredients || [],
          costoManoObra: Number(data.costoManoObra) || 0,
          costoAdicional: Number(data.costoAdicional) || 0,
          method: data.method || 'weight',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        });
      });

      const salePayload = {
        customerId: targetOrder.customerId,
        customerName: targetOrder.customerName,
        items: targetOrder.items.map(item => {
          const pres = presentaciones.find(p => p.id === item.productId);
          const unitCost = pres ? calculatePresentationCost(pres, mercaderias, insumos, recipes) : 0;
          return {
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            cost: unitCost
          };
        }),
        subtotal: targetOrder.subtotal,
        discount: targetOrder.discount,
        total: targetOrder.total,
        status: 'completed' as const,
        paymentStatus: (options?.paymentMethod || 'cc') === 'cc' ? 'pending' as const : 'paid' as const,
        paymentMethod: options?.paymentMethod || 'cc',
        remitoNumber: `REM-${Date.now().toString().slice(-6)}`,
        orderId: targetOrder.id,
        observations: targetOrder.observations || '',
        date: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const batch = writeBatch(db);
      const saleRef = doc(collection(db, 'sales'));
      const saleId = saleRef.id;

      batch.set(saleRef, { ...salePayload, id: saleId });
      batch.update(orderRef, { status: 'invoiced', saleId, updatedAt: Date.now() });

      // ── Descontar stock de PRESENTACIONES (no mercaderías) ─────────────────
      // Esta es la única operación de stock en ventas: consumir producto terminado.
      targetOrder.items.forEach((item) => {
        const stockMovRef = doc(collection(db, 'stock_movements'));
        const movement = {
          productId: item.productId,          // ID de la presentación (producto terminado)
          productName: item.productName,
          quantity: -Math.abs(item.quantity),
          type: 'out',
          referenceType: 'sale',
          referenceId: saleId,
          date: Date.now(),
          observations: `Venta Pedido: ${orderId} → ${salePayload.remitoNumber}`,
          createdAt: Date.now()
        };
        batch.set(stockMovRef, movement);
      });

      // Cash movement if paid immediately
      if (salePayload.paymentStatus === 'paid') {
        const cashMovRef = doc(collection(db, 'cash_movements'));
        const cashMovement = {
          type: 'in',
          amount: targetOrder.total,
          method: options?.paymentMethod || 'cash',
          description: `Cobro Venta desde Pedido ${targetOrder.customerName} (Ref: ${salePayload.remitoNumber})`,
          category: 'sale',
          referenceId: saleId,
          date: Date.now(),
          createdAt: Date.now()
        };
        batch.set(cashMovRef, cashMovement);
      }

      await batch.commit();

      if (salePayload.paymentMethod === 'cc') {
        const customerRef = doc(db, 'customers', targetOrder.customerId);
        await runTransaction(db, async (transaction) => {
          const custSnap = await transaction.get(customerRef);
          if (custSnap.exists()) {
            const currentBalance = custSnap.data().currentBalance || 0;
            transaction.update(customerRef, {
              currentBalance: currentBalance + targetOrder.total,
              updatedAt: Date.now()
            });
          }
        }).catch(e => console.error('Error al actualizar saldo de cliente:', e));
      }
    } else {
      await updateDoc(orderRef, { status: newStatus, updatedAt: Date.now() });
    }
  };

  return { orders, loading, error, saveOrder, deleteOrder, updateOrderStatus };
};

export default useOrders;
