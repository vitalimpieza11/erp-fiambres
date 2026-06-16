import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
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

async function runMigration() {
  console.log("=== INICIANDO MIGRACIÓN DE NOMBRES EN FIRESTORE ===");
  
  // 1. Clientes (Customers)
  console.log("\nProcesando clientes...");
  const customersSnap = await getDocs(collection(db, 'customers'));
  let customersUpdated = 0;
  for (const d of customersSnap.docs) {
    const data = d.data();
    if (data.name && data.nombre !== data.name) {
      console.log(`- Actualizando cliente ${d.id}: '${data.nombre}' -> '${data.name}'`);
      await updateDoc(doc(db, 'customers', d.id), {
        nombre: data.name
      });
      customersUpdated++;
    } else {
      console.log(`- Cliente ${d.id} ('${data.nombre || data.name}') ya está sincronizado o no tiene 'name'.`);
    }
  }
  console.log(`Clientes actualizados: ${customersUpdated}`);

  // 2. Proveedores (Suppliers)
  console.log("\nProcesando proveedores...");
  const suppliersSnap = await getDocs(collection(db, 'suppliers'));
  let suppliersUpdated = 0;
  for (const d of suppliersSnap.docs) {
    const data = d.data();
    if (data.name && data.nombre !== data.name) {
      console.log(`- Actualizando proveedor ${d.id}: '${data.nombre}' -> '${data.name}'`);
      await updateDoc(doc(db, 'suppliers', d.id), {
        nombre: data.name
      });
      suppliersUpdated++;
    } else {
      console.log(`- Proveedor ${d.id} ('${data.nombre || data.name}') ya está sincronizado o no tiene 'name'.`);
    }
  }
  console.log(`Proveedores actualizados: ${suppliersUpdated}`);

  console.log("\n✅ Migración completada con éxito.");
  process.exit(0);
}

runMigration().catch((error) => {
  console.error("Error durante la migración:", error);
  process.exit(1);
});
