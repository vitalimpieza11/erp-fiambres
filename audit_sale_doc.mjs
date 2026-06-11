import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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

async function auditDoc() {
  const docRef = doc(db, 'sales', 'W3hRMsR34yidAdCPP9sh');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log(JSON.stringify({ id: snap.id, ...snap.data() }, null, 2));
  } else {
    console.log("Document does not exist!");
  }
  process.exit(0);
}

auditDoc().catch(console.error);
