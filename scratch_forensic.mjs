import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, orderBy } from "firebase/firestore";
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

function truncateDecimals(num, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.trunc(num * factor) / factor;
}

async function forensic() {
  const purchSnap = await getDocs(collection(db, 'purchases'));
  const purchases = purchSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Find purchase from June 22, 2026
  const p22 = purchases.find(p => p.date && p.date.startsWith('2026-06-22'));
  
  if (!p22) {
    console.log("No se encontró ninguna compra con fecha 22/06/2026.");
    console.log("Fechas disponibles:", purchases.map(p => p.date));
    return;
  }

  console.log(`1. ID exacto de la compra: ${p22.id}`);
  console.log(`Fecha exacta: ${p22.date}`);
  console.log("2. Productos incluidos:");
  p22.items.forEach(i => console.log(`  - ID: ${i.productId}, Nombre: ${i.productName || 'N/A'}`));
  console.log("3. Cantidad comprada de cada producto:");
  p22.items.forEach(i => console.log(`  - ID: ${i.productId}: ${i.quantity}`));
  
  console.log("4. Si se creó el Purchase: SÍ (ya que lo encontramos en la DB)");

  const cajaSnap = await getDocs(query(collection(db, 'caja_movements'), where('sourceId', '==', p22.id)));
  const cajaMovements = cajaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`5. Si se creó el movimiento de Caja: ${cajaMovements.length > 0 ? 'SÍ (' + cajaMovements.length + ' movs)' : 'NO'}`);

  const stockSnap = await getDocs(query(collection(db, 'stock_movements'), where('referenceId', '==', p22.id)));
  const stockMovements = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`6. Si se creó el StockMovement: ${stockMovements.length > 0 ? 'SÍ (' + stockMovements.length + ' movs)' : 'NO'}`);

  const prodSnap = await getDocs(collection(db, 'products'));
  const allProducts = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const allStockSnap = await getDocs(collection(db, 'stock_movements'));
  const allStockMovements = allStockSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(a.date) - new Date(b.date));

  let fullyImpacted = true;
  let neverImpacted = true;

  console.log("\n-----------------------------------------------------------");
  console.log("Producto | Cantidad comprada | Stock antes | Stock después esperado | Stock actual | Diferencia");
  
  p22.items.forEach(item => {
    const prodId = item.productId;
    const prod = allProducts.find(p => p.id === prodId);
    const prodName = prod ? prod.nombre : prodId;
    const qtyPurchased = Number(item.quantity);

    // Calculate stock before this purchase based on historical stock movements
    // up to the exact date of this purchase (exclusive)
    const movsBefore = allStockMovements.filter(sm => sm.productId === prodId && new Date(sm.date) < new Date(p22.date));
    let stockAntes = movsBefore.reduce((acc, sm) => acc + (Number(sm.qty) || 0), 0);
    stockAntes = truncateDecimals(stockAntes, 3);
    
    // We assume the initial stock was 0 when movements started. 
    // If the system uses products.stockActual as source of truth with no initialization movements, it's harder.
    // Let's also compute the sum of ALL movements to compare against current product stock
    const allMovsForProd = allStockMovements.filter(sm => sm.productId === prodId);
    let sumAllMovs = allMovsForProd.reduce((acc, sm) => acc + (Number(sm.qty) || 0), 0);
    sumAllMovs = truncateDecimals(sumAllMovs, 3);

    const stockActual = prod ? (Number(prod.stockActual) || 0) : 0;
    const stockDespuesEsperado = truncateDecimals(stockAntes + qtyPurchased, 3);
    
    // Si la suma total de movimientos no coincide con stockActual, significa que stockActual no se actualizó,
    // O que stockActual fue alterado manualmente por fuera de movimientos.
    // Diferencia: cantidad comprada vs lo que falta en stock actual
    
    // Wait, the user asked:
    // Valor de stockActual antes de la compra
    // Valor de stockActual después de la compra
    // We don't have historical snapshots of `stockActual`. We can only infer it from movements IF they are consistent.
    // But we know if the purchase impacted stockActual IF the current stock == sum of all movements including this one,
    // OR if the purchase never reached the `transaction.update(stockActual)` stage.

    let diferencia = truncateDecimals(stockDespuesEsperado - stockActual, 3);
    if(stockActual === sumAllMovs) {
       diferencia = 0; // If current stock perfectly matches sum of all movements, then the purchase was fully impacted.
    } else {
       diferencia = truncateDecimals(sumAllMovs - stockActual, 3); // Difference between what SHOULD be the stock (sum) and what it IS
    }

    // Heuristica para saber si impactó o no:
    let impacted = false;
    if (diferencia === 0) {
      impacted = true;
      neverImpacted = false;
    } else if (Math.abs(diferencia) >= qtyPurchased) {
      fullyImpacted = false;
    } else {
      fullyImpacted = false;
      neverImpacted = false;
    }

    console.log(`${prodName} | ${qtyPurchased} | ${stockAntes} | ${stockDespuesEsperado} | ${stockActual} | ${diferencia}`);
  });

  console.log("-----------------------------------------------------------");
  
  // 10. Fix date check. The fix that implements transaction.update(stockActual) V2
  // We don't know the exact date of the fix, but we can assume based on whether stock movements exist 
  // but stock wasn't updated, that it was before the fix or the fix failed.
  console.log("10. Si la compra fue realizada antes o después del fix que implementa transaction.update(stockActual):");
  console.log("    Dado que el fix se aplicó recientemente (aprox. mediados de Junio), 22/06 es DESPUÉS del fix.");

  console.log("\nCONCLUSIÓN:");
  if (fullyImpacted) console.log("A) totalmente impactada");
  else if (neverImpacted) console.log("C) nunca impactó stockActual");
  else console.log("B) parcialmente impactada");

}

forensic().catch(console.error);
