import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
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
  console.log("=== 1. Verificar panceta-ahumada-001 ===");
  const pRef = doc(db, 'products', 'panceta-ahumada-001');
  const pSnap = await getDoc(pRef);
  console.log("Existe panceta-ahumada-001?", pSnap.exists());
  
  console.log("\n=== 2. Listar algunos productos reales en 'products' ===");
  const prodSnap = await getDocs(collection(db, 'products'));
  const allProducts = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  allProducts.slice(0, 5).forEach(p => {
    console.log(`- ID: ${p.id}, Nombre: ${p.name || p.nombre || p.descripcion}`);
  });

  console.log("\n=== 3. Buscar productos que parezcan panceta ===");
  const panceta = allProducts.filter(p => JSON.stringify(p).toLowerCase().includes('panceta'));
  panceta.forEach(p => {
    console.log(`- ID: ${p.id}, data:`, p);
  });
}

audit().catch(console.error);
