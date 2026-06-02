import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword } from 'firebase/auth';
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
const auth = getAuth(app);
const db = getFirestore(app, 'default');

const targetCollections = [
  'presentaciones',
  'mercaderias',
  'insumos',
  'stock_movements',
  'sales',
  'purchases',
  'orders',
  'recipes',
  'customers',
  'suppliers',
  'cash_movements',
  'priceLists'
];

async function run() {
  let user;
  try {
    const cred = await createUserWithEmailAndPassword(auth, 'temp_audit@erp.com', 'temp123456');
    user = cred.user;
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, 'temp_audit@erp.com', 'temp123456');
      user = cred.user;
    } else {
      throw e;
    }
  }

  const report = {};

  for (const colName of targetCollections) {
    const colRef = collection(db, colName);
    const snap = await getDocs(colRef);
    report[colName] = snap.size;
  }

  console.log("AUDIT_REPORT:", JSON.stringify(report));

  await deleteUser(user);
  process.exit(0);
}

run().catch(console.error);
