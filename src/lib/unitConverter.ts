import type { Equivalencia, UnitType, Product } from '../types/domain';

export function calculateWeightInKg(cantidad: number, unidad?: string, product?: Product): number {
  if (!product) return Number(cantidad);
  const qty = Number(cantidad);
  const unit = String(unidad || product.unitType || 'KG').toUpperCase().trim();
  
  if (unit === 'KG') {
    return qty;
  }
  if (unit === 'GRAMOS') {
    return qty / 1000;
  }
  if (unit === 'UNIDADES') {
    if (product.pesoObjetivoGramos && product.pesoObjetivoGramos > 0) {
      return qty * (product.pesoObjetivoGramos / 1000);
    }
    return qty; // Fallback: 1 unidad = 1 kg
  }
  if (unit === 'FETAS') {
    const pesoFeta = product.pesoFeta || 20; // Default 20g
    return (qty * pesoFeta) / 1000;
  }
  return qty;
}

export function convertQuantityToBaseUnit(cantidad: number, itemUnidad?: string, product?: Product): number {
  if (!product) return Number(cantidad);
  
  const qty = Number(cantidad);
  const fromUnit = String(itemUnidad || product.unitType || 'KG').toUpperCase().trim();
  const toUnit = String(product.unitType || 'KG').toUpperCase().trim();
  
  if (fromUnit === toUnit) {
    return qty;
  }

  // If we are converting to KG:
  if (toUnit === 'KG') {
    return calculateWeightInKg(qty, itemUnidad, product);
  }

  // If we are converting to GRAMOS:
  if (toUnit === 'GRAMOS') {
    return calculateWeightInKg(qty, itemUnidad, product) * 1000;
  }

  // If we are converting to UNIDADES:
  if (toUnit === 'UNIDADES') {
    const pesoObjetivoGramos = product.pesoObjetivoGramos || 1000;
    if (fromUnit === 'KG') {
      const totalGramos = qty * 1000;
      return totalGramos / pesoObjetivoGramos;
    }
    if (fromUnit === 'GRAMOS') {
      return qty / pesoObjetivoGramos;
    }
    if (fromUnit === 'FETAS') {
      const pesoFeta = product.pesoFeta || 20;
      const totalGramos = qty * pesoFeta;
      return totalGramos / pesoObjetivoGramos;
    }
  }

  // If we are converting to FETAS:
  if (toUnit === 'FETAS') {
    const pesoFeta = product.pesoFeta || 20;
    const pesoObjetivoGramos = product.pesoObjetivoGramos || 1000;
    if (fromUnit === 'KG') {
      const totalGramos = qty * 1000;
      return totalGramos / pesoFeta;
    }
    if (fromUnit === 'GRAMOS') {
      return qty / pesoFeta;
    }
    if (fromUnit === 'UNIDADES') {
      const totalGramos = qty * pesoObjetivoGramos;
      return totalGramos / pesoFeta;
    }
  }

  return qty;
}


export function convertUnit(
  amount: number,
  fromUnit?: string,
  toUnit?: string,
  productName?: string,
  productCategory?: string,
  equivalences?: Equivalencia[]
): number {
  const amt = Number(amount);
  const from = String(fromUnit || '').toUpperCase().trim();
  const to = String(toUnit || '').toUpperCase().trim();
  const name = String(productName || '').toLowerCase();
  const cat = String(productCategory || '').toLowerCase();

  if (from === to) return amt;

  // 1. Convert to a common base (GRAMOS)
  let grams = 0;

  if (from === 'GRAMOS' || from === 'GRAMO') {
    grams = amt;
  } else if (from === 'KG' || from === 'KILOGRAMO' || from === 'KILOGRAMOS') {
    grams = amt * 1000;
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
    const equiv = (equivalences || []).find(e => {
      const orig = String(e.origen || '').toUpperCase().trim();
      const dest = String(e.destino || '').toUpperCase().trim();
      const isFetaToGram = (orig === 'FETA' || orig === 'FETAS') && (dest === 'GRAMOS' || dest === 'GRAMO');
      if (!isFetaToGram) return false;

      const eqName = String(e.nombre || '').toLowerCase();
      if (isCheese) {
        return eqName.includes('queso') || eqName.includes('tybo') || eqName.includes('cheddar');
      } else {
        return eqName.includes('jamón') || eqName.includes('jamon') || eqName.includes('fiambre') || eqName.includes('bondiola');
      }
    });

    if (equiv) {
      factor = Number(equiv.factor || factor);
    }

    grams = amt * factor;
  } else if (from === 'UNIDADES' || from === 'UNIDAD') {
    grams = amt; // fallback
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

  return amt; // Fallback
}
