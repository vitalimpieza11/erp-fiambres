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

// Simplificamos las funciones de conversión de unidad en JS
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

async function audit() {
  const productsSnap = await getDocs(collection(db, 'products'));
  const recipesSnap = await getDocs(collection(db, 'recipes'));
  const equivalencesSnap = await getDocs(collection(db, 'equivalences'));

  const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const recipes = recipesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const equivalences = equivalencesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const presentations = products.filter(p => p.type === 'PRESENTACION');

  console.log(JSON.stringify({
    presentations: presentations.map(p => {
      const recipe = recipes.find(r => r.productId === p.id);
      let totalCost = 0;
      const ingredients = [];

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
            totalCost += itemCost;
            ingredients.push({
              nombre: ing.nombre,
              cantidadOriginal: item.quantity,
              unidadOriginal: item.unit,
              cantidadConvertida: convertedQty,
              unidadConvertida: ing.unitType,
              costoUnitario: cost,
              costoSubtotal: itemCost
            });
          }
        });
      }

      const peso = p.pesoObjetivoKg || 1;
      const costoKg = totalCost / peso;

      return {
        nombre: p.nombre,
        pesoObjetivoKg: peso,
        ingredientes: ingredients,
        costoCalculadoReceta: totalCost,
        costoPorKgResultante: costoKg
      };
    })
  }, null, 2));
}

audit().catch(console.error);
