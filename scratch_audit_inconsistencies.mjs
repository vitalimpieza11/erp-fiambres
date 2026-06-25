import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
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

async function audit() {
  const prodSnap = await getDocs(collection(db, 'products'));
  const productIds = new Set(prodSnap.docs.map(d => d.id));

  const purchSnap = await getDocs(collection(db, 'purchases'));
  const purchases = purchSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const stockSnap = await getDocs(collection(db, 'stock_movements'));
  const stockMovements = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Total productos reales: ${productIds.size}`);
  console.log(`Total compras: ${purchases.length}`);
  console.log(`Total movimientos de stock: ${stockMovements.length}`);

  let inconsistencies = [];

  purchases.forEach(p => {
    if (p.items && Array.isArray(p.items)) {
      p.items.forEach(item => {
        if (!productIds.has(item.productId)) {
          inconsistencies.push({
            type: 'PURCHASE_HAS_UNKNOWN_PRODUCT',
            purchaseId: p.id,
            unknownProductId: item.productId,
            date: p.date
          });
        }
      });
    }
  });

  stockMovements.forEach(sm => {
    if (!productIds.has(sm.productId)) {
      inconsistencies.push({
        type: 'STOCK_MOVEMENT_HAS_UNKNOWN_PRODUCT',
        movementId: sm.id,
        unknownProductId: sm.productId,
        date: sm.date
      });
    }
  });

  console.log("\n=== INCONSISTENCIAS ENCONTRADAS ===");
  if (inconsistencies.length === 0) {
    console.log("No se encontraron inconsistencias. Todas las compras y movs apuntan a productos que existen.");
  } else {
    inconsistencies.slice(0, 20).forEach(inc => {
      console.log(inc);
    });
  }
}

audit().catch(console.error);
