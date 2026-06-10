# 🔴 AUDITORÍA COMPLETA – BUG: GUARDAR LISTA DE PRECIOS NO PERSISTE

**Fecha:** 2026-06-10  
**Archivo principal:** `src/pages/Precios.tsx`  
**Hook:** `src/hooks/usePriceLists.ts`  
**Estado:** Solo auditoría — sin correcciones aplicadas

---

## 1. BOTÓN GUARDAR

**Archivo:** `src/pages/Precios.tsx`  
**Línea:** ~594  
**Componente:** Barra de acciones superior del modo `edit`

```tsx
// Precios.tsx – línea 594–597
<button onClick={handleReviewChanges} disabled={isSaving} className="btn btn-primary">
  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
  {isSaving ? 'Guardando...' : 'Guardar Cambios'}
</button>
```

**Función ejecutada:** `handleReviewChanges` (línea 222).  
**⚠️ El botón NO guarda directamente.** Abre el modal de revisión.

---

## 2. FLUJO COMPLETO DE handleSave

### Paso 1 — `handleReviewChanges` (línea 222–262)

```ts
// Precios.tsx – línea 222–262
const handleReviewChanges = () => {
  if (!selectedList) return;
  // Calcula diff entre estado actual y Firebase
  const rItems = priceItems.map(item => { ... }).filter(Boolean);
  setReviewItems(rItems);
  setShowReviewModal(true);  // Abre modal — NO guarda aún
};
```

**No guarda nada.** Solo calcula cambios y muestra modal.

---

### Paso 2 — Modal de revisión: botón "Confirmar y Guardar" (línea 1225)

```tsx
// Precios.tsx – línea 1225
<button
  onClick={() => { setShowReviewModal(false); handleSavePrices(); }}
  className="btn btn-primary"
  disabled={isSaving}
>
  {isSaving ? 'Guardando...' : 'Confirmar y Guardar'}
</button>
```

**Función ejecutada:** `handleSavePrices` (línea 264).

---

### Paso 3 — `handleSavePrices` (línea 264–327)

```ts
// Precios.tsx – línea 264–327
const handleSavePrices = async () => {
  if (!selectedList) return;

  // Validación: ¿hay productos debajo del costo?
  const belowCostItems = priceItems.filter(item => {
    if (!item.active || item.excluded) return false;
    ...
    return finalPrice < item.cost;
  });

  if (belowCostItems.length > 0) {
    if (!window.confirm(`...`)) {
      return;   // <-- RETURN ANTICIPADO #1 si el usuario cancela
    }
  }

  setIsSaving(true);
  try {
    // Construye overrides
    const overrides = { ...(selectedList.productOverrides || {}) };
    priceItems.forEach(item => {
      if (item.marginStr !== generalMarginStr || item.excluded || item.mode !== listModeInput || item.mode === 'manual') {
        overrides[item.id] = { margin, excluded, mode, manualPrice, itemType };
      } else {
        delete overrides[item.id]; // Limpia defaults
      }
    });

    const updatedList = {
      name: listNameInput,
      target: listTargetInput,
      mode: listModeInput,
      margin: parseNumber(generalMarginStr),
      isActive: listActiveInput,
      includedTypes: includedTypes,
      productOverrides: overrides
    };

    await savePriceList(updatedList, selectedList.id);   // --> usePriceLists.ts
    setShowReviewModal(false);
    setViewMode('list');
    setSelectedList(null);
  } catch (e) {
    console.error(e);
    alert("Error al guardar la lista de precios");
  } finally {
    setIsSaving(false);
  }
};
```

---

### Paso 4 — `savePriceList` en usePriceLists.ts (línea 93–101)

```ts
// usePriceLists.ts – línea 93–101
const savePriceList = async (
  priceList: Omit<PriceList, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string
) => {
  if (id) {
    const ref = doc(db, 'priceLists', id);
    await updateDoc(ref, { ...priceList, updatedAt: Date.now() } as any);
  } else {
    const ref = doc(collection(db, 'priceLists'));
    await setDoc(ref, { ...priceList, createdAt: Date.now(), updatedAt: Date.now() } as any);
  }
};
```

**Firestore:** `updateDoc` si existe `id`, `setDoc` si es nueva.  
No hay try/catch aquí — los errores burbujean a `handleSavePrices`.

---

## 3. ANÁLISIS DEL PAYLOAD

