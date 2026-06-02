import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function run() {
  const snap = await getDocs(collection(db, 'products'));
  console.log("Legacy 'products' collection size:", snap.size);
  
  const moveSnap = await getDocs(collection(db, 'stock_movements'));
  console.log("'stock_movements' collection size:", moveSnap.size);

  process.exit(0);
}

run().catch(console.error);
