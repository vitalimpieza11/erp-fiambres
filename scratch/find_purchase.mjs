import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// read .env
const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...vParts] = line.split('=');
  const v = vParts.join('=');
  if (k && v) env[k.trim()] = v.trim().replace(/['"]/g, '');
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findPurchase() {
  const q = query(collection(db, 'purchases'));
  const snap = await getDocs(q);
  const docs = snap.docs.map(d => d.data());
  const match = docs.find(d => d.date && d.date.includes('2026-06-22'));
  if (match) {
    console.log('ID:', match.id);
    console.log('ITEMS:', JSON.stringify(match.items, null, 2));
  } else {
    console.log('No purchase found for 2026-06-22');
  }
  process.exit(0);
}
findPurchase();
