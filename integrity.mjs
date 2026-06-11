import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, query, where, writeBatch } from "firebase/firestore";

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

async function auditDataIntegrity() {
  const salesSnap = await getDocs(collection(db, 'sales'));
  const ordersSnap = await getDocs(collection(db, 'orders'));
  const receiptsSnap = await getDocs(collection(db, 'payment_receipts'));
  const cashSnap = await getDocs(collection(db, 'cash_movements'));

  const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const receipts = receiptsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const cashMovements = cashSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const orphanSales = sales.filter(s => s.orderId && !orders.some(o => o.id === s.orderId));
  const orphanOrders = orders.filter(o => o.saleId && !sales.some(s => s.id === o.saleId));
  
  const orphanReceipts = receipts.filter(r => {
    const applied = r.appliedInvoices || [];
    if (applied.length === 0) return false;
    return applied.every(inv => !sales.some(s => s.id === inv.saleId));
  });

  const orphanCashMovements = cashMovements.filter(m => {
    if (!m.referenceId) return false;
    const isSale = sales.some(s => s.id === m.referenceId);
    const isReceipt = receipts.some(r => r.id === m.referenceId);
    if (m.category === 'sale') {
      return !isSale && !isReceipt;
    }
    return false;
  });

  return {
    orphanSales: orphanSales.map(s => s.id),
    orphanOrders: orphanOrders.map(o => o.id),
    orphanReceipts: orphanReceipts.map(r => r.id),
    orphanCashMovements: orphanCashMovements.map(c => c.id)
  };
}

async function fixIntegrity() {
  const audit = await auditDataIntegrity();
  let correctedCount = 0;
  const correctedIds = [];

  const targetSaleId = 'W3hRMsR34yidAdCPP9sh';

  const batch = writeBatch(db);

  // 1. Eliminar venta huérfana W3hRMsR34yidAdCPP9sh SOLO si cumple las condiciones
  if (audit.orphanSales.includes(targetSaleId)) {
    const saleRef = doc(db, 'sales', targetSaleId);
    
    // We also need to reverse the customer balance if it was a CC payment.
    const saleSnap = await getDocs(query(collection(db, 'sales'), where('__name__', '==', targetSaleId)));
    let saleTotal = 0;
    let customerId = null;
    let paymentMethod = null;
    if (!saleSnap.empty) {
      const sData = saleSnap.docs[0].data();
      saleTotal = sData.total || 0;
      customerId = sData.customerId;
      paymentMethod = sData.paymentMethod;
    }

    batch.delete(saleRef);
    correctedCount++;
    correctedIds.push(targetSaleId);

    // Also delete any cash movements for this sale
    const rmSnap = await getDocs(query(collection(db, 'cash_movements'), where('referenceId', '==', targetSaleId)));
    rmSnap.forEach(d => {
      batch.delete(d.ref);
      correctedCount++;
      correctedIds.push(d.id);
    });

    await batch.commit();

    // Revert customer balance
    if (paymentMethod === 'cc' && customerId) {
      // Because we can't use transactions inside this batch without more complex logic in the script, 
      // we'll just run a separate update since we are fixing a bug.
      const custRef = doc(db, 'customers', customerId);
      const custSnap = await getDocs(query(collection(db, 'customers'), where('__name__', '==', customerId)));
      if (!custSnap.empty) {
        const cData = custSnap.docs[0].data();
        const newBalance = (cData.currentBalance || 0) - saleTotal;
        const b2 = writeBatch(db);
        b2.update(custRef, { currentBalance: newBalance });
        await b2.commit();
        correctedCount++;
        correctedIds.push(`Customer_${customerId}_BalanceReverted`);
      }
    }
  } else {
    // Check why it wasn't deleted
    console.log(`Sale ${targetSaleId} was not found as orphaned.`);
  }

  console.log(JSON.stringify({ 
    auditDataIntegrity: audit,
    fixResult: {
      registrosCorregidos: correctedCount,
      idsCorregidos: correctedIds
    }
  }, null, 2));

  process.exit(0);
}

fixIntegrity().catch(console.error);
