# Auditoría Técnica: Módulo Listas de Precios

A continuación, se detalla el análisis de causa raíz para los dos problemas reportados, sin proponer ni implementar modificaciones de código, únicamente documentando el estado actual de la arquitectura.

---

## BUG 1: Al editar una lista de precios y presionar GUARDAR, los cambios no persisten

### Análisis del Flujo de Guardado
1. **Botón Guardar UI**: En `Precios.tsx` (aprox. línea 578), el botón "Guardar Cambios" NO ejecuta el guardado directamente, sino que llama a la función `handleReviewChanges`.
2. **Función Ejecutada**: `handleReviewChanges` abre un modal de revisión (`showReviewModal`). El usuario debe hacer clic en "Confirmar y Guardar" dentro de ese modal para recién ejecutar la función `handleSavePrices`.
3. **Objeto Enviado**: `updatedList`, el cual contiene `name, target, mode, margin, isActive, includedTypes, productOverrides`. Notablemente, la propiedad legacy `type` está comentada y no se envía.
4. **Ejecución en Firebase**: `savePriceList` en `usePriceLists.ts` SÍ ejecuta `updateDoc` si existe el `id`.

### Causa Raíz Detectada (Por qué no persisten los cambios)
El problema principal radica en cómo se reconstruye el objeto `productOverrides` en `handleSavePrices` (`Precios.tsx`, línea 287) y el uso parcial de `updateDoc`:

1. **Pérdida de Overrides por Filtro de Estado**: `handleSavePrices` itera EXCLUSIVAMENTE sobre `priceItems`. Si el usuario destilda un grupo entero de productos (por ejemplo, quita "Mercaderías" de `includedTypes`), la función `handleTypeToggle` elimina inmediatamente esos productos de `priceItems`. Como resultado, al iterar `priceItems` para armar los `overrides` a guardar, **se ignoran y eliminan por completo** todos los ajustes manuales y configuraciones previas de esos productos. Cuando se guarda, los cambios previos de esos ítems se borran de Firebase de forma silenciosa.
2. **Persistencia sobre Estructura Legacy**: Al omitir la propiedad `type` en `updatedList` (`Precios.tsx`, línea 301), Firebase `updateDoc` NO elimina el campo legado `type` del documento. Al recargar, `usePriceLists.ts` sigue encontrando `legacyType` y ejecuta compatibilidad retroactiva (`Precios.tsx` línea 108), lo que puede sobrescribir las lógicas nuevas si la estructura heredada no se limpia explícitamente con `deleteField()`.

---

## BUG 2: Al destildar productos de una lista y generar PDF, aparecen TODOS los productos

### Análisis del Flujo de Exportación
1. **Origen de Datos del PDF**: La función `exportPDF` (`Precios.tsx`, línea 417) obtiene la data llamando a la función auxiliar `getListProducts`.
2. **Colección Utilizada**: `getListProducts` (`Precios.tsx`, línea 349) consulta directamente los estados globales `presentaciones` y `mercaderias`.

### Causa Raíz Detectada (Por qué aparecen productos destildados)
1. **Ignora `includedTypes`**: La función `getListProducts` NO recibe ni evalúa la variable `includedTypes` de la lista actual. Simplemente mapea todos los elementos de `presentaciones` y `mercaderias` sin importar si la lista tiene deshabilitada toda la categoría (ej. si la lista era sólo de presentaciones, `getListProducts` igual itera sobre todas las mercaderías).
2. **El Fallback de Overrides**: `getListProducts` depende únicamente del objeto `overrides` para saber si un ítem está excluido (`isExcluded = overrides?.[p.id!]?.excluded ?? false`). Sin embargo, cuando se destilda una categoría entera de la lista, el sistema no agrega `excluded: true` a los overrides de esos ítems; simplemente los elimina de `priceItems`. Como no están en los overrides con la marca explícita de exclusión, el filtro final de `getListProducts` los considera activos y **agrega todos los productos al PDF**.

**Archivo involucrado**: `src/pages/Precios.tsx`
**Funciones involucradas**: `getListProducts` y `exportPDF`.
**Solución Técnica Exacta Requerida**: `getListProducts` debe recibir el array `includedTypes` y envolver el mapeo de `presentaciones` y `mercaderias` dentro de condicionales que validen si el `itemType` está efectivamente incluido en `includedTypes`. Además, `handleSavePrices` requerirá un mecanismo para preservar los overrides de los ítems que no están actualmente en `priceItems` pero pertenecen a tipos excluidos temporalmente.
