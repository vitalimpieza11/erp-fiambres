import { getDocs, query, collection, orderBy, limit } from 'firebase/firestore';
import { db } from './src/lib/firebase';

async function main() {
  const q = query(collection(db, 'sales'), orderBy('date', 'desc'), limit(1));
  const snap = await getDocs(q);
  const sale = snap.docs[0]?.data();
  console.log("LAST SALE:", JSON.stringify(sale, null, 2));
  process.exit(0);
}
main();
