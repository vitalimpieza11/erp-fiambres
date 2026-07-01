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

const CONST_BOLSA = 550;
const CONST_ETIQUETA = 0.25;
const CONST_FOLEX = 7;

function getTargetUtility(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('trecer') && n.includes('jamon')) return 0.30;
  if (n.includes('jamon') && n.includes('crudo')) return 0.20;
  if (n.includes('panceta')) return 0.35;
  if (n.includes('combinado')) return 0.35;
  if (n.includes('paulina')) return 0.20;
  if (n.includes('cheddar')) return 0.25;
  if (n.includes('natural') && n.includes('jamon')) return 0.23;
  return 0.30;
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
    let totalCostoReceta = 0;
    let totalComestibleKg = 0;
    
    const packagingInRecipe = [];
    let hasBolsa = false;
    let hasEtiqueta = false;
    let hasFolex = false;

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
          totalCostoReceta += itemCost;

          const name = ing.nombre.toLowerCase();
          const isPack = name.includes('bolsa') || 
                         name.includes('etiqueta') ||
                         name.includes('folex') ||
                         name.includes('film') ||
                         name.includes('packaging');

          if (isPack) {
            packagingInRecipe.push({
              nombre: ing.nombre,
              cantidad: item.quantity,
              unidad: item.unit,
              costo: itemCost
            });
            if (name.includes('bolsa')) hasBolsa = true;
            if (name.includes('etiqueta')) hasEtiqueta = true;
            if (name.includes('folex')) hasFolex = true;
          } else {
            // Comestible
            if (ing.unitType === 'KG') {
              totalComestibleKg += convertedQty;
            } else if (ing.unitType === 'GRAMOS') {
              totalComestibleKg += convertedQty / 1000;
            } else {
              // Fetas/unidades, weight converted
              const wt = convertUnit(item.quantity, mapRecipeUnitToUnitType(item.unit), 'KG', ing.nombre, equivalences);
              totalComestibleKg += wt;
            }
          }
        }
      });
    }

    const pesoObjetivoGuardado = p.pesoObjetivoKg;
    // Autocorrection for Scenario A logic:
    let pesoObjCorr = pesoObjetivoGuardado || 1;
    if (pesoObjCorr > 10) pesoObjCorr = pesoObjCorr / 1000;

    // Escenario A: actual calculations from recipe
    const costoKgA = totalCostoReceta / pesoObjCorr;
    const merma = p.mermaObjetivo !== undefined ? p.mermaObjetivo : 5;
    const util = p.utilidadObjetivo !== undefined ? p.utilidadObjetivo : (getTargetUtility(p.nombre) * 100);
    const denom = 1 - (merma / 100) - (util / 100);
    const precioSugeridoA = denom <= 0 ? 0 : costoKgA / denom;

    // Escenario B: user's pricing logic
    // Costo Mercaderia Kg = (cost of comestible ingredients) / pesoObjCorr
    const comestibleCost = totalCostoReceta - packagingInRecipe.reduce((acc, it) => acc + it.costo, 0);
    const costoMercaderiaKg = comestibleCost / pesoObjCorr;
    
    // Costo Packaging Kg = (Bolsa + Etiqueta + Folex) / pesoObjCorr
    const folexQty = p.folexQty !== undefined ? p.folexQty : (p.nombre.toLowerCase().includes('combinado') ? 2 : 1);
    const packKgCost = (CONST_BOLSA + CONST_ETIQUETA + folexQty * CONST_FOLEX) / pesoObjCorr;
    const costoKgB = costoMercaderiaKg + packKgCost;
    const precioSugeridoB = denom <= 0 ? 0 : costoKgB / denom;

    return {
      nombre: p.nombre,
      pesoObjetivoGuardado,
      pesoRealInferido: totalComestibleKg,
      comestibleKg: totalComestibleKg,
      packagingInRecipe,
      costoReceta: totalCostoReceta,
      costoMercaderiaKg,
      precioComercial: p.precioComercial || 0,
      hasBolsa,
      hasEtiqueta,
      hasFolex,
      folexQty,
      precioSugeridoA,
      precioSugeridoB,
      costoKgA,
      costoKgB,
      util,
      merma
    };
  });

  console.log(JSON.stringify(report, null, 2));
}

runAudit().catch(console.error);
