import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'default');

async function run() {
  const querySnapshot = await getDocs(collection(db, 'products'));
  const missing = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.nombre || data.nombre.trim() === '') {
      missing.push({ id: doc.id, data });
    }
  });
  console.log('PRODUCTS MISSING NAME:', JSON.stringify(missing, null, 2));
}

run().catch(console.error);
