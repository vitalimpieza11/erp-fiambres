# Auditoría Gerencial Integral del ERP Al Vacío (Fase 4A)

Esta auditoría técnica describe de manera estricta el funcionamiento interno de cada módulo gerencial del sistema. Su propósito es definir qué indicadores son confiables actualmente, el nivel de integridad de los datos, y los potenciales errores arquitectónicos.

---

## 1. Dashboard Principal (`Dashboard.tsx`)
*   **Qué indicadores muestra actualmente:** Stock Valorizado, Rentabilidad por Producto, Liquidez y Pasivos, Flujo de Fondos Proyectado, Valor de Empresa.
*   **De dónde obtiene los datos:** Combinación de ventas históricas, saldos estáticos y movimientos de caja.
*   **Qué hooks utiliza:** `useSales`, `useMercaderias`, `useInsumos`, `usePresentaciones`, `useCustomers`, `useSuppliers`, `useCashMovements`, `useStockMovements`.
*   **Qué colecciones consulta:** `sales`, `cash_movements`, `customers`, `suppliers`, etc.
*   **Qué cálculos realiza:** 
    *   *Rentabilidad por Producto:* Agrupa los items de `sales` sumando Revenue (precio * qty) y Cost (costo * qty).
    *   *Flujo Proyectado:* Asigna factores empíricos (0.3, 0.5, 0.7) a saldos pendientes de clientes y proveedores para predecir caja a 7, 15 y 30 días.
*   **Qué limitaciones tiene:** Agrupa conceptos de distintas naturalezas contables (Movimientos vs Propiedades estáticas de perfiles).
*   **Qué errores potenciales existen:** El flujo proyectado puede desvirtuarse si un cliente tiene deuda falsa por errores de actualización de perfil.
*   **Qué información es confiable:** Stock valorizado (cuando deriva del físico).
*   **Qué información NO es confiable:** Flujo de fondos proyectado.

## 2. Dashboard Financiero (`DashboardFinanciero.tsx`)
*   **Qué indicadores muestra actualmente:** Liquidez, Resultado Operativo, Capital Neto, Activos Fijos, Pasivos Totales, Estado de Resultados, Overrides Manuales.
*   **De dónde obtiene los datos:** Estrictamente transaccional.
*   **Qué hooks utiliza:** `useCashMovements`, `useBanks`, `useSocietaria`, `usePartnerTransactions`.
*   **Qué colecciones consulta:** `cash_movements`, `partner_transactions`.
*   **Qué cálculos realiza:** Balance Patrimonial separando aportes societarios del flujo operativo in/out. Verifica que `Activos - (Pasivos + Patrimonio) = 0`.
*   **Qué limitaciones tiene:** Requiere disciplina humana extrema en la recategorización de egresos/ingresos operativos vs capital/activos.
*   **Qué errores potenciales existen:** Fuga de capital operativo a la vista gerencial si un socio retira dinero categorizado como 'gasto' en lugar de 'retiro'.
*   **Qué información es confiable:** Capital Aportado, Liquidez Total.
*   **Qué información NO es confiable:** Pasivos (dado que depende del flag estático `status = pendiente` en movimientos en vez de conciliación formal con facturas).

## 3. Caja y Bancos (`CajaBancos.tsx`)
*   **Qué indicadores muestra actualmente:** Logs de ingresos, egresos, saldos por cuenta.
*   **De dónde obtiene los datos:** Historial transaccional directo.
*   **Qué hooks utiliza:** `useCashMovements`, `useBanks`.
*   **Qué colecciones consulta:** `cash_movements`.
*   **Qué cálculos realiza:** Sumas parciales de in/out por `accountId`.
*   **Qué información es confiable:** Histórico de saldos y auditoría de overrides (es transaccional).
*   **Qué información NO es confiable:** Puede existir desviación con la cuenta bancaria real si no hay un sistema formal de *Conciliación Bancaria*.

