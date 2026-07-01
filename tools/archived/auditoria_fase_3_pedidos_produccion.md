# FASE 3A – REDISEÑO COMPLETO DE PEDIDOS, PRODUCCIÓN Y STOCK REAL POR PAQUETES

## 1. AUDITORÍA DEL SISTEMA ACTUAL

### 1.1 Módulo Pedidos
*   **Cómo se guardan actualmente:** En la colección `orders` de Firestore, con un array de `items`.
*   **Qué datos almacenan:** Guardan `productId` (referencia a la Presentación), `quantity` (cantidad de paquetes/unidades) y `price` (precio unitario teórico). 
*   **Unidad de medida:** Trabajan **por unidades** (cantidad de paquetes), no por kilogramos reales. El precio se calcula previamente multiplicando el `precioVentaKg` por el `pesoObjetivoGramos` (teórico) de la presentación.
*   **Relación con Producción:** Al pasar un pedido a estado `PRODUCIDO`, se generan movimientos de stock automáticos que descuentan materias primas (según receta teórica o ajustes manuales) e ingresan unidades de producto terminado.

### 1.2 Módulo Producción
*   **Descuento de materia prima:** Se calcula el consumo teórico (vía `getPresentationConsumption`) según las recetas. Genera un movimiento de `stock_movements` de tipo `out` por la cantidad total de Kg (con opción a `actualConsumptions`).
*   **Generación de producto terminado:** Agrega un movimiento de `stock_movements` de tipo `in` por la cantidad de **unidades** producidas (con opción a `actualProduced`).
*   **Impacto en stock:** Suma y resta cantidades en el ledger de movimientos. No hay registro de peso individual ni de lotes. Todo es acumulativo.

### 1.3 Módulo Stock
*   **Cómo se guarda el stock:** Mediante *Event Sourcing* (sumatoria de entradas y salidas en `stock_movements`).
*   **Presentaciones (Producto Terminado):** Se guardan **por unidades** (cantidad de paquetes).
*   **Mercaderías (Materias Primas):** Se guardan **por kg**.
*   **Insumos (Bolsas, Etiquetas):** Se guardan **por unidades**.
*   *Ausencia de trazabilidad:* Actualmente no hay registro por "lote", ni por "paquete individual". Una presentación de "Jamón Cocido" solo dice "Stock: 15 unidades", asumiendo que todas pesan su peso teórico.

### 1.4 Módulo Ventas
*   **Cálculo actual:**
    *   **Costo:** Se calcula el costo teórico de la presentación sumando el costo de las materias primas (proporcional al peso teórico) más insumos y mano de obra.
    *   **Precio:** Se basa en el precio teórico guardado en el pedido (Precio x Unidad teórica).
    *   **Utilidad:** Se deriva restando el Costo Teórico del Precio Teórico. Las diferencias de peso real de los paquetes se pierden, generando utilidades ficticias e imprecisiones en facturación.

---

## 2. MODELO OBJETIVO (PROPUESTA FASE 3A)

Para resolver la desviación entre el modelo teórico y la realidad física de AL VACÍO, el sistema debe evolucionar de un control por "Unidades Teóricas" a un control por **"Paquetes Físicos y Pesaje Real"**.

### PEDIDO
*   **Solicitud:** El cliente sigue pidiendo por unidades. Ejemplo: Juan solicita "10 paquetes de Jamón" y "5 paquetes de Queso".
*   **Registro:** El pedido registra la "intención" de compra (10 unidades), pero no fija un precio final cerrado ni un peso exacto. Se puede mostrar un precio "estimado" basado en el peso objetivo, pero el importe final queda pendiente de armado.

### PRODUCCIÓN
*   **Registro por Paquete:** Al finalizar la producción, el operario ya no ingresa "Produje 10 unidades". 
*   **Pesaje Real:** Debe registrar cada paquete generado de manera individual.
    *   *Paquete 1: 1,120 kg*
    *   *Paquete 2: 1,345 kg*
    *   *Paquete 3: 0,980 kg*
*   **Etiquetado/ID:** El sistema genera un identificador único (ej. Código de barras, QR o ID alfanumérico secuencial como `#001`, `#002`) para cada paquete producido.

### STOCK
*   **Almacenamiento Individual:** El stock de producto terminado deja de ser un simple número de unidades. Pasa a ser un inventario de paquetes específicos.
*   **Visualización:** El sistema mostrará:
    *   Jamón #001 - 1,120 kg
    *   Jamón #002 - 1,345 kg
    *   Jamón #003 - 0,980 kg
*   **Métricas de Stock:** Se podrán ver tanto "Unidades disponibles" (3 paquetes) como "Kg reales disponibles" (3,445 kg).

### VENTA
*   **Selección Dinámica:** Al momento de facturar o entregar el pedido, el armador selecciona los paquetes físicos que va a entregarle a Juan.
*   **Asignación:** Se escanean o seleccionan: Jamón #001 (1,120 kg).
*   **Cálculo Real:** El sistema multiplica el peso exacto del paquete por el precio por kg del cliente.
    *   *Importe del paquete = 1,120 kg × $ Precio/Kg*
*   **Exactitud:** El importe total de la venta, el costo exacto y la utilidad son 100% reales.

---

## 3. ANÁLISIS DEL IMPACTO

### Ventajas
1.  **Precisión Financiera Absoluta:** Se cobra exactamente lo que se entrega. Eliminación de las fugas de dinero por paquetes que pesan más del peso teórico.
2.  **Márgenes Reales:** El cálculo de rentabilidad deja de ser un estimado y pasa a ser exacto.
3.  **Control de Mermas:** Al conocer el peso exacto producido y el peso exacto de materia prima consumida, se puede calcular la merma real de producción por lote.

### Desventajas
1.  **Mayor carga operativa (Data Entry):** Exige pesar y registrar cada paquete individual en el sistema durante la producción.
2.  **Armado de Pedidos:** Obliga a "escanear" o seleccionar manualmente qué paquete se le da a qué cliente.
3.  **Complejidad del Software:** Requiere cambiar la arquitectura actual de `stock_movements` para soportar identificadores de lote/paquete y rediseñar los selectores en el módulo de ventas.

### Impacto en Costos
*   El costo unitario deja de depender del peso objetivo. El sistema deberá prorratear los costos fijos (bolsa, etiqueta, mano de obra) por unidad, y sumar el costo exacto de la materia prima multiplicado por el peso real de ese paquete.
*   Permitirá auditar qué productos están dando pérdida por excesos en el corte manual.

### Impacto en Trazabilidad
*   **Excelente.** Se logra trazabilidad de punta a punta. Si un cliente reclama por un paquete específico (ej. #001), se podrá saber exactamente qué día se produjo, en qué pedido y qué materia prima se utilizó.

### Impacto en Producción
*   Requiere que en la mesa de envasado haya una terminal (tablet/PC) y preferentemente una balanza conectada (o registro rápido). 
*   Se recomienda la generación de etiquetas con código de barras o QR para agilizar la posterior venta y evitar cuellos de botella en la expedición.
