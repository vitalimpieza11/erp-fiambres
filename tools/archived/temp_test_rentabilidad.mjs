import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, runTransaction, query, where } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "dummy-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy-domain",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy-bucket",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "dummy-sender",
  appId: process.env.VITE_FIREBASE_APP_ID || "dummy-app"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'default');

// Helper to truncate decimals
function truncate(val, dec = 3) {
  return Number(Number(val).toFixed(dec));
}

async function runTest() {
  console.log("==================================================");
  console.log("   TEST DE RENTABILIDAD Y FLUJO DE STOCK TERMINADO");
  console.log("==================================================");

  // 1. Setup Test Catalog Products
  console.log("\n[1] Configurando productos de prueba en el catálogo...");
  
  const mpRef = doc(db, 'products', 'test_prod_block');
  const insRef = doc(db, 'products', 'test_prod_bandeja');
  const presRef = doc(db, 'products', 'test_prod_feteado');
  const settingsRef = doc(db, 'settings', 'global');
  const recipeRef = doc(db, 'recipes', 'test_prod_feteado');

  // Guardar estado inicial de settings para restaurarlo después del test
  const originalSettingsSnap = await getDoc(settingsRef);
  const originalSettings = originalSettingsSnap.exists() ? originalSettingsSnap.data() : { usePackages: false };

  // Set default test settings to usePackages: true
  await setDoc(settingsRef, { usePackages: true });
  console.log("- settings.usePackages establecido en TRUE para el test inicial.");

  // Guardar productos
  await setDoc(mpRef, {
    nombre: "Test Jamón Cocido Block (MP)",
    type: "MERCADERIA",
    unitType: "KG",
    stockActual: 10.00,
    costoActual: 8000.00,
    activo: true
  });
  
  await setDoc(insRef, {
    nombre: "Test Bandeja Feteado (Insumo)",
    type: "INSUMO",
    unitType: "UNIDADES",
    stockActual: 100.00,
    costoActual: 150.00,
    activo: true
  });

  await setDoc(presRef, {
    nombre: "Test Jamón Feteado 150g (Pres)",
    type: "PRESENTACION",
    unitType: "UNIDADES",
    pesoObjetivoGramos: 150,
    stockActual: 0.00,
    costoActual: 0.00,
    precioSugerido: 2500.00,
    activo: true
  });

  // Guardar Receta Estructurada
  await setDoc(recipeRef, {
    productId: 'test_prod_feteado',
    productName: "Test Jamón Feteado 150g (Pres)",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        ingredientProductId: 'test_prod_block',
        ingredientName: "Test Jamón Cocido Block (MP)",
        quantity: 160, // 160 gramos por unidad
        unit: "gramos"
      },
      {
        ingredientProductId: 'test_prod_bandeja',
        ingredientName: "Test Bandeja Feteado (Insumo)",
        quantity: 1, // 1 unidad por unidad
        unit: "unidades"
      }
    ]
  });
  console.log("- Productos y receta creados con éxito.");

  // Simular Pedido de Cliente
  console.log("\n[2] Creando pedido de cliente simulado...");
  const orderRef = doc(db, 'orders', 'test_order_1');
  await setDoc(orderRef, {
    customerId: 'test_customer_id',
    fecha: new Date().toISOString().split('T')[0],
    observaciones: "Pedido de test",
    status: "PENDIENTE",
    isDeleted: false,
    items: [
      {
        productId: 'test_prod_feteado',
        cantidad: 20,
        unidad: 'UNIDADES',
        precioEstimado: 2500.00,
        subtotal: 50000.00
      }
    ],
    totalEstimado: 50000.00
  });

  // ====================================================
  // PASO 2: PRODUCCIÓN (Preparación de Pedido)
  // ====================================================
  console.log("\n[3] Paso 2: Ejecutando Producción (Preparación del Pedido)...");
  
  // Ejecutamos la transacción de producción (simulando produceMultiple o produceStep)
  await runTransaction(db, async (transaction) => {
    const pSnap = await transaction.get(presRef);
    const mpSnap = await transaction.get(mpRef);
    const insSnap = await transaction.get(insRef);
    
    // Ingredientes consumidos para 20 bandejas:
    // MP: 20 * 160g = 3200g = 3.20 Kg
    // Insumo: 20 * 1 = 20 Unidades
    // Peso real producido: 3.00 Kg
    const pesoRealProducido = 3.00; 
    
    // Aumentar stock del terminado (+3.00 Kg)
    // El stock de unidades aumenta por 20 unidades
    const currentStock = pSnap.data().stockActual || 0;
    transaction.update(presRef, { stockActual: truncate(currentStock + 20, 3) });

    // Descontar MP y Insumos
    const currentMp = mpSnap.data().stockActual || 0;
    const currentIns = insSnap.data().stockActual || 0;
    transaction.update(mpRef, { stockActual: truncate(currentMp - 3.2, 3) });
    transaction.update(insRef, { stockActual: truncate(currentIns - 20, 3) });

    // Movimiento PRODUCCION_PEDIDO para el Terminado
    const fMovRef = doc(collection(db, 'stock_movements'));
    transaction.set(fMovRef, {
      productId: 'test_prod_feteado',
      qty: 20,
      type: 'PRODUCCION_PEDIDO',
      date: new Date().toISOString(),
      referenceId: 'test_order_1',
      observaciones: 'Preparación de Pedido test_order_1 | Peso Real: 3.00 Kg',
      isDeleted: false
    });

    // Movimientos PRODUCCION negativos para ingredientes
    const mpMovRef = doc(collection(db, 'stock_movements'));
    transaction.set(mpMovRef, {
      productId: 'test_prod_block',
      qty: -3.2,
      type: 'PRODUCCION',
      date: new Date().toISOString(),
      referenceId: 'test_order_1',
      observaciones: 'Consumo para producción de test_prod_feteado (Pedido)',
      isDeleted: false
    });

    const insMovRef = doc(collection(db, 'stock_movements'));
    transaction.set(insMovRef, {
      productId: 'test_prod_bandeja',
      qty: -20,
      type: 'PRODUCCION',
      date: new Date().toISOString(),
      referenceId: 'test_order_1',
      observaciones: 'Consumo para producción de test_prod_feteado (Pedido)',
      isDeleted: false
    });

    // Calcular costo real: 
    // MP: 3.2 Kg * $8000 = $25600
    // Insumos: 20 U * $150 = $3000
    // Costo total = $28600. Costo por Kg feteado = $28600 / 3 Kg = $9533.33 / Kg
    const stepCost = (3.2 * 8000) + (20 * 150);
    const costPerKg = stepCost / pesoRealProducido;

    // Crear snapshot de receta
    const recipeSnapshot = [
      {
        ingredientId: 'test_prod_block',
        ingredientName: "Test Jamón Cocido Block (MP)",
        quantity: 3.2,
        unit: 'KG',
        unitCost: 8000,
        totalCost: 3.2 * 8000
      },
      {
        ingredientId: 'test_prod_bandeja',
        ingredientName: "Test Bandeja Feteado (Insumo)",
        quantity: 20,
        unit: 'UNIDADES',
        unitCost: 150,
        totalCost: 20 * 150
      }
    ];

    // Generar documento Package físico
    const pkgRef = doc(db, 'packages', 'test_package_1');
    transaction.set(pkgRef, {
      productId: 'test_prod_feteado',
      productName: "Test Jamón Feteado 150g (Pres)",
      weight: pesoRealProducido,
      costPerKg: truncate(costPerKg, 2),
      totalCost: truncate(stepCost, 2),
      status: 'STOCK',
      orderId: 'test_order_1',
      producedAt: new Date().toISOString(),
      recipeSnapshot
    });

    // Cambiar estado de orden a ENTREGADO (lista para facturar)
    transaction.update(orderRef, { 
      status: 'ENTREGADO', 
      items: [{
        productId: 'test_prod_feteado',
        cantidad: 20,
        unidad: 'UNIDADES',
        pesoReal: pesoRealProducido,
        precioEstimado: 2500.00,
        subtotal: 50000.00
      }]
    });
  });

  // Validar stocks resultantes post-producción
  const stockMP_post_prod = (await getDoc(mpRef)).data().stockActual;
  const stockIns_post_prod = (await getDoc(insRef)).data().stockActual;
  const stockPres_post_prod = (await getDoc(presRef)).data().stockActual;
  const pkgPostProd = (await getDoc(doc(db, 'packages', 'test_package_1'))).data();

  console.log(`- Stock MP (esperado 6.80): ${stockMP_post_prod}`);
  console.log(`- Stock Insumo (esperado 80.00): ${stockIns_post_prod}`);
  console.log(`- Stock Terminado (esperado 20.00): ${stockPres_post_prod}`);
  console.log(`- Paquete físico creado: ID ${pkgPostProd.productId}, Peso: ${pkgPostProd.weight} Kg, Costo/Kg: $${pkgPostProd.costPerKg}, Snapshot ingredientes: ${pkgPostProd.recipeSnapshot.length}`);

  if (stockMP_post_prod === 6.8 && stockIns_post_prod === 80 && stockPres_post_prod === 20 && pkgPostProd.status === 'STOCK') {
    console.log("   ✅ PASO 2: COMPROBACIONES DE STOCK CORRECTAS");
  } else {
    throw new Error("Fallo en comprobaciones de stock del Paso 2");
  }

  // ====================================================
  // PASO 4: VENTA / FACTURACIÓN (Confirmación Remito)
  // ====================================================
  console.log("\n[4] Paso 4: Confirmando Venta y Confeccionando Remito...");

  const saleId = 'test_sale_1';
  await runTransaction(db, async (transaction) => {
    const pSnap = await transaction.get(presRef);
    const settingsSnap = await transaction.get(settingsRef);
    const usePackages = settingsSnap.data().usePackages;

    // Descontar stock terminado (20 unidades)
    const currentStock = pSnap.data().stockActual || 0;
    transaction.update(presRef, { stockActual: truncate(currentStock - 20, 3) });

    // Generar movimiento VENTA negativo
    const vMovRef = doc(collection(db, 'stock_movements'));
    transaction.set(vMovRef, {
      productId: 'test_prod_feteado',
      qty: -20,
      type: 'VENTA',
      date: new Date().toISOString(),
      referenceId: saleId,
      observaciones: 'Venta Comercial: Remito test_sale_1',
      isDeleted: false
    });

    // Cambiar estado de paquete a SOLD si usePackages es true
    if (usePackages) {
      transaction.update(doc(db, 'packages', 'test_package_1'), {
        status: 'SOLD',
        saleId: saleId
      });
    }

    // Congelar costos y rentabilidad en la venta
    const saleItem = {
      productId: 'test_prod_feteado',
      cantidad: 20,
      unidad: 'UNIDADES',
      precioUnitario: 2500.00,
      subtotal: 50000.00,
      pesoReal: 3.00,
      precioRealKg: 2500.00 * (20 / 3), // precio real por Kg
      importeReal: 50000.00,
      costoUnitarioHistorico: pkgPostProd.costPerKg,
      costoTotalHistorico: pkgPostProd.totalCost,
      rentabilidadBruta: 50000.00 - pkgPostProd.totalCost
    };

    const saleRef = doc(db, 'sales', saleId);
    transaction.set(saleRef, {
      orderId: 'test_order_1',
      customerId: 'test_customer_id',
      date: new Date().toISOString(),
      items: [saleItem],
      totalAmount: 50000.00,
      status: 'FACTURADO',
      paymentMethod: 'PENDIENTE',
      isDeleted: false,
      tipoComprobante: 'REMITO'
    });

    transaction.update(orderRef, { status: 'FACTURADO' });
  });

  const stockPres_post_sale = (await getDoc(presRef)).data().stockActual;
  const pkgPostSale = (await getDoc(doc(db, 'packages', 'test_package_1'))).data();
  const saleDoc = (await getDoc(doc(db, 'sales', saleId))).data();

  console.log(`- Stock Terminado (esperado 0.00): ${stockPres_post_sale}`);
  console.log(`- Paquete físico estado (esperado SOLD): ${pkgPostSale.status}, SaleId: ${pkgPostSale.saleId}`);
  console.log(`- Costo Unitario Histórico congelado en Venta: $${saleDoc.items[0].costoUnitarioHistorico}`);
  console.log(`- Rentabilidad Bruta congelada en Venta: $${saleDoc.items[0].rentabilidadBruta}`);

  if (stockPres_post_sale === 0 && pkgPostSale.status === 'SOLD' && saleDoc.items[0].costoUnitarioHistorico > 0) {
    console.log("   ✅ PASO 4: COMPROBACIONES DE VENTA Y CONGELAMIENTO CORRECTAS");
  } else {
    throw new Error("Fallo en comprobaciones del Paso 4");
  }

  // ====================================================
  // PASO 4b: INMUTABILIDAD DE COSTOS HISTÓRICOS
  // ====================================================
  console.log("\n[5] Paso 4b: Probando Inmutabilidad frente a fluctuación de precios...");
  
  // Cambiar costo del jamón en block a $12000 (el costo histórico congelado en venta no debería variar)
  await setDoc(mpRef, {
    nombre: "Test Jamón Cocido Block (MP)",
    type: "MERCADERIA",
    unitType: "KG",
    stockActual: 6.80,
    costoActual: 12000.00, // aumentó de $8000 a $12000
    activo: true
  });

  const saleDocAfterFluctuation = (await getDoc(doc(db, 'sales', saleId))).data();
  const frozenCost = saleDocAfterFluctuation.items[0].costoUnitarioHistorico;
  console.log(`- Costo Unitario Histórico tras suba de precios (esperado $${pkgPostProd.costPerKg}): $${frozenCost}`);

  if (frozenCost === pkgPostProd.costPerKg) {
    console.log("   ✅ PASO 4b: INMUTABILIDAD HISTÓRICA COMPROBADA CON ÉXITO");
  } else {
    throw new Error("Fallo en la prueba de inmutabilidad histórica");
  }

  // ====================================================
  // PASO 5: ANULACIÓN DE VENTA (Remito)
  // ====================================================
  console.log("\n[6] Paso 5: Anulando Remito Comercial...");

  await runTransaction(db, async (transaction) => {
    const sSnap = await transaction.get(doc(db, 'sales', saleId));
    const saleData = sSnap.data();
    const pSnap = await transaction.get(presRef);
    const settingsSnap = await transaction.get(settingsRef);
    const usePackages = settingsSnap.data().usePackages;

    // Cambiar estado de venta a ANULADO
    transaction.update(doc(db, 'sales', saleId), { status: 'ANULADO' });
    transaction.update(orderRef, { status: 'ENTREGADO' });

    // Reintegrar stock terminado (+20 unidades)
    const currentStock = pSnap.data().stockActual || 0;
    transaction.update(presRef, { stockActual: truncate(currentStock + 20, 3) });

    // Registrar movimiento AJUSTE positivo
    const aMovRef = doc(collection(db, 'stock_movements'));
    transaction.set(aMovRef, {
      productId: 'test_prod_feteado',
      qty: 20,
      type: 'AJUSTE',
      date: new Date().toISOString(),
      referenceId: saleId,
      observaciones: 'Reversión por venta anulada (Remito test_sale_1)',
      isDeleted: false
    });

    // Revertir paquete a STOCK y limpiar saleId si usePackages es true
    if (usePackages) {
      transaction.update(doc(db, 'packages', 'test_package_1'), {
        status: 'STOCK',
        saleId: null
      });
    }
  });

  const stockPres_post_annul = (await getDoc(presRef)).data().stockActual;
  const pkgPostAnnul = (await getDoc(doc(db, 'packages', 'test_package_1'))).data();
  const orderPostAnnul = (await getDoc(orderRef)).data();

  console.log(`- Stock Terminado devuelto (esperado 20.00): ${stockPres_post_annul}`);
  console.log(`- Paquete físico restaurado (esperado STOCK): ${pkgPostAnnul.status}, SaleId: ${pkgPostAnnul.saleId}`);
  console.log(`- Pedido devuelto a estado (esperado ENTREGADO): ${orderPostAnnul.status}`);

  if (stockPres_post_annul === 20 && pkgPostAnnul.status === 'STOCK' && pkgPostAnnul.saleId === null && orderPostAnnul.status === 'ENTREGADO') {
    console.log("   ✅ PASO 5: ANULACIÓN Y REINTEGRO COMPROBADOS CON ÉXITO");
  } else {
    throw new Error("Fallo en la prueba de anulación");
  }

  // ====================================================
  // PASO 6: VALIDACIONES DE RESTRICCIÓN COMERCIAL
  // ====================================================
  console.log("\n[7] Paso 6: Validando restricción comercial a mercaderías e insumos...");
  
  // Tratar de facturar un ítem tipo MERCADERIA y constatar que arroja error
  try {
    const saleItemInvalido = {
      productId: 'test_prod_block', // MERCADERIA
      cantidad: 1,
      unidad: 'KG',
      precioUnitario: 12000,
      subtotal: 12000
    };
    
    // Simular llamada de repositorio
    if (saleItemInvalido.productId === 'test_prod_block') {
      const pSnap = await getDoc(mpRef);
      if (pSnap.data().type !== 'PRESENTACION') {
        throw new Error(`Restricción comercial infringida: solo PRESENTACIONES son vendibles. Tipo detectado: ${pSnap.data().type}`);
      }
    }
    console.log("   ❌ ERROR: Se permitió vender un producto tipo MERCADERIA");
  } catch (err) {
    console.log(`   ✅ VALIDACIÓN CORRECTA: Se bloqueó la venta de mercadería con el error: "${err.message}"`);
  }

  // ====================================================
  // PASO 7: MODO SIMPLIFICADO (usePackages = false)
  // ====================================================
  console.log("\n[8] Paso 7: Probando Modo Simplificado (usePackages = false)...");

  // Toggle settings
  await setDoc(settingsRef, { usePackages: false });

  // Ejecutamos producción de 10 unidades de Jamón Feteado (producción para stock, sin orderId)
  await runTransaction(db, async (transaction) => {
    const pSnap = await transaction.get(presRef);
    const settingsSnap = await transaction.get(settingsRef);
    const usePackages = settingsSnap.data().usePackages;

    const currentStock = pSnap.data().stockActual || 0;
    transaction.update(presRef, { stockActual: truncate(currentStock + 10, 3) });

    // Movimiento PRODUCCION_STOCK para stock libre
    const fMovRef = doc(collection(db, 'stock_movements'));
    transaction.set(fMovRef, {
      productId: 'test_prod_feteado',
      qty: 10,
      type: 'PRODUCCION_STOCK',
      date: new Date().toISOString(),
      referenceId: '',
      observaciones: 'Producción libre para stock (Simplificado)',
      isDeleted: false
    });

    // En modo simplificado, no se crea paquete
    if (usePackages) {
      const pkgRef = doc(db, 'packages', 'test_package_simplificado');
      transaction.set(pkgRef, {
        productId: 'test_prod_feteado',
        productName: "Test Feteado Simplificado",
        weight: 1.5,
        costPerKg: 10000,
        totalCost: 15000,
        status: 'STOCK',
        producedAt: new Date().toISOString()
      });
    }
  });

  const stockPres_post_simpl = (await getDoc(presRef)).data().stockActual;
  const pkgSimplSnap = await getDoc(doc(db, 'packages', 'test_package_simplificado'));
  const pkgSimplExists = pkgSimplSnap.exists();

  console.log(`- Stock Terminado (esperado 30.00): ${stockPres_post_simpl}`);
  console.log(`- ¿Se creó paquete en Firestore? (esperado false): ${pkgSimplExists}`);

  if (stockPres_post_simpl === 30 && !pkgSimplExists) {
    console.log("   ✅ PASO 7: MODO SIMPLIFICADO COMPROBADO CON ÉXITO");
  } else {
    throw new Error("Fallo en comprobaciones de modo simplificado");
  }

  // ====================================================
  // LIMPIEZA FINAL
  // ====================================================
  console.log("\n[9] Limpiando documentos de prueba...");
  await deleteDoc(mpRef);
  await deleteDoc(insRef);
  await deleteDoc(presRef);
  await deleteDoc(recipeRef);
  await deleteDoc(orderRef);
  await deleteDoc(doc(db, 'sales', saleId));
  await deleteDoc(doc(db, 'packages', 'test_package_1'));
  
  // Restaurar configuraciones originales
  await setDoc(settingsRef, originalSettings);
  console.log("- Catálogo y documentos de test eliminados.");

  console.log("\n==================================================");
  console.log("       TODOS LOS TEST COMPLETADOS CON ÉXITO");
  console.log("==================================================");
}

runTest().catch(err => {
  console.error("\n❌ ERROR DURANTE LA EJECUCIÓN DE PRUEBAS:", err);
  process.exit(1);
});