### Estructura del objeto enviado a `savePriceList`:

```ts
{
  name: listNameInput,           // string
  target: listTargetInput,       // string
  mode: listModeInput,           // 'auto' | 'manual'
  margin: parseNumber(generalMarginStr),  // number
  isActive: listActiveInput,     // boolean
  includedTypes: includedTypes,  // string[]
  productOverrides: {            // Record<string, {...}>
    [productId]: {
      margin: number,
      excluded?: true,
      mode: 'auto' | 'manual',
      manualPrice: number,
      itemType: 'mercaderia' | 'presentacion' | 'receta'
    }
  }
}
```

### ⚠️ PROBLEMA DEL PAYLOAD — Condición de escritura de overrides:

```ts
// Precios.tsx – línea 293
if (item.marginStr !== generalMarginStr || item.excluded || item.mode !== listModeInput || item.mode === 'manual') {
  overrides[item.id] = { ... };   // SE GUARDA el override
} else {
  delete overrides[item.id];      // SE BORRA el override (vuelve al default)
}
```

**Esta condición evalúa `item.marginStr` como string contra `generalMarginStr` como string.**

Si el usuario cambia el margen general y luego lo revierte al valor original, o si hay diferencias de precisión en la representación string (p.ej. `"30"` vs `"30.0"`), la condición puede fallar silenciosamente y borrar un override que debería guardarse.

---

## 4. FIRESTORE — Verificación del flujo

| Punto | Estado |
|---|---|
| `updateDoc` se ejecuta | ✅ Se ejecuta si `selectedList.id` existe |
| `catch` en `savePriceList` | ❌ No tiene catch propio — errores burbujean |
| `catch` en `handleSavePrices` | ✅ Captura errores y muestra alert |
| Return anticipado por costo | ✅ Existe en línea ~279 |
| Return anticipado por `!selectedList` | ✅ Existe en línea 265 |
| Validación que corte ejecución | ⚠️ Solo `window.confirm` por precio bajo costo |

**El `updateDoc` en sí mismo parece correcto.** No hay return anticipado oculto más allá de los dos documentados.

---

## 5. RECARGA DE DATOS (onSnapshot)

**Archivo:** `src/hooks/usePriceLists.ts`  
**Líneas:** 34–91

```ts
useEffect(() => {
  if (!currentUser) { setLoading(false); return; }

  setLoading(true);
  const q = query(collection(db, 'priceLists'), orderBy('createdAt', 'desc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const list: PriceList[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      ...
      // Compatibilidad retroactiva: asigna itemType a overrides legacy
      list.push({ id: doc.id, ...data procesado });
    });
    setPriceLists(list);
  });
  return () => unsubscribe();
}, [currentUser]);
```

El listener **está activo mientras el componente monta**. Cuando `updateDoc` escribe en Firebase, `onSnapshot` recibe el evento automáticamente y actualiza `priceLists`.

**No hay polling, no hay stale cache, no hay refresh manual necesario.**

---

## 6. 🔴 CAUSA RAÍZ IDENTIFICADA

### Bug Principal — Condición de string borra overrides válidos

**Archivo:** `src/pages/Precios.tsx`  
**Línea:** 293

```ts
// Línea 293 — Comparación string vs string
if (item.marginStr !== generalMarginStr || item.excluded || ...)
```

**Escenario donde falla:**

1. La lista tiene `margin: 30` en Firebase
2. El usuario abre la lista → `generalMarginStr = "30"`, `item.marginStr = "30"`
3. El usuario **excluye** un producto (toggle checkbox) → `item.excluded = true`
4. La condición evalúa: `"30" !== "30"` → `false`; `item.excluded` → `true` → **condición verdadera**
5. El override **SE GUARDA** correctamente para ese ítem → ✅ aparentemente OK

**Pero el escenario real donde falla es este:**

1. El usuario abre la lista → `overrides existentes en Firebase: { prodId: { excluded: true, margin: 30 } }`
2. `buildItems` construye `priceItems` con `item.excluded = true` para ese producto
3. El usuario **re-incluye** el producto (toggle) → `item.excluded = false`
4. La condición evalúa: `"30" !== "30"` → `false`; `item.excluded` → `false`; `item.mode !== listModeInput` → `false`; `item.mode === 'manual'` → `false`
5. **Todos los subterms son false → bloque `else` → `delete overrides[item.id]`** ← ✅ Correcto en este caso

