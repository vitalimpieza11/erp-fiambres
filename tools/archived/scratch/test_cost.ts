import { calculateProductionCostDetails } from '../src/utils/costHelpers';

const mockTargetProduct = {
  id: "target1",
  nombre: "Combinado",
  type: "PRESENTACION" as any,
  unitType: "UNIDADES" as any,
  activo: true
};

const mockIngredient = {
  id: "xvIayEwfNdNpTtI1Fajg",
  nombre: "Jamon cocido TRECER",
  type: "MERCADERIA" as any,
  unitType: "KG" as any,
  costoActual: 5800,
  activo: true
};

const mockRecipeItems = [
  {
    ingredientProductId: "xvIayEwfNdNpTtI1Fajg",
    ingredientName: "Jamon cocido TRECER",
    quantity: 1,
    unit: "kilogramos" as any
  }
];

const mockEquivalences: any[] = [];
const prodQty = 2; // Cantidad solicitada = 2 paquetes
const prodWeightKg = 2.815; // Peso real total = 2.815 kg

console.log("----- INICIANDO PRUEBA -----");

const result = calculateProductionCostDetails(
  mockRecipeItems,
  prodQty,
  prodWeightKg,
  mockTargetProduct,
  [mockIngredient],
  mockEquivalences
);

console.log("----- RESULTADO -----");
console.log(JSON.stringify(result, null, 2));
