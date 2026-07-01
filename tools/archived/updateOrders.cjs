const fs = require('fs');

const path = './src/hooks/useOrders.ts';
let code = fs.readFileSync(path, 'utf8');

// Replace default status in onSnapshot mapping
code = code.replace(/status: data\.status \|\| 'pending',/, "status: data.status || 'PENDIENTE',");

// Replace updateOrderStatus signature and logic
const updateMethodStart = code.indexOf('const updateOrderStatus = async (');
const endOfHook = code.lastIndexOf('return { orders');

const newUpdateMethod = `const updateOrderStatus = async (
    orderId: string,
    newStatus: Order['status'],
    options?: {
      paymentMethod?: string;
      discount?: number;
      shippingCost?: number;
      actualConsumptions?: Record<string, number>;
      actualProduced?: Record<string, number>;
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
          const customKey = \`\${orderId}_\${item.productId}_\${c.id}\`;
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
            observations: \`Consumo \${c.isInsumo ? 'Insumo' : 'Mercadería'} en Producción Pedido: \${orderId}\${isReal ? ' (Ajuste Real)' : ''}\`,
            createdAt: Date.now()
          });
        });

        const rawProduced = options?.actualProduced?.[item.productId];
        const producedQty = (rawProduced !== undefined && rawProduced > 0) ? rawProduced : item.quantity;

        if (producedQty > 0) {
          const presMovRef = doc(collection(db, 'stock_movements'));
          const isRealProduced = options?.actualProduced && options.actualProduced[item.productId] !== undefined;
          batch.set(presMovRef, {
            productId: item.productId,
            productName: item.productName,
            quantity: Math.abs(producedQty),
            type: 'in',
            referenceType: 'production',
            referenceId: orderId,
            date: Date.now(),
            observations: \`Producción Pedido: \${orderId} → \${pres.name}\${isRealProduced ? ' (Cant. Real)' : ''}\`,
            createdAt: Date.now()
          });
        }
      });

      batch.update(orderRef, { status: 'PRODUCIDO', updatedAt: Date.now() });
      await batch.commit();

    } else if (newStatus === 'ENTREGADO') {
      const batch = writeBatch(db);
      
      targetOrder.items.forEach((item) => {
        const stockMovRef = doc(collection(db, 'stock_movements'));
        batch.set(stockMovRef, {
          productId: item.productId,
          productName: item.productName,
          quantity: -Math.abs(item.quantity),
          type: 'out',
          referenceType: 'sale',
          referenceId: orderId,
          date: Date.now(),
          observations: \`Entrega de Pedido: \${orderId}\`,
          createdAt: Date.now()
        });
      });

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
        saldoPendiente: targetOrder.total,
        status: 'PENDIENTE',
        paymentMethod: options?.paymentMethod || 'cc',
        remitoNumber: \`REM-\${Date.now().toString().slice(-6)}\`,
        invoiceNumber: \`FAC-\${Date.now().toString().slice(-6)}\`,
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
      batch.update(orderRef, { status: 'FACTURADO', saleId, updatedAt: Date.now() });

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

  `;

const newCode = code.substring(0, updateMethodStart) + newUpdateMethod + code.substring(endOfHook);
fs.writeFileSync(path, newCode, 'utf8');
console.log('Orders hook updated');
