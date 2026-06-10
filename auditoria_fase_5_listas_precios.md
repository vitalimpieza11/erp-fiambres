# FASE 5A – AUDITORÍA Y REDISEÑO DEFINITIVO DEL MÓDULO DE LISTAS DE PRECIOS

## 1. ORIGEN DE LOS PRECIOS

### Colecciones y Documentos Involucrados
*   **`presentaciones` y `mercaderias`**: Actúan como la fuente del "Precio Base". Almacenan los campos `precioComercialKg` (precio real/oficial) y `precioSugeridoKg` (referencia basada en costo + margen).
*   **`priceLists`**: Almacena las Listas de Precios. Cada documento contiene un margen general (`margin`) y un diccionario de excepciones (`productOverrides`) que guarda márgenes específicos o precios fijos manuales (`manualPrice`) por producto.
*   **`customers`**: Vincula a cada cliente con una lista mediante `priceListId`. También posee un diccionario `specialPrices` para precios ultra-específicos (por cliente y producto).
*   **`sales` y `orders`**: Capturan el precio final resuelto en el momento de la operación y lo guardan estáticamente en los items (`price`).

### Ejemplo de Estructura de Datos (PriceList)
```json
{
  "name": "Lista Mayorista",
  "margin": 30,
  "mode": "auto",
  "productOverrides": {
    "pres_123": {
      "margin": 25,
      "mode": "auto",
      "itemType": "presentacion"
    },
    "pres_456": {
      "manualPrice": 8500,
      "mode": "manual",
      "itemType": "presentacion"
    }
  }
}
```

---

## 2. FLUJO DE GUARDADO

### Análisis de `Precios.tsx` y `usePriceLists.ts`
1.  **Edición**: Al modificar un precio general o individual en la interfaz de Precios, el sistema calcula un precio "auto" basado en el costo del producto y el margen deseado (`costo / (1 - margen / 100)`).
2.  **Modo Manual**: Si el usuario usa herramientas de redondeo o fija un precio a mano, el ítem cambia a `mode: 'manual'` y se guarda en `manualPrice`.
3.  **Persistencia**: Se guarda en la colección `priceLists`. Solo se guardan en `productOverrides` aquellos productos que difieren de la regla general de la lista.
4.  **Consumo**: Este documento es consumido en tiempo real por `Ventas.tsx` y `Pedidos.tsx`.
5.  **Riesgos Detectados**:
    *   **Campos legacy**: El campo `type` (`presentaciones` | `mercaderias`) en `priceLists` está obsoleto y fue reemplazado por `includedTypes`. Sin embargo, hay código de retrocompatibilidad mapeando esto.
    *   **Desincronización de Costos**: Si el costo de un insumo sube, el precio `auto` sube automáticamente. Pero si un producto está en `mode: 'manual'`, su precio queda estático. Si el costo supera el `manualPrice`, el sistema permite vender a pérdida (aunque muestra una advertencia al guardar la lista, no bloquea ventas futuras si el costo sube después de guardar).

---

## 3. PRECIOS POR CLIENTE

Actualmente, el vínculo y la resolución de precios sigue una jerarquía estricta.

**Flujo de Resolución (de mayor a menor prioridad):**
1.  **Precio Especial del Cliente**: Se verifica si `customer.specialPrices[productId]` existe. (Gana sobre todo).
2.  **Lista de Precios del Cliente**: Se verifica si `customer.priceListId` tiene un override para el producto, o en su defecto, aplica el margen general de esa lista.
3.  **Precio Base Oficial**: Se usa el `precioComercialKg` de la colección `presentaciones`.
4.  **Fallback**: Costo de producción * 1.4 (Margen sugerido por defecto si nada de lo anterior existe).

---

## 4. PRECIOS UTILIZADOS EN VENTAS (`Ventas.tsx`)

En el momento de crear una venta, el sistema ejecuta la función `getPriceHierarchy` (que implementa la lógica del punto 3).
*   **Origen**: Toma el precio resuelto y lo asigna al campo `precioComercialKg` del estado temporal del formulario.
*   **Guardado**: Al confirmar la venta, se multiplica este precio por el `pesoRealTotal` de los paquetes seleccionados. El precio unitario guardado en la BD es el promedio final (`amount / selectedPackages.length`).
*   **Problema de Trazabilidad**: Una vez guardada la venta, se pierde el rastro de *por qué* tuvo ese precio (el campo `priceOrigin` solo vive en el estado de la UI, no se guarda en Firestore).

