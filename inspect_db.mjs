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

const COLLECTIONS = [
  'customers',
  'suppliers',
  'products',
  'recipes',
  'shareholders',
  'orders',
  'stock_movements',
  'sales',
  'caja_movements',
  'shareholder_movements',
  'users',
  'customer_movements',
  'settings',
  'price_lists',
  'equivalences',
  'supplier_movements',
  'purchases',
  'mercaderias',
  'insumos',
  'presentaciones'
];

async function inspect() {
  console.log("=== INSPECCIÓN DE LA BASE DE DATOS 'default' ===");
  for (const name of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, name));
      if (snap.size > 0) {
        console.log(`Colección: '${name}' - Cantidad de documentos: ${snap.size}`);
        snap.docs.slice(0, 10).forEach(doc => {
          console.log(`  - ID: ${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
        });
      } else {
        console.log(`Colección: '${name}' - Vacía`);
      }
    } catch (e) {
      console.log(`Error al leer colección '${name}':`, e.message);
    }
  }
}

inspect().catch(console.error);
