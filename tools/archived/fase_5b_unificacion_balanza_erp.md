# Fase 5B: Unificación Definitiva Balanza - ERP (AL VACÍO)

## 🎯 Objetivo Logrado
Se implementó la arquitectura definitiva donde el **precioComercialKg** es la única fuente de la verdad para la valoración de los productos físicos, asegurando que el precio mostrado en la etiqueta de la balanza coincida matemáticamente con el ERP. 

Se abandonó la práctica donde las Listas de Precios reemplazaban el precio unitario. Ahora, el ERP calcula **Bonificaciones Comerciales** transparentes que se aplican al subtotal del documento, manteniendo el valor base oficial del producto inalterado.

---

## 🛠 Cambios Implementados

### 1. `core/calculations.ts` (Motor de Bonificaciones)
- Se creó la función centralizada `calculateCommercialBonification`.
- **Funcionamiento**: Recibe los ítems de venta con el precio base oficial, evalúa las políticas del cliente (Precio Especial o Lista de Precios), calcula cuál debería ser el valor del paquete según la lista, y devuelve un desglose completo:
  - `grossTotal`: Subtotal Bruto (Suma del precio base de balanza).
  - `commercialDiscount`: Bonificación Comercial (Diferencia a favor del cliente).
  - `netTotal`: Subtotal Neto.

### 2. `types/database.ts` (Ampliación del Modelo de Datos)
- Se actualizaron las interfaces `Sale` y `Order` asegurando retrocompatibilidad:
  - `grossTotal?`: Monto bruto valorado al precio de balanza.
  - `commercialDiscount?`: Descuento total calculado por listas de precios.
  - `netTotal?`: Monto luego de aplicar bonificaciones (sobre el cual luego puede aplicar un descuento manual adicional).
  - `subtotal` y `total` mantienen su funcionamiento histórico para no romper métricas pasadas.

### 3. `pages/Ventas.tsx` (Flujo Comercial Primario)
- Se eliminó la función heredada `getPriceHierarchy`.
- Los ítems de venta ahora obtienen directamente el precio oficial (`pres.precioComercialKg`).
- Durante la confirmación (`handleConfirmSale`), se invoca al motor de bonificaciones sobre los paquetes físicos seleccionados.
- **Generación de Remitos (PDF)**:
  - Se modificó la exportación y la previsualización del remito en A4.
  - El documento ahora desglosa explícitamente:
    1. **Subtotal Bruto** (Precio Balanza)
    2. **Bonificación Comercial** (Si aplica por lista de precios)
    3. **Descuento Manual** (Si aplica)
    4. **Total Neto**

### 4. `pages/Pedidos.tsx` (Intención de Compra)
- Se simplificó la selección de productos (`handleProductSelect`).
- Se eliminó el motor de listas de precios de la UI de estimación.
- Los pedidos ahora estiman su valor multiplicando el `precioComercialKg` por el peso teórico (`pesoObjetivoGramos`), asegurando coherencia visual con la futura carga en balanza.

### 5. `pages/Dashboard.tsx` (Inteligencia de Negocios)
- Se integró una nueva pestaña: **Análisis Comercial**.
- **Métricas incorporadas**:
  - **Venta Bruta (Oficial)**: Total facturado asumiendo precio de lista oficial.
  - **Bonificaciones Otorgadas**: Dinero resignado por aplicación de políticas comerciales.
  - **Venta Neta**: Dinero real cobrado.
  - **% Descuento Promedio**: Tasa general de bonificación sobre ventas brutas.
  - **Top Clientes por Bonificación**: Ranking de los 5 clientes que más beneficio de bonificación reciben.

---

## ✅ Impacto y Retrocompatibilidad
- **Firebase/Base de Datos**: No se requiere migración. Los registros nuevos guardan las propiedades extendidas, los antiguos ignoran el campo `commercialDiscount` manteniendo su integridad basada en el precio de guardado histórico.
- **TypeScript**: Compilación validada en 100%. `npm run build` fue exitoso sin errores (Exit code: 0).
- **Proceso Físico (Balanza)**: Resolvió la discrepancia. El etiquetador de planta pesa y emite a precio oficial. El administrativo despacha, el ERP respeta el precio unitario físico y aplica el descuento comercial (Bonificación) en el pie del remito.
