import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query } from "firebase/firestore";
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

async function runAudit() {
  console.log("Iniciando auditoria de caja_movements...");
  
  const movsRef = collection(db, 'caja_movements');
  const snap = await getDocs(query(movsRef));
  
  const categories = {};
  const reasonTypes = {};
  
  snap.forEach(doc => {
    const data = doc.data();
    if (data.isDeleted) return; // Ignore deleted
    
    const cat = data.category || 'SIN_CATEGORIA';
    const reason = data.reasonType || 'SIN_REASONTYPE';
    const type = data.type || 'UNKNOWN';
    const amount = data.amount || 0;
    
    if (!categories[cat]) {
      categories[cat] = { count: 0, totalAmount: 0, typeCounts: { INCOME: 0, EXPENSE: 0 } };
    }
    categories[cat].count++;
    categories[cat].totalAmount += amount;
    if (categories[cat].typeCounts[type] !== undefined) {
        categories[cat].typeCounts[type]++;
    }
    
    if (!reasonTypes[reason]) {
      reasonTypes[reason] = { count: 0, totalAmount: 0 };
    }
    reasonTypes[reason].count++;
    reasonTypes[reason].totalAmount += amount;
  });
  
  console.log("\n=== CATEGORIAS REALES ===");
  console.table(Object.keys(categories).map(k => ({
      Category: k,
      Count: categories[k].count,
      TotalAmount: categories[k].totalAmount,
      PredominantType: categories[k].typeCounts.INCOME > categories[k].typeCounts.EXPENSE ? 'INCOME' : (categories[k].typeCounts.EXPENSE > categories[k].typeCounts.INCOME ? 'EXPENSE' : 'EQUAL/OTHER')
  })));
  
  console.log("\n=== REASON TYPES REALES ===");
  console.table(Object.keys(reasonTypes).map(k => ({
      ReasonType: k,
      Count: reasonTypes[k].count,
      TotalAmount: reasonTypes[k].totalAmount
  })));
  
  process.exit(0);
}

runAudit().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
