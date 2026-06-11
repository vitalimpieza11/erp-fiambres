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
            status: data.status || 'PENDIENTE',
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
    const totalValue = order.total || 0;
    const marginPercent = totalValue > 0 ? ((totalValue - productionCost) / totalValue) * 100 : 0;

    const orderPayload = {
      ...order,
      rawMaterialNeeds,
      productionCost,
      marginPercent,
      updatedAt: Date.now()
    };

    if (id) {
      const existingOrder = orders.find(o => o.id === id);
      if (existingOrder && (existingOrder.status === 'ENTREGADO' || existingOrder.status === 'FACTURADO' || existingOrder.status === 'PRODUCIDO')) {
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

    if (targetOrder.saleId) {
      throw new Error('No se puede eliminar un pedido que ya tiene una venta asociada. Elimine la venta primero.');
    }

    const batch = writeBatch(db);
    const ref = doc(db, 'orders', id);
    batch.delete(ref);

    // 1. Delete production stock movements
    const prodStockSnap = await getDocs(query(collection(db, 'stock_movements'), where('referenceId', '==', id)));
    prodStockSnap.forEach(d => batch.delete(d.ref));

    await batch.commit();
  };

  const updateOrderStatus = async (
    orderId: string,
    newStatus: Order['status'],
    options?: {
      paymentMethod?: string;
      discount?: number;
      shippingCost?: number;
      actualConsumptions?: Record<string, number>;
      actualProduced?: Record<string, number[]>;
    }
  ) => {
    const orderRef = doc(db, 'orders', orderId);
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) throw new Error('Pedido no encontrado.');

    if (newStatus === 'PRODUCIDO') {
      const [presSnap, mercSnap, insSnap, recSnap] = await Promise.all([
        getDocs(collection(db, 'presentaciones')),
        getDocs(collection(db, 'mercaderias')),
        getDocs(collection(db, 'insumos')),
        getDocs(collection(db, 'recipes'))
      ]);

      const presentaciones = presSnap.docs.map(d => DatabaseMapper.toDomainPresentacion(d.data(), d.id));
      const mercaderias = mercSnap.docs.map(d => DatabaseMapper.toDomainMercaderia(d.data(), d.id));
      const insumos = insSnap.docs.map(d => DatabaseMapper.toDomainInsumo(d.data(), d.id));
      const recipes = recSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          productId: data.productId || '',
          productName: data.productName || '',
          customerId: data.customerId,
          customerName: data.customerName,
          ingredients: data.ingredients || [],
          costoManoObra: Number(data.costoManoObra) || 0,
          costoAdicional: Number(data.costoAdicional) || 0,
          method: data.method || 'weight',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        };
      });

      const batch = writeBatch(db);

      targetOrder.items.forEach((item) => {
        const pres = presentaciones.find(p => p.id === item.productId);
        if (!pres) return;

        const consumption = getPresentationConsumption(pres, item.quantity, mercaderias, insumos, recipes);
        consumption.forEach((c) => {
          const stockMovRef = doc(collection(db, 'stock_movements'));
          let finalQty = c.quantity;
          const customKey = `${orderId}_${item.productId}_${c.id}`;
          if (options?.actualConsumptions && options.actualConsumptions[customKey] !== undefined) {
            finalQty = options.actualConsumptions[customKey];
          }

          const isReal = options?.actualConsumptions && options.actualConsumptions[customKey] !== undefined;
          batch.set(stockMovRef, {
            productId: c.id,
            productName: c.name,
            quantity: -Math.abs(finalQty),
            type: 'out',
            referenceType: 'production',
            referenceId: orderId,
            date: Date.now(),
            observations: `Consumo ${c.isInsumo ? 'Insumo' : 'Mercadería'} en Producción Pedido: ${orderId}${isReal ? ' (Ajuste Real)' : ''}`,
            createdAt: Date.now()
          });
        });

        const rawProducedWeights = options?.actualProduced?.[item.productId];
        let weights = rawProducedWeights || [];
        if (weights.length === 0) {
          // Fallback to theoretical packages
          weights = Array(item.quantity).fill(pres.pesoObjetivoGramos / 1000);
        }

        const producedPackageIds: string[] = [];

        weights.forEach((weightKg) => {
          if (weightKg > 0) {
            const pkgRef = doc(collection(db, 'packages'));
            const unitCost = calculatePresentationCost(pres, mercaderias, insumos, recipes);
            const costoKg = pres.pesoObjetivoGramos > 0 ? unitCost / (pres.pesoObjetivoGramos / 1000) : 0;
            
            batch.set(pkgRef, {
              productId: item.productId,
              productName: item.productName,
              productionDate: Date.now(),
              weight: weightKg,
              cost: weightKg * costoKg,
              status: 'Disponible',
              orderId: orderId,
              customerId: targetOrder.customerId,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
            producedPackageIds.push(pkgRef.id);
          }
        });

        // Update the order item with the generated package IDs
        item.producedPackages = producedPackageIds;
      });

      batch.update(orderRef, { 
        status: 'PRODUCIDO', 
        items: targetOrder.items,
        updatedAt: Date.now() 
      });
      await batch.commit();

    } else if (newStatus === 'ENTREGADO') {
      const batch = writeBatch(db);
      
      // Stock movements for the theoretical package delivery is no longer needed since packages hold their own status
      // We will mark them as delivered/sold during FACTURADO or VENTAS.

      batch.update(orderRef, { status: 'ENTREGADO', updatedAt: Date.now() });
      await batch.commit();

    } else if (newStatus === 'FACTURADO') {
      const [presSnap, mercSnap, insSnap, recSnap] = await Promise.all([
        getDocs(collection(db, 'presentaciones')),
        getDocs(collection(db, 'mercaderias')),
        getDocs(collection(db, 'insumos')),
        getDocs(collection(db, 'recipes'))
      ]);

      const presentaciones = presSnap.docs.map(d => DatabaseMapper.toDomainPresentacion(d.data(), d.id));
      const mercaderias = mercSnap.docs.map(d => DatabaseMapper.toDomainMercaderia(d.data(), d.id));
      const insumos = insSnap.docs.map(d => DatabaseMapper.toDomainInsumo(d.data(), d.id));
      const recipes = recSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          productId: data.productId || '',
          productName: data.productName || '',
          customerId: data.customerId,
          customerName: data.customerName,
          ingredients: data.ingredients || [],
          costoManoObra: Number(data.costoManoObra) || 0,
          costoAdicional: Number(data.costoAdicional) || 0,
          method: data.method || 'weight',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        };
      });

      // Fetch packages generated for this order
      const packagesSnap = await getDocs(query(collection(db, 'packages'), where('orderId', '==', targetOrder.id)));
      const orderPackages = packagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const batch = writeBatch(db);
      const saleRef = doc(collection(db, 'sales'));
      const saleId = saleRef.id;

      let realSubtotal = 0;
      let totalCost = 0;

      const saleItems = targetOrder.items.map(item => {
        const pres = presentaciones.find(p => p.id === item.productId);
        const unitCost = pres ? calculatePresentationCost(pres, mercaderias, insumos, recipes) : 0;
        const costoKg = pres && pres.pesoObjetivoGramos > 0 ? unitCost / (pres.pesoObjetivoGramos / 1000) : 0;
        const precioComercialKg = pres?.precioComercialKg || 0;

        // Sum weights from packages
        const itemPackages = orderPackages.filter(pkg => pkg.productId === item.productId);
        const totalWeight = itemPackages.reduce((sum, pkg) => sum + Number(pkg.weight), 0);
        
        // Calculate item amount based on REAL WEIGHT
        const itemAmount = totalWeight * precioComercialKg;
        const itemCost = totalWeight * costoKg;

        realSubtotal += itemAmount;
        totalCost += itemCost;

        // Mark packages as sold
        itemPackages.forEach(pkg => {
          batch.update(doc(db, 'packages', pkg.id), {
            status: 'Vendido',
            saleId: saleId,
            saleDate: Date.now(),
            updatedAt: Date.now()
          });
        });

        return {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity, // Legacy (packages requested/produced)
          pesoRealTotal: totalWeight, // New metric for sale
          price: itemAmount, // Store total item amount instead of unit price? Wait, price in SaleItem is unit price. Since we sell packages of varied weight, we can store total amount in price, and quantity 1, OR store unit price as precioComercialKg and quantity as totalWeight. 
          // Best is to store price = precioComercialKg, quantity = totalWeight.
          // Wait, UI assumes quantity is packages, price is per package. 
          // If we store quantity = packages, we'd need a custom price per package. 
          // Let's store average price or just total in 'cost'/'price'.
          // Let's keep quantity as packages count, and price as Average Price per package.
          cost: itemPackages.length > 0 ? itemCost / itemPackages.length : unitCost
        };
      });

      // Recalculate price per package for the array
      saleItems.forEach(si => {
        const itemPackages = orderPackages.filter(pkg => pkg.productId === si.productId);
        const totalWeight = itemPackages.reduce((sum, pkg) => sum + Number(pkg.weight), 0);
        const pres = presentaciones.find(p => p.id === si.productId);
        const precioComercialKg = pres?.precioComercialKg || 0;
        si.price = itemPackages.length > 0 ? (totalWeight * precioComercialKg) / itemPackages.length : 0;
      });

      const discountAmount = realSubtotal * ((targetOrder.discount || 0) / 100);
      const realTotal = realSubtotal - discountAmount;

      const salePayload = {
        customerId: targetOrder.customerId,
        customerName: targetOrder.customerName,
        items: saleItems,
        subtotal: realSubtotal,
        discount: targetOrder.discount || 0,
        total: realTotal,
        saldoPendiente: realTotal,
        status: 'PENDIENTE',
        paymentMethod: options?.paymentMethod || 'cc',
        remitoNumber: `REM-${Date.now().toString().slice(-6)}`,
        invoiceNumber: `FAC-${Date.now().toString().slice(-6)}`,
        orderId: targetOrder.id,
        observations: targetOrder.observations || '',
        date: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      batch.set(saleRef, { ...salePayload, id: saleId });
      batch.update(orderRef, { 
        status: 'FACTURADO', 
        saleId, 
        total: realTotal, // Update order's definitive total!
        subtotal: realSubtotal,
        productionCost: totalCost,
        marginPercent: realTotal > 0 ? ((realTotal - totalCost) / realTotal) * 100 : 0,
        updatedAt: Date.now() 
      });

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
