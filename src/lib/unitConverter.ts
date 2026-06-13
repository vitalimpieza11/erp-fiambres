import type { Equivalencia, UnitType } from '../types/domain';

export function convertUnit(
  amount: number,
  fromUnit: UnitType,
  toUnit: UnitType,
  productName: string,
  productCategory: string,
  equivalences: Equivalencia[]
): number {
  const from = fromUnit.toUpperCase().trim();
  const to = toUnit.toUpperCase().trim();
  const name = productName.toLowerCase();
  const cat = (productCategory || '').toLowerCase();

  if (from === to) return amount;

  // 1. Convert to a common base (GRAMOS)
  let grams = 0;

  if (from === 'GRAMOS' || from === 'GRAMO') {
    grams = amount;
  } else if (from === 'KG' || from === 'KILOGRAMO' || from === 'KILOGRAMOS') {
    grams = amount * 1000;
  } else if (from === 'FETAS' || from === 'FETA') {
    // Determine the factor (grams per feta)
    let factor = 18; // Default for jamones/fiambres

    const isCheese = cat.includes('queso') || 
                     name.includes('queso') || 
                     name.includes('tybo') || 
                     name.includes('cheddar') || 
                     name.includes('pategras');

    if (isCheese) {
      factor = 20; // Default for cheese
    }

    // Try to find a custom equivalence in the database
    const equiv = equivalences.find(e => {
      const orig = e.origen.toUpperCase().trim();
      const dest = e.destino.toUpperCase().trim();
      const isFetaToGram = (orig === 'FETA' || orig === 'FETAS') && (dest === 'GRAMOS' || dest === 'GRAMO');
      if (!isFetaToGram) return false;

      const eqName = e.nombre.toLowerCase();
      if (isCheese) {
        return eqName.includes('queso') || eqName.includes('tybo') || eqName.includes('cheddar');
      } else {
        return eqName.includes('jamón') || eqName.includes('jamon') || eqName.includes('fiambre') || eqName.includes('bondiola');
      }
    });

    if (equiv) {
      factor = equiv.factor;
    }

    grams = amount * factor;
  } else if (from === 'UNIDADES' || from === 'UNIDAD') {
    // If we are converting units of a product (e.g. hormone or presentation), we might assume it's just raw amount.
    // However, if we need to convert to grams, we'll assume a default factor of 1000 or use the product weight if known.
    // In our context, packages/items are converted between UNIDADES directly.
    grams = amount; // fallback
  }

  // 2. Convert from the common base (GRAMOS) to target unit
  if (to === 'GRAMOS' || to === 'GRAMO') {
    return grams;
  } else if (to === 'KG' || to === 'KILOGRAMO' || to === 'KILOGRAMOS') {
    return grams / 1000;
  } else if (to === 'FETAS' || to === 'FETA') {
    let factor = 18;
    const isCheese = cat.includes('queso') || 
                     name.includes('queso') || 
                     name.includes('tybo') || 
                     name.includes('cheddar') || 
                     name.includes('pategras');

    if (isCheese) factor = 20;

    const equiv = equivalences.find(e => {
      const orig = e.origen.toUpperCase().trim();
      const dest = e.destino.toUpperCase().trim();
      const isFetaToGram = (orig === 'FETA' || orig === 'FETAS') && (dest === 'GRAMOS' || dest === 'GRAMO');
      if (!isFetaToGram) return false;

      const eqName = e.nombre.toLowerCase();
      if (isCheese) {
        return eqName.includes('queso') || eqName.includes('tybo') || eqName.includes('cheddar');
      } else {
        return eqName.includes('jamón') || eqName.includes('jamon') || eqName.includes('fiambre');
      }
    });

    if (equiv) factor = equiv.factor;

    return grams / factor;
  }

  return amount; // Fallback
}
