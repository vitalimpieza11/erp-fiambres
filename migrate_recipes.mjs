import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";
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

function mapUnit(unit) {
  const u = String(unit || '').toUpperCase().trim();
  if (u === 'KG') return 'kilogramos';
  if (u === 'GRAMOS') return 'gramos';
  if (u === 'UNIDADES') return 'unidades';
  if (u === 'FETAS') return 'fetas';
  return 'gramos'; // default fallback
}

async function migrate() {
  console.log("=== INICIANDO MIGRACIÓN SEGURA DE RECETAS ===");

  // 1. Obtener productos y equivalencias
  const productsSnap = await getDocs(collection(db, 'products'));
  const catalog = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const presentations = catalog.filter(p => p.type === 'PRESENTACION');
  console.log(`Se detectaron ${presentations.length} presentaciones para migrar.`);

  let migratedCount = 0;

  // 2. Crear las recetas estructuradas en la colección 'recipes'
  for (const prod of presentations) {
    const embeddedItems = prod.recipeItems || [];
    if (embeddedItems.length === 0) {
      console.log(`- Presentación "${prod.nombre}" (ID: ${prod.id}) no tiene ingredientes embebidos. Saltando.`);
      continue;
    }

    console.log(`- Migrando receta para "${prod.nombre}" (ID: ${prod.id}) con ${embeddedItems.length} ingredientes...`);

    const recipeItems = embeddedItems.map(item => {
      const ingredient = catalog.find(c => c.id === item.productId);
      const ingredientName = ingredient ? ingredient.nombre : "Ingrediente Desconocido";
      return {
        ingredientProductId: item.productId,
        ingredientName: ingredientName,
        quantity: Number(item.quantity || 0),
        unit: mapUnit(item.unit)
      };
    });

    const now = new Date().toISOString();
    const recipe = {
      productId: prod.id,
      productName: prod.nombre,
      createdAt: now,
      updatedAt: now,
      items: recipeItems
    };

    // Usar el ID de la presentación como ID de la receta para relación 1-a-1 directa
    const recipeRef = doc(db, 'recipes', prod.id);
    await setDoc(recipeRef, recipe);
    migratedCount++;
    console.log(`  ✅ Receta guardada exitosamente en recipes/${prod.id}`);
  }

  // 3. Crear equivalencias oficiales para FETAS si no existen
  console.log("\n=== INSERTANDO EQUIVALENCIAS OFICIALES PARA FETAS ===");
  const equivalencesSnap = await getDocs(collection(db, 'equivalences'));
  const currentEquivs = equivalencesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const hasQuesoFeta = currentEquivs.some(eq => eq.nombre.toLowerCase().includes('queso') && eq.origen === 'FETAS');
  const hasJamonFeta = currentEquivs.some(eq => (eq.nombre.toLowerCase().includes('jamon') || eq.nombre.toLowerCase().includes('fiambre') || eq.nombre.toLowerCase().includes('general')) && eq.origen === 'FETAS');

  if (!hasQuesoFeta) {
    const docId = "equiv_feta_quesos";
    const ref = doc(db, 'equivalences', docId);
    await setDoc(ref, {
      nombre: "Equivalencia Fetas a Gramos (Quesos)",
      origen: "FETAS",
      destino: "GRAMOS",
      factor: 20
    });
    console.log(`- Creada equivalencia oficial para Quesos: 1 feta = 20 gramos (ID: ${docId})`);
  } else {
    console.log("- Equivalencia de fetas para Quesos ya existe.");
  }

  if (!hasJamonFeta) {
    const docId = "equiv_feta_fiambres";
    const ref = doc(db, 'equivalences', docId);
    await setDoc(ref, {
      nombre: "Equivalencia Fetas a Gramos (Fiambres)",
      origen: "FETAS",
      destino: "GRAMOS",
      factor: 18
    });
    console.log(`- Creada equivalencia oficial para Fiambres: 1 feta = 18 gramos (ID: ${docId})`);
  } else {
    console.log("- Equivalencia de fetas para Fiambres ya existe.");
  }

  console.log(`\n=== MIGRACIÓN MIGRADA: ${migratedCount} recetas migradas con éxito. ===`);
  process.exit(0);
}

migrate().catch(console.error);
