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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'default');

async function audit() {
  console.log("=== INICIANDO AUDITORÍA DETALLADA PARA MIGRACIÓN ===");

  const productsSnap = await getDocs(collection(db, 'products'));
  const equivalencesSnap = await getDocs(collection(db, 'equivalences'));

  const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const equivalences = equivalencesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const presentations = products.filter(p => p.type === 'PRESENTACION');
  
  // Contadores de unidades
  let countGramos = 0;
  let countKg = 0;
  let countUnidades = 0;
  let countFetas = 0;

  const neededEquivalences = [];

  presentations.forEach(p => {
    const recipeItems = p.recipeItems || [];
    recipeItems.forEach(item => {
      const unit = String(item.unit || '').toUpperCase();
      if (unit === 'GRAMOS') countGramos++;
      else if (unit === 'KG') countKg++;
      else if (unit === 'UNIDADES') countUnidades++;
      else if (unit === 'FETAS') countFetas++;

      // Verificar ingrediente y su tipo de unidad base
      const ingredient = products.find(prod => prod.id === item.productId);
      if (ingredient) {
        const ingBaseUnit = String(ingredient.unitType || '').toUpperCase();
        if (unit !== ingBaseUnit) {
          neededEquivalences.push({
            productName: p.nombre,
            ingredientName: ingredient.nombre,
            fromUnit: unit,
            toUnit: ingBaseUnit
          });
        }
      }
    });
  });

  console.log(`\nEstadísticas de unidades en las recetas actuales:`);
  console.log(`- gramos: ${countGramos}`);
  console.log(`- kg (kilogramos): ${countKg}`);
  console.log(`- unidades: ${countUnidades}`);
  console.log(`- fetas: ${countFetas}`);

  console.log(`\nEquivalencias registradas en el sistema:`);
  if (equivalences.length === 0) {
    console.log(`- Ninguna equivalencia registrada.`);
  } else {
    equivalences.forEach(eq => {
      console.log(`- Nombre: "${eq.nombre}", Origen: "${eq.origen}", Destino: "${eq.destino}", Factor: ${eq.factor}`);
    });
  }

  console.log(`\nValidación de conversiones requeridas:`);
  if (neededEquivalences.length === 0) {
    console.log(`- Todas las relaciones de receta coinciden con la unidad base del ingrediente (no se requieren conversiones).`);
  } else {
    neededEquivalences.forEach(needed => {
      // Ver si existe una equivalencia o si es conversión estándar gramos-kg
      const isGramToKg = (needed.fromUnit === 'GRAMOS' && needed.toUnit === 'KG') || (needed.fromUnit === 'KG' && needed.toUnit === 'GRAMOS');
      
      let exists = false;
      if (isGramToKg) {
        exists = true; // Soportado de forma nativa/estándar por unitConverter.ts
      } else {
        // Buscar en la colección de equivalencias
        exists = equivalences.some(eq => {
          const orig = String(eq.origen || '').toUpperCase();
          const dest = String(eq.destino || '').toUpperCase();
          return (orig === needed.fromUnit && dest === needed.toUnit) || (orig === needed.toUnit && dest === needed.fromUnit);
        });
      }

      console.log(`- [${needed.productName}] Ingrediente: "${needed.ingredientName}" requiere convertir ${needed.fromUnit} -> ${needed.toUnit} => ${exists ? 'SOPORTADO' : 'NO SOPORTADO (FALTA EQUIVALENCIA)'}`);
    });
  }

  console.log(`\n=== AUDITORÍA DETALLADA FINALIZADA ===`);
}

audit().catch(console.error);
