import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA1DVWWtmbK1TStPnm3DfQ27zKKNoFtYL8",
  authDomain: "al-vacio.firebaseapp.com",
  projectId: "al-vacio",
  storageBucket: "al-vacio.firebasestorage.app",
  messagingSenderId: "251108729374",
  appId: "1:251108729374:web:4f6c67930ed3286955840f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'default');

async function audit() {
  const salesSnap = await getDocs(collection(db, 'sales'));
  const ordersSnap = await getDocs(collection(db, 'orders'));

  const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const salesWithOrder = sales.filter(s => s.orderId);
  
  let orphanedSales = 0;
  let validPairs = 0;

  console.log("SALE_ID | ORDER_ID | ORDER EXISTE | TOTAL | STATUS");
  console.log("----------------------------------------------------------------------");

  salesWithOrder.forEach(sale => {
    const orderExists = orders.some(o => o.id === sale.orderId);
    if (orderExists) validPairs++;
    else orphanedSales++;

    console.log(`${sale.id} | ${sale.orderId} | ${orderExists ? 'SI' : 'NO'} | ${sale.total} | ${sale.status}`);
  });

  // Pedidos huérfanos: order has a saleId but sale doesn't exist, OR order is FACTURADO but sale doesn't exist.
  // Actually, let's check any order that has `saleId` where `saleId` doesn't exist in `sales`.
  const ordersWithSaleId = orders.filter(o => o.saleId);
  let orphanedOrders = 0;
  ordersWithSaleId.forEach(order => {
    const saleExists = sales.some(s => s.id === order.saleId);
    if (!saleExists) orphanedOrders++;
  });

  console.log("\n=== RESULTADOS ===");
  console.log(`1. Cantidad exacta de ventas huérfanas: ${orphanedSales}`);
  console.log(`2. Cantidad exacta de pedidos huérfanos (con saleId apuntando a nada): ${orphanedOrders}`);
  console.log(`3. Cantidad exacta de pares válidos: ${validPairs}`);

  process.exit(0);
}

audit().catch(console.error);