## 4. Socios (`PartnerTransactions`)
*   **Qué indicadores muestra actualmente:** Total Aportado, Capital Retirado, Evolución de Inyecciones.
*   **De dónde obtiene los datos:** De un módulo unificado de Aportes/Retiros.
*   **Qué hooks utiliza:** `usePartnerTransactions`.
*   **Qué colecciones consulta:** `partner_transactions`.
*   **Qué cálculos realiza:** `Total Aportes - Total Retiros`.
*   **Qué información es confiable:** TOTALMENTE CONFIABLE. Está desacoplado, es transaccional y auditable.

## 5. Clientes (`Clientes.tsx`)
*   **Qué indicadores muestra actualmente:** Deuda / Saldo Pendiente.
*   **De dónde obtiene los datos:** Del objeto de perfil del cliente.
*   **Qué hooks utiliza:** `useCustomers`.
*   **Qué colecciones consulta:** `customers`.
*   **Qué limitaciones tiene:** Utiliza el campo `currentBalance`. No hay doble partida contable formal de cuenta corriente (Factura vs Recibo).
*   **Qué errores potenciales existen:** Race conditions al actualizar `currentBalance` simultáneamente desde ventas múltiples, y fallas de integridad de datos si un pago falla pero el saldo se restaura mal.
*   **Qué información es confiable:** Datos maestros (nombre, dirección).
*   **Qué información NO es confiable:** Saldos (Deuda).

## 6. Proveedores (`Proveedores.tsx`)
*   **Qué indicadores muestra actualmente:** Saldo pendiente / deuda.
*   **De dónde obtiene los datos:** Objeto perfil del proveedor.
*   **Qué hooks utiliza:** `useSuppliers`.
*   **Qué colecciones consulta:** `suppliers`.
*   **Qué información NO es confiable:** Al igual que clientes, la propiedad `currentBalance` es altamente inestable sin un ledger transaccional de "Cuenta Corriente Proveedor" (Remito de Compra vs Orden de Pago).

## 7. Ventas (`Ventas.tsx`)
*   **Qué indicadores muestra actualmente:** Facturación del pedido, subtotal, descuentos, costos y remito físico.
*   **De dónde obtiene los datos:** Venta procesada y costeada contra el paquete físico de mercadería.
*   **Qué hooks utiliza:** `useSales`, `usePackages`.
*   **Qué colecciones consulta:** `sales`, `packages`.
*   **Qué cálculos realiza:** Facturación calculada por `peso físico del paquete * precioComercialKg`.
*   **Qué información es confiable:** Confiable. Los paquetes arrastran su costo real y peso real en el momento de la venta.
*   **Qué información NO es confiable:** Cuentas Corrientes si el método de pago asume la cancelación directa o el pasaje automático de deuda al cliente.

## 8. Producción (`Produccion.tsx`)
*   **Qué indicadores muestra actualmente:** Volumen de procesamiento, control de mermas teóricas y paquetización.
*   **Qué cálculos realiza:** Creación de lotes y paquetes.
*   **Qué información es confiable:** Trazabilidad (ID de paquete vs Lote).
*   **Qué información NO es confiable:** En el sistema anterior, el costo y la merma teórica solían sobreestimarse. Ahora que se migra a modelo "Package", la fiabilidad aumentará exponencialmente.

## 9. Stock (`Stock.tsx`)
*   **Qué indicadores muestra actualmente:** Niveles de disponibilidad.
*   **De dónde obtiene los datos:** Ingresos/Egresos directos y conteo de paquetes 'Disponibles'.
*   **Qué hooks utiliza:** `useStockMovements`, `usePackages`.
*   **Qué colecciones consulta:** `stock_movements`, `packages`.
*   **Qué cálculos realiza:** Sumas dinámicas de entradas menos salidas.
*   **Qué información es confiable:** Los paquetes físicos (`packages`), al existir como entidad atómica, no fallan.

## 10. Rentabilidad (`Rentabilidad.tsx`)
*   **Qué indicadores muestra actualmente:** Margen Promedio, Utilidad por Paquete/Kg Teórica.
*   **De dónde obtiene los datos:** Calculador de formulación.
*   **Qué hooks utiliza:** `useRecipes`, `usePresentaciones`, `useMercaderias`.
*   **Qué cálculos realiza:** Costo Teórico de Presentación vs Precio de Venta en Lista de Precios.
*   **Qué información es confiable:** Es un calculador (Pricing Tool). 
*   **Qué información NO es confiable:** NO representa la ganancia histórica de la empresa. Asumir que "Rentabilidad Promedio 30%" en esta pantalla es igual a la ganancia real es un error gerencial, ya que excluye variables macroeconómicas reales, fletes, mermas desviadas y gastos de estructura.

