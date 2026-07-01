import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from './src/firebase/firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkKeys() {
  const priceListsSnap = await getDocs(collection(db, 'priceLists'));
  const lists = priceListsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const presSnap = await getDocs(collection(db, 'presentaciones'));
  const presentaciones = presSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log("=== CHECKING PRICE LISTS ===");
  for (const list of lists) {
    if (list.productOverrides && Object.keys(list.productOverrides).length > 0) {
      console.log(`\nLista: ${list.name} (${list.id})`);
      const keys = Object.keys(list.productOverrides);
      console.log(`1. Object.keys(overrides) =`, keys.slice(0, 3), keys.length > 3 ? '...' : '');
      
      for (const key of keys) {
        const presById = presentaciones.find(p => p.id === key);
        const presByName = presentaciones.find(p => p.name === key);
        
        if (presById) {
          console.log(`[MATCH BY ID] override_key: ${key} -> p.id: ${presById.id}, p.name: ${presById.name}`);
          console.log(`4. overrides[p.id] =`, list.productOverrides[key]);
        } else if (presByName) {
          console.log(`[MATCH BY NAME] override_key: ${key} -> p.id: ${presByName.id}, p.name: ${presByName.name}`);
          console.log(`5. overrides[p.name] =`, list.productOverrides[key]);
        } else {
          console.log(`[NO MATCH] override_key: ${key} (No se encontró presentación ni por ID ni por nombre)`);
        }
      }
    }
  }
}

checkKeys().catch(console.error);
