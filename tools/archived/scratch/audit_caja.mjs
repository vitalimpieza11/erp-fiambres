import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { config } from 'dotenv';
import fs from 'fs';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runAudit() {
  try {
    const snapshot = await getDocs(collection(db, 'caja_movements'));
    const movements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    let normalCount = 0;
    let annulmentCount = 0;
    let compensationsCount = 0;
    let orphanCount = 0;

    let totalIncome = 0;
    let totalExpense = 0;

    let bankIncome = 0;
    let bankExpense = 0;

    let efecIncome = 0;
    let efecExpense = 0;

    // Detect compensations. Usually they have category = 'ANULACION' and description points to another.
    // Or they are marked with an annulled status.
    movements.forEach(m => {
      const amount = Number(m.amount) || 0;
      const isAnnulment = m.category === 'ANULACION' || m.description?.toLowerCase().includes('anulaci');
      
      // Let's figure out normal vs annulled
      if (isAnnulment) {
        annulmentCount++;
        compensationsCount++; // Compensatory movement
      } else {
        normalCount++;
      }

      // Quick Dashboard Balance logic
      // In Dashboard, cacheCaja.movements reduces blindly INCOME - EXPENSE
      if (m.type === 'INCOME') {
        totalIncome += amount;
      } else if (m.type === 'EXPENSE') {
        totalExpense += amount;
      }

      // Let's guess Effective vs Bank for "Saldo Efectivo" and "Saldo Bancos"
      const desc = (m.description || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      const isBanco = desc.includes('banco') || 
                      desc.includes('transferencia') || 
                      desc.includes('transf') || 
                      desc.includes('deposito') || 
                      desc.includes('depósito') ||
                      desc.includes('cheque') ||
                      cat.includes('banco') || 
                      cat.includes('transferencia');
      
      if (isBanco) {
        if (m.type === 'INCOME') bankIncome += amount;
        else if (m.type === 'EXPENSE') bankExpense += amount;
      } else {
        // Assume EFECTIVO
        if (m.type === 'INCOME') efecIncome += amount;
        else if (m.type === 'EXPENSE') efecExpense += amount;
      }
    });

    const dashboardBalance = totalIncome - totalExpense;
    const efecBalance = efecIncome - efecExpense;
    const bankBalance = bankIncome - bankExpense;

    console.log("=== REPORTE DE AUDITORIA DE CAJA ===");
    console.log("Total Movimientos en Firestore:", movements.length);
    console.log("Cantidad Normales:", normalCount);
    console.log("Cantidad Anulaciones/Compensaciones:", annulmentCount);
    console.log("Saldo Efectivo (Aprox):", efecBalance);
    console.log("Saldo Bancos (Aprox):", bankBalance);
    console.log("Saldo Dashboard / Total Global:", dashboardBalance);

    process.exit(0);
  } catch (error) {
    console.error("Error auditing:", error);
    process.exit(1);
  }
}

runAudit();
