import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc } from "firebase/firestore";
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

async function runTests() {
  console.log("== LECTURA CUSTOMERS ==");
  try {
    const snap = await getDocs(collection(db, "customers"));
    console.log("Lectura customers exitosa. Cantidad:", snap.size);
  } catch (error) {
    console.error("Fallo lectura customers:", error.message);
  }

  console.log("== LECTURA PRODUCTS ==");
  try {
    const snap2 = await getDocs(collection(db, "products"));
    console.log("Lectura products exitosa. Cantidad:", snap2.size);
  } catch (error) {
    console.error("Fallo lectura products:", error.message);
  }

  console.log("== ESCRITURA PRUEBA ==");
  try {
    await setDoc(doc(db, "test_col", "test_doc"), { value: 1 });
    console.log("Escritura exitosa.");
  } catch (error) {
    console.error("Fallo escritura:", error.message);
  }
}

runTests();
