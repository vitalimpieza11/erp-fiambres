import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";
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

async function migrate() {
  console.log("=== INICIANDO MIGRACIÓN DE DATOS A 'products' ===");

  // 1. Fetch all legacy collections
  const mercaderiasSnap = await getDocs(collection(db, 'mercaderias'));
  const insumosSnap = await getDocs(collection(db, 'insumos'));
  const presentacionesSnap = await getDocs(collection(db, 'presentaciones'));
  const recipesSnap = await getDocs(collection(db, 'recipes'));

  const recipes = recipesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log(`Leídos:`);
  console.log(`- ${mercaderiasSnap.size} mercaderías`);
  console.log(`- ${insumosSnap.size} insumos`);
  console.log(`- ${presentacionesSnap.size} presentaciones`);
  console.log(`- ${recipes.length} recetas`);

  const batch = writeBatch(db);
  const migratedProducts = [];

  // 2. Map Mercaderias to Products
  mercaderiasSnap.forEach((d) => {
    const data = d.data();
    const product = {
      id: d.id,
      nombre: data.name || data.nombre || "Sin nombre",
      type: "MERCADERIA",
      unitType: "KG",
      activo: data.isActive !== false,
      costoActual: Number(data.costoKg || 0),
      stockActual: Number(data.stockKg || 0),
      brand: data.brand || "",
      category: data.category || "",
      provider: data.provider || "",
      observations: data.observations || "",
      pesoFeta: Number(data.pesoFeta || 20),
      mermaEstimada: Number(data.mermaEstimada || 10),
      precioSugerido: Number(data.precioManual || data.costoKg ? data.costoKg * 1.3 : 0),
      precioComercial: Number(data.precioManual || data.costoKg ? data.costoKg * 1.3 : 0),
      updatedAt: Date.now()
    };
    migratedProducts.push(product);
  });

  // 3. Map Insumos to Products
  insumosSnap.forEach((d) => {
    const data = d.data();
    const product = {
      id: d.id,
      nombre: data.name || data.nombre || "Sin nombre",
      type: "INSUMO",
      unitType: "UNIDADES",
      activo: data.isActive !== false,
      costoActual: Number(data.costoUnitario || 0),
      stockActual: Number(data.stockUnidades || 0),
      observations: data.observations || "",
      updatedAt: Date.now()
    };
    migratedProducts.push(product);
  });

  // 4. Map Presentaciones to Products (including recipeItems generation)
  presentacionesSnap.forEach((d) => {
    const data = d.data();
    
    // Find recipe
    let recipeId = data.recipeId || data.recetaId;
    let foundRecipe = recipes.find(r => r.id === recipeId);
    
    if (!foundRecipe && recipeId) {
      // Try by matching name or other fields
      foundRecipe = recipes.find(r => r.name === data.recipeName || r.name === data.name);
    }
    if (!foundRecipe && !recipeId) {
      foundRecipe = recipes.find(r => r.name === data.recipeName || r.name === data.name);
    }

    const recipeItems = [];

    // Add ingredients from recipe if found
    if (foundRecipe && foundRecipe.ingredients) {
      foundRecipe.ingredients.forEach(ing => {
        recipeItems.push({
          productId: ing.productId,
          quantity: Number(ing.quantity || 0),
          unit: "GRAMOS"
        });
      });
    } else if (data.productoBaseId) {
      // No recipe but has a base product -> single product presentation
      recipeItems.push({
        productId: data.productoBaseId,
        quantity: Number(data.pesoObjetivoGramos || 1000),
        unit: "GRAMOS"
      });
    }

    // Add packaging (bolsa)
    if (data.bolsaId) {
      recipeItems.push({
        productId: data.bolsaId,
        quantity: 1,
        unit: "UNIDADES"
      });
    }

    // Add packaging (etiqueta)
    if (data.etiquetaId) {
      recipeItems.push({
        productId: data.etiquetaId,
        quantity: 1,
        unit: "UNIDADES"
      });
    }

    const product = {
      id: d.id,
      nombre: data.name || data.nombre || "Sin nombre",
      type: "PRESENTACION",
      unitType: "UNIDADES",
      activo: data.isActive !== false,
      precioSugerido: Number(data.precioVentaKg || data.precioComercialKg || 0),
      precioComercial: Number(data.precioComercialKg || 0),
      costoActual: Number(data.manoObra || 0),
      stockActual: Number(data.stockActual || 0),
      recipeItems,
      customerId: data.customerId || "",
      customerName: data.customerName || "",
      pesoObjetivoGramos: Number(data.pesoObjetivoGramos || 0),
      unidadesPorCaja: Number(data.unidadesPorCaja || 1),
      cantidadFetasEstimada: Number(data.cantidadFetasEstimada || 0),
      updatedAt: Date.now()
    };

    migratedProducts.push(product);
  });

  console.log(`\nPreparando escritura en lote de ${migratedProducts.length} productos...`);

  // Write all products to the 'products' collection
  for (const prod of migratedProducts) {
    const { id, ...data } = prod;
    const ref = doc(db, 'products', id);
    batch.set(ref, data);
  }

  await batch.commit();
  console.log("✅ MIGRACIÓN COMPLETADA CON ÉXITO.");
  process.exit(0);
}

migrate().catch(console.error);