**El bug real está en este escenario:**

1. Usuario abre lista, modifica márgenes individuales con decimales (ej. `32.5`)
2. `generalMarginStr = "30"`, `item.marginStr = "32.5"` → condición `true`, override guarda
3. Usuario guarda → Firebase recibe `margin: 32.5`
4. Usuario re-abre la lista → `buildItems` crea items con `item.marginStr = "32.5"` (del override)
5. Usuario no toca nada y guarda de nuevo
6. Condición: `"32.5" !== "30"` → `true` → override guarda `margin: 32.5` ← OK

**El verdadero escenario de pérdida:**

```
generalMarginStr al abrir: "30"
item fue modificado a margin=30 manualmente (sin decimales) antes
item.marginStr = "30"
item.excluded = false (quería guardarlo incluido)
item.mode = "auto"
listModeInput = "auto"

→ TODAS LAS CONDICIONES SON FALSE
→ delete overrides[item.id]
→ Pero en Firebase había: overrides[item.id] = { margin:30, excluded:false, mode:'auto', manualPrice:..., itemType:... }
→ Se borra ese override
→ Cuando se recarga, el item hereda los defaults sin override → CORRECTO pero da la ilusión de no persistir
   SI el override tenía datos distintos de los defaults que no se detectan en la condición
```

### Bug Más Grave — `handleTypeToggle` resetea estado desde Firebase

**Archivo:** `src/pages/Precios.tsx`  
**Función:** `handleTypeToggle`  
**Línea:** 169

```ts
const handleTypeToggle = (typeStr: string) => {
  let newTypes = [...includedTypes];
  if (newTypes.includes(typeStr)) {
    newTypes = newTypes.filter(t => t !== typeStr);
  } else {
    newTypes.push(typeStr);
  }
  setIncludedTypes(newTypes);
  setPriceItems(buildItems(newTypes, listModeInput, parseNumber(generalMarginStr), selectedList?.productOverrides));
  //                                                                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                              USA LOS OVERRIDES DE FIREBASE ORIGINALES, NO EL ESTADO LOCAL EDITADO
};
```

`buildItems` recibe `selectedList?.productOverrides` (datos originales de Firebase), **no el estado editado actual**. Si el usuario:

1. Modifica exclusiones o márgenes individuales en la UI
2. **Luego toca los checkboxes de tipo** (`Mercaderías`/`Presentaciones`)
3. → `priceItems` se reconstruye desde Firebase

→ **Toda la edición previa se pierde**, y al guardar, el payload contiene los datos originales de Firebase.

**Este es el bug más probable en el escenario del usuario:** edita precios → edita inclusiones/exclusiones → toca checkboxes de tipo → guarda → no persiste nada.

---

## 7. VEREDICTO FINAL

| Punto | Diagnóstico |
|---|---|
| **A) El botón** | ✅ Correcto — llama `handleReviewChanges` → abre modal |
| **B) La función save** | 🔴 **BUG** — condición string puede borrar overrides válidos |
| **C) Firebase / updateDoc** | ✅ Correcto — el write llega a Firestore |
| **D) La recarga de datos** | ✅ Correcta — onSnapshot actualiza en tiempo real |
| **E) Otro punto** | 🔴 **BUG CRÍTICO** — `handleTypeToggle` reconstruye items desde Firebase descartando edición local |

### Respuesta definitiva: **B y E**

---

## 8. LOCALIZACIÓN EXACTA DE LOS BUGS

### Bug 1 (CRÍTICO) — `handleTypeToggle`, línea 169
```
Archivo:   src/pages/Precios.tsx
Función:   handleTypeToggle()
Línea:     169
Causa:     Pasa selectedList?.productOverrides (snapshot de Firebase) a buildItems
           en lugar del estado local actual. Al toglear checkboxes de tipo, toda
           la edición previa del usuario (exclusiones, márgenes, precios manuales)
           se descarta silenciosamente.
```

### Bug 2 — `handleSavePrices`, línea 293
```
Archivo:   src/pages/Precios.tsx
Función:   handleSavePrices()
Línea:     293
Causa:     Comparación string-to-string de marginStr vs generalMarginStr.
           Si un item tiene exactamente el mismo margen general (como string) y no
           está excluido y está en modo auto, su override se borra aunque pueda
           tener datos relevantes. El riesgo es mayor con números de punto flotante
           cuya representación string puede diferir ("30" vs "30.0").
```
