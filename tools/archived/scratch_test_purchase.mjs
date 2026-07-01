import { initializeApp } from "firebase/app";
import { getFirestore, doc, runTransaction, collection } from "firebase/firestore";
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

function removeUndefinedFields(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefinedFields);
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) newObj[key] = removeUndefinedFields(obj[key]);
    }
    return newObj;
  }
  return obj;
}

function truncateDecimals(num, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.trunc(num * factor) / factor;
}

async function testAddPurchase() {
  const purchaseData = {
    supplierId: "dummy-supplier",
    date: new Date().toISOString(),
    items: [
      {
        productId: "H1qwoDCdDSntPFPTbEte",
        quantity: 5,
        unitCost: 1000,
        totalCost: 5000,
        unidad: "KILOGRAMOS",
        pesoReal: 5
      }
    ],
    subtotal: 5000,
    impuestos: 0,
    total: 5000,
    montoPagado: 5000,
    montoCuentaCorriente: 0,
    paymentMethod: "EFECTIVO",
    accountId: "dummy-account"
  };

  const purchaseRef = doc(collection(db, 'purchases'));
  const sanitizedItems = purchaseData.items.map(item => ({
    ...item,
    quantity: Number(item.quantity) || 0,
    unitCost: Number(item.unitCost) || 0,
    totalCost: Number(item.totalCost) || 0,
  }));

  const newPurchase = {
    ...purchaseData,
    id: purchaseRef.id,
    type: 'PURCHASE',
    status: 'ACTIVE',
    isDeleted: false,
    items: sanitizedItems,
    subtotal: Number(purchaseData.subtotal) || 0,
    impuestos: Number(purchaseData.impuestos) || 0,
    total: Number(purchaseData.total) || 0,
    montoPagado: Number(purchaseData.montoPagado) || 0,
    montoCuentaCorriente: Number(purchaseData.montoCuentaCorriente) || 0,
  };

  console.log("Iniciando transacción de prueba...");

  try {
    await runTransaction(db, async (transaction) => {
      // 1. LEER TODOS LOS PRODUCTOS PRIMERO
      const productRefs = newPurchase.items.map(item => doc(db, 'products', item.productId));
      const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));
      
      const currentStocks = {};
      productDocs.forEach((pDoc) => {
        if (pDoc.exists()) {
          currentStocks[pDoc.id] = Number(pDoc.data().stockActual) || 0;
        } else {
          currentStocks[pDoc.id] = 0;
        }
      });

      // 2. GUARDAR COMPRA
      transaction.set(purchaseRef, removeUndefinedFields(newPurchase));

      // 3. IMPACTAR STOCK
      for (const item of newPurchase.items) {
        const stockMovRef = doc(collection(db, 'stock_movements'));
        const qty = truncateDecimals(item.quantity, 3);
        const stockMov = {
          id: stockMovRef.id,
          productId: item.productId,
          qty: qty,
          type: 'COMPRA',
          date: newPurchase.date,
          referenceId: newPurchase.id,
          observaciones: 'Compra a proveedor',
          isDeleted: false
        };
        transaction.set(stockMovRef, removeUndefinedFields(stockMov));

        const prodRef = doc(db, 'products', item.productId);
        const oldStock = currentStocks[item.productId];
        const newStock = truncateDecimals(oldStock + qty, 3);
        
        console.log(`[DEBUG COMPRA] 1. Producto ID: ${item.productId}`);
        console.log(`[DEBUG COMPRA] 2. stockActual leído antes: ${oldStock}`);
        console.log(`[DEBUG COMPRA] 3. cantidad comprada: ${qty}`);
        console.log(`[DEBUG COMPRA] 4. nuevo stock calculado: ${newStock}`);
        console.log(`[DEBUG COMPRA] 5. Ejecutando transaction.update...`);
        
        try {
          transaction.update(prodRef, {
            stockActual: newStock,
            costoActual: Number(item.unitCost) || 0,
            costoUltimaCompra: Number(item.unitCost) || 0,
            fechaUltimaCompra: newPurchase.date
          });
          console.log(`[DEBUG COMPRA] 5. transaction.update ejecutado SI`);
          console.log(`[DEBUG COMPRA] 6. valor final guardado: ${newStock}`);
        } catch (error) {
          console.log(`[DEBUG COMPRA] 5. transaction.update falló. Error:`, error);
          throw error;
        }
      }
    });
    console.log("Transacción finalizada con éxito.");
  } catch (err) {
    console.error("Transacción falló por completo:", err);
  }
}

testAddPurchase().catch(console.error);
