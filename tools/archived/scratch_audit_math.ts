import { getOperationalCost, calculatePresentationPrices } from './src/utils/pricingHelpers';
import { Product, RecipeItem, SystemSettings, Equivalencia } from './src/types/domain';

const mockProducts: Product[] = [
  { id: 'jamon_materia_prima', nombre: 'Jamón cocido TRECER', unitType: 'KG', costoActual: 5800, type: 'MATERIA_PRIMA' } as any,
  { id: 'folex_automatico', nombre: 'Folex', unitType: 'U', costoActual: 7, type: 'INSUMO' } as any,
  { id: 'bolsa_vacio', nombre: 'Bolsa vacío', unitType: 'U', costoActual: 55, type: 'INSUMO' } as any,
  { id: 'etiqueta_1', nombre: 'Etiquetas', unitType: 'U', costoActual: 0.25, type: 'INSUMO' } as any,
];

const mockRecipe: RecipeItem[] = [
  { ingredientProductId: 'jamon_materia_prima', quantity: 1, unit: 'Kg' },
];

const mockSettings: SystemSettings = {
  packagingSettings: {
    folexProductId: 'folex_automatico',
    bolsaProductId: 'bolsa_vacio',
    etiquetaProductId: 'etiqueta_1'
  }
} as any;

const mockEquivalences: Equivalencia[] = [
  {
    id: 'eq1',
    productId: 'jamon_materia_prima',
    fromUnit: 'Kg',
    toUnit: 'KG',
    ratio: 1,
    description: ''
  }
];

// 1. Math Validation
console.log("=== 1. VALIDACION MATEMATICA ===");
const cost = getOperationalCost({
  recipeItems: mockRecipe,
  settings: mockSettings,
  equivalences: mockEquivalences,
  allProducts: mockProducts,
  targetProduct: { unitType: 'KG', pesoObjetivoGramos: 1000 }, // Nominal weight = 1kg
  unitsProduced: 3,
  realWeightKg: 3.695
});

console.log("Materia Prima Cost:", cost.costoMateriaPrima.toFixed(2)); // Expected: 21431 (3.695 * 5800)
console.log("Embalaje Total:", cost.costoEmbalajeTotal.toFixed(2)); // Expected: 3*(55 + 0.25 + 0) = 165.75
console.log("Desglose Materia Prima:", JSON.stringify(cost.desgloseMateriaPrima, null, 2));
console.log("Desglose Embalaje:", JSON.stringify(cost.desgloseEmbalaje, null, 2));

// Let's add Folex to recipe since folex automatic requires recipe item:
const mockRecipeWithFolex: RecipeItem[] = [
  { ingredientProductId: 'jamon_materia_prima', quantity: 1, unit: 'Kg' },
  { ingredientProductId: 'folex_automatico', quantity: 1, unit: 'U' }, // 1 folex per unit
];

const costWithFolex = getOperationalCost({
  recipeItems: mockRecipeWithFolex,
  settings: mockSettings,
  equivalences: mockEquivalences,
  allProducts: mockProducts,
  targetProduct: { unitType: 'KG', pesoObjetivoGramos: 1000 }, // Nominal weight = 1kg
  unitsProduced: 3,
  realWeightKg: 3.695
});

console.log("\n--- Con Folex ---");
console.log("Materia Prima Cost:", costWithFolex.costoMateriaPrima.toFixed(2)); 
console.log("Insumos Cost:", costWithFolex.costoInsumosReceta.toFixed(2));
console.log("Embalaje Total:", costWithFolex.costoEmbalajeTotal.toFixed(2)); // Expected: 3*(55 + 0.25 + 7) = 3*62.25 = 186.75
console.log("Desglose Embalaje:", JSON.stringify(costWithFolex.desgloseEmbalaje, null, 2));

const totalCalc = costWithFolex.costoMateriaPrima + costWithFolex.costoInsumosReceta + costWithFolex.costoEmbalajeTotal;
console.log("Total Calculado:", totalCalc.toFixed(2));
console.log("Costo Operativo:", costWithFolex.costoOperativoTotal.toFixed(2));


// 2. Produccion vs Productos Validation
console.log("\n=== 2. VALIDACION PRODUCTOS VS PRODUCCION ===");
const targetProduct: Partial<Product> = { id: 'prod_1', unitType: 'KG', pesoObjetivoGramos: 1000, pricingMode: 'AUTO', margenDeseado: 30 };

const prodCost = getOperationalCost({
  recipeItems: mockRecipeWithFolex,
  settings: mockSettings,
  equivalences: mockEquivalences,
  allProducts: mockProducts,
  targetProduct: targetProduct,
  unitsProduced: 1
});

const presentationPrices = calculatePresentationPrices(targetProduct, mockRecipeWithFolex, mockSettings, mockEquivalences, mockProducts);

console.log("Produccion base cost (1 unit):", prodCost.costoOperativoTotal.toFixed(2));
const expectedProdCost = prodCost.costoMercaderia + prodCost.costoEmbalajeTotal;
console.log("Productos base cost:", (presentationPrices.costoMercaderia + presentationPrices.costoEmbalaje).toFixed(2));

const diff = Math.abs(expectedProdCost - (presentationPrices.costoMercaderia + presentationPrices.costoEmbalaje));
console.log("Diferencia:", diff.toFixed(5));
