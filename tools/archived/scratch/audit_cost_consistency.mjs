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

function mapRecipeUnitToUnitType(unit) {
  const u = String(unit).toLowerCase();
  if (u === 'kilogramos' || u === 'kg') return 'KG';
  if (u === 'gramos') return 'GRAMOS';
  if (u === 'unidades') return 'UNIDADES';
  if (u === 'fetas') return 'FETAS';
  return 'KG';
}

function convertUnit(amount, fromUnit, toUnit, productName, equivalences) {
  const amt = Number(amount);
  const from = String(fromUnit || '').toUpperCase().trim();
  const to = String(toUnit || '').toUpperCase().trim();
  const name = String(productName || '').toLowerCase();

  if (from === to) return amt;

  let grams = 0;

  if (from === 'GRAMOS' || from === 'GRAMO') {
    grams = amt;
  } else if (from === 'KG' || from === 'KILOGRAMO' || from === 'KILOGRAMOS') {
    grams = amt * 1000;
  } else if (from === 'FETAS' || from === 'FETA') {
    let factor = 18;
    const isCheese = name.includes('queso') || name.includes('tybo') || name.includes('cheddar') || name.includes('pategras');
    if (isCheese) factor = 20;

    const equiv = (equivalences || []).find(e => {
      const orig = String(e.origen || '').toUpperCase().trim();
      const dest = String(e.destino || '').toUpperCase().trim();
      const isFetaToGram = (orig === 'FETA' || orig === 'FETAS') && (dest === 'GRAMOS' || dest === 'GRAMO');
      if (!isFetaToGram) return false;
      const eqName = String(e.nombre || '').toLowerCase();
      if (isCheese) {
        return eqName.includes('queso') || eqName.includes('tybo') || eqName.includes('cheddar');
      } else {
        return eqName.includes('jamón') || eqName.includes('jamon') || eqName.includes('fiambre');
      }
    });

    if (equiv) factor = Number(equiv.factor || factor);
    grams = amt * factor;
  } else if (from === 'UNIDADES' || from === 'UNIDAD') {
    grams = amt;
  }

  if (to === 'GRAMOS' || to === 'GRAMO') {
    return grams;
  } else if (to === 'KG' || to === 'KILOGRAMO' || to === 'KILOGRAMOS') {
    return grams / 1000;
  } else if (to === 'FETAS' || to === 'FETA') {
    let factor = 18;
    const isCheese = name.includes('queso') || name.includes('tybo') || name.includes('cheddar') || name.includes('pategras');
    if (isCheese) factor = 20;

    const equiv = (equivalences || []).find(e => {
      const orig = String(e.origen || '').toUpperCase().trim();
      const dest = String(e.destino || '').toUpperCase().trim();
      const isFetaToGram = (orig === 'FETA' || orig === 'FETAS') && (dest === 'GRAMOS' || dest === 'GRAMO');
      if (!isFetaToGram) return false;
      const eqName = String(e.nombre || '').toLowerCase();
      if (isCheese) {
        return eqName.includes('queso') || eqName.includes('tybo') || eqName.includes('cheddar');
      } else {
        return eqName.includes('jamón') || eqName.includes('jamon') || eqName.includes('fiambre');
      }
    });

    if (equiv) factor = Number(equiv.factor || factor);
    return grams / factor;
  }

  return amt;
}

// Configuración de empaque fija para el análisis (Bolsa: $550, Etiqueta: $0.25, Folex: $7)
const GLOBAL_BOLSA = 550;
const GLOBAL_ETIQUETA = 0.25;
const GLOBAL_FOLEX = 7;

function getTargetUtility(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('trecer') && n.includes('jamon')) return 0.30;
  if (n.includes('jamon') && n.includes('crudo')) return 0.20;
  if (n.includes('panceta')) return 0.35;
  if (n.includes('combinado')) return 0.35;
  if (n.includes('paulina')) return 0.20;
  if (n.includes('cheddar')) return 0.25;
  if (n.includes('natural') && n.includes('jamon')) return 0.23;
  return 0.30; // Default
}

async function runAudit() {
  const productsSnap = await getDocs(collection(db, 'products'));
  const recipesSnap = await getDocs(collection(db, 'recipes'));
  const equivalencesSnap = await getDocs(collection(db, 'equivalences'));

  const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const recipes = recipesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const equivalences = equivalencesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const presentations = products.filter(p => p.type === 'PRESENTACION');

  const report = presentations.map(p => {
    const recipe = recipes.find(r => r.productId === p.id);
    let rawMercaderiaCost = 0;
    let packagingInRecipeCost = 0;
    
    const recipeItemsDetails = [];
    const packagingInRecipeItems = [];

    // FolexQty logic from presentation if configured, or fallback
    const folexQty = p.folexQty !== undefined ? p.folexQty : (p.nombre.toLowerCase().includes('combinado') ? 2 : 1);

    if (recipe && recipe.items) {
      recipe.items.forEach(item => {
        const ing = products.find(prod => prod.id === item.ingredientProductId);
        if (ing) {
          const cost = ing.costoActual || 0;
          const convertedQty = convertUnit(
            item.quantity,
            mapRecipeUnitToUnitType(item.unit),
            ing.unitType,
            ing.nombre,
            equivalences
          );
          const itemCost = convertedQty * cost;

          const isPack = ing.nombre.toLowerCase().includes('bolsa') || 
                         ing.nombre.toLowerCase().includes('etiqueta') ||
                         ing.nombre.toLowerCase().includes('folex') ||
                         ing.nombre.toLowerCase().includes('film') ||
                         ing.nombre.toLowerCase().includes('packaging');

          if (isPack) {
            packagingInRecipeCost += itemCost;
            packagingInRecipeItems.push({
              nombre: ing.nombre,
              qty: item.quantity,
              unit: item.unit,
              costo: itemCost
            });
          } else {
            rawMercaderiaCost += itemCost;
          }

          recipeItemsDetails.push(`${item.quantity} ${item.unit} de ${ing.nombre} (Costo: $${itemCost.toFixed(2)})`);
        }
      });
    }

    const peso = p.pesoObjetivoKg;
    const precioComercial = p.precioComercial || 0;

    return {
      nombre: p.nombre,
      pesoObjetivoKg: peso,
      recetaIngredientes: recipeItemsDetails,
      costoRecetaTotal: rawMercaderiaCost + packagingInRecipeCost,
      costoRecetaPorKg: peso ? (rawMercaderiaCost + packagingInRecipeCost) / peso : 0,
      packagingInRecipeItems,
      packagingInRecipeCost,
      rawMercaderiaCost,
      folexQty,
      precioComercial
    };
  });

  console.log(JSON.stringify(report, null, 2));
}

runAudit().catch(console.error);