---

## 5. PRECIOS UTILIZADOS EN PEDIDOS (`Pedidos.tsx`)

*   **Lógica**: Utiliza un bloque de código casi idéntico al de Ventas (`handleProductSelect`) para resolver la jerarquía de precios.
*   **Uso del Precio**: Funciona únicamente como una **Intención de Compra**.
*   **Diferencia Venta vs Pedido**: El pedido calcula un subtotal teórico basado en "unidades solicitadas". La venta factura paquetes reales usando su "peso real en kg". Como el peso real varía, el subtotal final de la venta siempre diferirá ligeramente del pedido original.

---

## 6. RELACIÓN CON LA BALANZA (INCONSISTENCIA CRÍTICA)

Esta es la discrepancia más grave detectada para el modelo de "Al Vacío".

*   **Realidad Física**: La balanza imprime etiquetas con el peso y un precio total calculado en base al **Precio Base** (`precioComercialKg` cargado manualmente en la balanza).
*   **Realidad del ERP**: Si al Cliente "A" se le asigna la "Lista Mayorista" (que tiene precios más bajos), el ERP facturará el paquete usando el precio de la lista.
*   **El Problema**: El paquete físico dirá "$10,000", pero en el remito/factura del ERP ese mismo paquete aparecerá a "$8,500". Esto genera confusión en el cliente final y rompe la conciliación entre la mercadería física y el remito.

---

## 7. PROPUESTA DEFINITIVA PARA "AL VACÍO"

Para que la Balanza y el ERP hablen el mismo idioma sin confundir al cliente, se debe cambiar el paradigma de aplicación de Listas de Precios.

### Diseño del Modelo Ideal
1.  **Unidad de Precio Única (Item Level)**: En las líneas de la factura/remito (Items), el `precioComercialKg` DEBE SER EXACTAMENTE EL MISMO que el de la Balanza. El paquete físico y la línea del remito deben coincidir al centavo.
2.  **Listas de Precio como Bonificaciones (Document Level)**: Las listas de precios por cliente no deben alterar el precio unitario del ítem. En su lugar, el ERP debe calcular la diferencia entre el "Precio Base (Balanza)" y el "Precio de la Lista del Cliente", y aplicar esa diferencia como una **Bonificación Comercial / Descuento** al final de la factura.
3.  **Transparencia**: El cliente recibe un remito que dice:
    *   Paquete Jamón 1.2kg x $10,000/kg = $12,000 (Coincide con la etiqueta).
    *   Bonificación "Lista Mayorista" = -$1,800.
    *   Total a Pagar = $10,200.

---

## 8. IMPLEMENTACIÓN FUTURA (PLAN DE ACCIÓN)

*NOTA: No implementar cambios todavía.*

**Fase 1: Refactorización de Jerarquías en UI**
*   **Archivos afectados**: `Ventas.tsx`, `Pedidos.tsx`.
*   **Migración**: Modificar `getPriceHierarchy` para que retorne siempre el `precioComercialKg` base para la línea del producto.

**Fase 2: Motor de Bonificaciones (Descuentos en cascada)**
*   **Archivos afectados**: `core/calculations.ts`.
*   **Lógica**: Crear una función que reciba el carrito (con precios base), evalúe la Lista de Precios del Cliente, y devuelva un objeto `DescuentosAplicados` para ser restado del subtotal.

**Fase 3: Actualización del Modelo de Datos**
*   **Archivos afectados**: `types/database.ts`, `useSales.ts`, generadores de PDF (`exportRemitoPDF`).
*   **Cambio**: El objeto `Sale` debe incluir un desglose de bonificaciones comerciales, separado del descuento manual (`discount`).

**Fase 4: Depuración de Precios.tsx**
*   **Archivos afectados**: `Precios.tsx`, `usePriceLists.ts`.
*   **Limpieza**: Eliminar código legacy (`type: 'presentaciones'`) y consolidar el uso estricto de `includedTypes`. Asegurar que las listas se traten conceptualmente como "Reglas de Descuento/Margen sobre Costo" que impactan en el pie de la factura.
