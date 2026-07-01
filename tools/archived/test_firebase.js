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

console.log("----- CONFIG -----");
console.log(JSON.stringify(firebaseConfig, null, 2));
console.log("------------------");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("db exists:", !!db);
console.log("db.app.options.projectId exists:", !!db.app?.options?.projectId);
console.log("projectId value:", db.app?.options?.projectId);

console.log("\n----- TEST COLLECTION -----");
try {
  const testCol = collection(db, "customers");
  console.log("collection(db, 'customers') ejecutado sin errores. Referencia creada:", testCol.path);
} catch (e) {
  console.error("Error en collection():", e.stack);
}

console.log("\n----- TEST GETDOCS -----");
try {
  const querySnapshot = await getDocs(collection(db, "customers"));
  console.log("getDocs ejecutado con éxito. Documentos obtenidos:", querySnapshot.size);
} catch(e) {
  console.error("ERROR EXACTO EN GETDOCS:");
  console.error(e.stack);
}
