# Auditoría Funcional Fase 4A - Gerencia, Rentabilidad y Dashboards

Esta auditoría describe el estado actual de los módulos gerenciales, financieros y operativos del ERP, analizando cómo se calculan los indicadores clave de negocio, identificando el nivel de confiabilidad de la información e indicando qué elementos faltan o requieren mejoras.

## 1. Dashboard Principal (Ejecutivo)
- **Qué indicadores muestra actualmente:**
  - Dinero Disponible (Liquidez).
  - Ganancia Acumulada.
  - Evolución Patrimonial (Valor de Empresa).
  - Deudas / Obligaciones.
  - Top Productos Rentables y Menos Rentables.
  - Stock Valorizado (Mercadería, Insumos, Producto Terminado).
  - Flujo de Fondos Proyectado (7, 15, 30 días).
- **Qué datos utiliza:**
  - Colecciones principales: `cash_movements`, `sales`, `customers`, `suppliers`, `mercaderias`, `insumos`, `presentaciones`, `stock`.
- **Qué indicadores faltan:**
  - Alertas de stock mínimo.
  - Análisis de rentabilidad por cliente o por canal de venta.
  - Tasa de morosidad o envejecimiento de deudas de clientes.

## 2. Ventas
- **Cómo calcula facturación:**
  - Se calcula a través del peso real físico de los paquetes seleccionados (`selectedPackagesWeight`) multiplicado por el precio por Kg asignado (`precioComercialKg`).
- **Cómo calcula margen:**
  - En la venta, el sistema determina el precio con una jerarquía: 1° Precio especial de cliente, 2° Lista de Precios (override/margen), 3° Precio Base sugerido (Costo * 1.4). El margen porcentual se reporta en el Dashboard comparando el Costo del paquete físico contra su Precio de Venta Realizado.
- **Cómo calcula utilidad:**
  - Utilidad Neta (Ganancia) = Total Venta - Costo Total de los paquetes físicos despachados.

## 3. Clientes
- **Cómo calcula deuda y saldo pendiente:**
  - El Dashboard suma la propiedad `currentBalance` del perfil de cada cliente (`cobrosPendientes`). En la base financiera también se evalúan pasivos.
- **Cómo calcula cobranzas:**
  - A través de la cancelación de la cuenta corriente y la generación de un movimiento de ingreso en `cash_movements` (no se visualiza un esquema complejo de recibos separados o múltiples imputaciones parciales robustas).

## 4. Proveedores
- **Cómo calcula deuda y saldo pendiente:**
  - Utiliza un mix entre el `currentBalance` del proveedor y los pasivos registrados como `pendientes` en `cash_movements`.
- **Cómo calcula pagos:**
  - Movimientos de tipo `out` (egresos) en la categoría de compras/proveedores dentro de la Base Financiera.

## 5. Caja y Bancos (Base Financiera)
- **Cómo calcula saldos:**
  - Suma algebraica (ingresos - egresos) de todos los `cash_movements` reales que no son no-monetarios, clasificados por ID de cuenta (Caja, Banco, Billetera).
- **Cómo calcula flujo de fondos:**
  - Algoritmo proyectado: Liquidez actual + (Cobros Pendientes * factor de tiempo) - (Pagos Pendientes * factor de tiempo).

## 6. Socios y Capital
- **Cómo calcula capital aportado y retiros:**
  - **Fuente de Verdad:** `PartnerTransactions`. Aportes netos excluyendo los impactos operativos. 
- **Cómo calcula saldo neto:**
  - `Total Aportado - Total Retirado`. Se refleja estrictamente en el "Patrimonio" sin contaminar la Ganancia Operativa, lo cual asegura explicabilidad y limpieza contable.

## 7. Stock
- **Cómo calcula valorización:**
  - Cantidad disponible (`productStocks`) * Costo (Costo/Kg o Costo Unitario).
- **Cómo calcula costo de mercadería:**
  - El costo de los Productos Terminados se infiere de la receta (Materia Prima + Insumos + Mano de Obra).

## 8. Producción
- **Cómo calcula costo real de producción:**
  - Cada paquete físico guarda el costo exacto en el momento de su producción, sumando los costos de la merma, la materia prima y los insumos (envases, etiquetas) utilizados.

## 9. Reportes
- **Qué reportes existen:**
  - Remitos en PDF.
  - Dashboard Ejecutivo (Stock, Rentabilidad, Valor Empresa, Proyección Flujo).
  - Dashboard Financiero (Salud, Balance Patrimonial, Estado de Resultados, Gestión de Pasivos, Overrides).
- **Qué reportes faltan:**
  - Libro IVA Ventas / Compras.
  - Cashflow Histórico detallado por centro de costos.
  - Conciliación Bancaria.
  - Reporte formal de mermas y rendimiento de producción.

---

## Conclusiones

### Qué funciona (Confiable)
- **Aislamiento del Capital:** La refactorización del módulo societario permite que el Estado de Resultados Operativo sea puro, excluyendo aportes y retiros.
- **Costeo por Paquete:** La transición a trazabilidad por código de paquete asegura que el margen y la utilidad en ventas manuales sea preciso y no estimado.
- **Base Financiera Única:** La utilización de `cash_movements` como única fuente de liquidez unifica los cálculos y elimina redundancias.

### Qué no funciona / No es confiable
- **Cuentas Corrientes (Saldos):** Depender de `currentBalance` en el perfil del cliente/proveedor es riesgoso frente a una arquitectura basada en movimientos transaccionales reales. Puede desincronizarse si falla la escritura doble.
- **Conciliación de pagos pendientes vs pasivos financieros:** Existe superposición semántica entre deudas registradas en proveedores/clientes y movimientos pendientes en la caja.

### Reportes gerenciales que faltan (Para priorizar en el futuro)
1. Estado de Cuenta y Recibos / Órdenes de Pago formales.
2. Reporte Impositivo (IVA).
3. Reporte Analítico de Mermas de Producción vs Costo Teórico.