---

## Tabla de Confiabilidad de Métricas Gerenciales

| MÉTRICA | FUENTE | CONFIABLE (SI/NO) | MOTIVO |
| :--- | :--- | :--- | :--- |
| **Ventas del mes** | Colección `sales` | **SÍ** | Basado estrictamente en comprobantes y despachos históricos. |
| **Margen bruto** | `sales` / `packages` | **SÍ** | Costo real del paquete vs Precio real despachado. |
| **Margen neto (Operativo)** | `cash_movements` | **SÍ** | Deriva de la cuenta de resultados de flujos financieros in/out excluyendo capital societario. |
| **Caja real (Física)** | `cash_movements` | **SÍ** | Histórico transaccional por `accountId`. |
| **Banco real** | `cash_movements` | **SÍ** | Histórico transaccional por `accountId`. |
| **Capital aportado** | `partner_transactions` | **SÍ** | Módulo aislado, transaccional, inmutable a flujos operativos y de doble partida accionaria. |
| **Deuda clientes** | `customers.currentBalance` | **NO** | Arquitectura frágil: Se actualiza mutando una propiedad estática sin un "Ledger" (Libro Mayor) de doble entrada de facturas vs recibos. |
| **Deuda proveedores** | `suppliers.currentBalance` | **NO** | Arquitectura frágil: Idéntico problema al de clientes. Propenso a desincronización y corrupción de deuda. |
| **Stock valorizado** | `packages` / `stock` | **SÍ** | Calculado en vivo sobre el stock físico rastreable si la carga es correcta. |
| **Costo de producción** | `packages` | **SÍ** | Cada paquete congela su costo al nacer, basado en el costo del insumo y materia prima real en ese milisegundo temporal. |
| **Rentabilidad por producto** | `Dashboard.tsx` (`sales`) | **SÍ** | Analiza ventas históricas contra costos históricos. |
| **Rentabilidad por cliente** | Inexistente / N/A | **NO** | No está implementado actualmente en ningún dashboard un cruce "Utilidad Neta por Cliente". |
| **Rentabilidad por pedido** | `Ventas.tsx` | **SÍ** | En cada Venta se conoce la sumatoria de costos de paquetes vs el total de venta. |

---

## Reportes Gerenciales Faltantes (Críticos para la escalabilidad)

1.  **Cuenta Corriente Transaccional (Ledger de Deudores/Acreedores):**
    Un reporte vital que desglose Factura por Factura (Remito) vs Recibo por Recibo (Pago), entregando un Extracto de Cuenta (Balance de Sumas y Saldos) para poder enviar a clientes. Reemplazaría la inseguridad del `currentBalance`.
2.  **Rentabilidad por Cliente / Canal:**
    Análisis ABC de clientes. Permite detectar clientes de alto volumen pero baja rentabilidad (por exceso de bonificaciones o fletes) y clientes de bajo volumen pero alto margen.
3.  **Conciliación Bancaria Automática / Semiautomática:**
    Cruzar los ingresos/egresos del sistema vs extracto bancario CSV, con tildado de "Conciliado".
4.  **Libro IVA / Reporte Impositivo (Compras y Ventas):**
    Agrupación de totales netos, IVA débito/crédito, y percepciones listas para enviar al Contador.
5.  **P&L (Estado de Resultados Completo Mensualizado):**
    Una matriz de Profit & Loss que cruce los ingresos y gastos reales por Categoría de Centro de Costos, mes a mes a lo largo del año.
6.  **Reporte Desviación de Mermas (Producción):**
    Comparativa entre el "Rendimiento Teórico" (ej: 80% del vacío) vs el "Rendimiento Real" logrado por operario en cada lote. Clave para frenar pérdidas de frigorífico.
