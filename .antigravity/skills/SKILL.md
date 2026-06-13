---
name: erp-fiambres-maintenance
description: Core skills and operational knowledge for maintaining the erp-fiambres V2 codebase.
---

# Skill: Mantenimiento del ERP Al Vacío V2

Esta skill describe las competencias operativas, flujos de cálculo y consideraciones de diseño necesarias para dar mantenimiento, corregir errores o añadir nuevas características al sistema de gestión de Al Vacío.

---

## 1. Flujo de Producción y Deducción de Stock

Al programar o modificar el motor de producción, se debe seguir estrictamente este flujo de cálculo de capacidad y deducción de stock:

1. **Lectura de la Receta**: Se obtienen los ingredientes del arreglo `recipeItems` del producto terminado (tipo `PRESENTACION`).
2. **Conversión de Medidas**:
   - La cantidad requerida en la receta (`RecipeItem.quantity`) y el stock del insumo (`Product.stockActual`) pueden tener diferentes unidades (ej. receta en gramos e insumo en KG).
   - Se debe llamar a `convertUnit` de `src/lib/unitConverter.ts` para homologar la cantidad antes de realizar restas o estimar capacidades.
3. **Cálculo de Capacidad Máxima**:
   - `capacidadIngrediente = stockActual / cantidadConvertida`
   - La capacidad máxima del lote es el menor valor de `capacidadIngrediente` entre todos los ingredientes de la receta (limitante).
4. **Descuento Atómico**:
   - El stock de cada insumo se reduce proporcionalmente multiplicando la cantidad convertida por el tamaño del lote producido.
   - Las operaciones de inventario deben registrarse tanto en `stockActual` del producto como en la colección `stock_movements`.

---

## 2. Derivación Dinámica de Saldos Comerciales

Para evitar inconsistencias financieras, **nunca se debe leer un saldo acumulado estático de un socio, cliente o proveedor**. El saldo debe derivarse en tiempo de ejecución a partir de su historial de movimientos:

- **Cuenta Corriente de Clientes**:
  - `saldo = sum(DEUDAS) + sum(AJUSTES_POSITIVOS) - sum(PAGOS) - sum(AJUSTES_NEGATIVOS)`
- **Cuenta Corriente de Proveedores**:
  - `saldo = sum(COMPRAS) + sum(AJUSTES_POSITIVOS) - sum(PAGOS) - sum(AJUSTES_NEGATIVOS)`
- **Cuenta Corriente de Socios**:
  - `saldo = sum(APORTES) + sum(AJUSTES_POSITIVOS) - sum(RETIROS) - sum(AJUSTES_NEGATIVOS)`

*Cualquier anulación de movimiento comercial genera un registro compensatorio de tipo `ANULACION` o `AJUSTE` inverso en la cuenta corriente, y si corresponde, un movimiento inverso en `caja_movements`.*

---

## 3. Emisión de Comprobantes PDF

El ERP utiliza `jsPDF` y `jspdf-autotable` para exportar remitos y listas de precios:
- **Estilo**: Membrete alineado al centro en negrita, tablas con cabeceras en color negro (`[0, 0, 0]`) y filas alternadas con fondo gris muy claro (`[252, 252, 252]` o `[250, 250, 250]`).
- **Precios del Cliente**: Al exportar listas de precios, se resuelven los valores personalizados del cliente cruzándolos con sus registros específicos de `price_lists`, recurriendo a la lista general o al precio comercial sugerido del producto si no hay coincidencias.

---

## 4. Renderizado Seguro y Prevención de Crashes

- **Conversión de Fechas**: Evitar llamar a `.toLocaleDateString()` o `.toLocaleTimeString()` directamente sobre cadenas de base de datos sin validar. Usar siempre funciones seguras que verifiquen si el objeto Date es válido:
  ```typescript
  const formatDate = (dateStr: any) => {
    if (!dateStr) return 'S/D';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'S/D' : d.toLocaleDateString();
  };
  ```
- **Filtros de Stock**: Mantener siempre las opciones del selector de tipo de stock sincronizadas con los tipos de dominio (`MERCADERIA`, `INSUMO`, `PRESENTACION`).
