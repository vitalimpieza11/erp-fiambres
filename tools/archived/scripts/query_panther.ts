import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

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

const main = async () => {
  try {
    const presSnap = await getDocs(collection(db, 'presentaciones'));
    const presentaciones = presSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    const panther = presentaciones.find((p: any) => p.name && p.name.toLowerCase().includes('panther'));
    
    console.log('====================================');
    console.log('PRESENTACION:');
    if (!panther) {
      console.log('No encontrada');
      process.exit(1);
    }
    console.log(JSON.stringify(panther, null, 2));

    const recSnap = await getDocs(collection(db, 'recipes'));
    const recipes = recSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    
    console.log('====================================');
    console.log('RECETA ENCONTRADA (CON LA LÓGICA ANTERIOR):');
    const badLogicMatch = recipes.find((r: any) => 
      r.productId === panther.id || 
      r.id === panther.recipeId || 
      r.id === panther.recetaId || 
      (r.productId === panther.productoBaseId && r.customerId === panther.customerId)
    );
    
    if (badLogicMatch) {
      console.log(JSON.stringify(badLogicMatch, null, 2));
    } else {
      console.log('NINGUNA');
    }
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

main();
