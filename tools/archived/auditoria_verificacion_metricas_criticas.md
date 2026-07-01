# Auditoría de Verificación: Métricas Críticas

Tras una revisión profunda del código fuente y los componentes actuales del sistema, se presentan los resultados exactos del funcionamiento de las métricas de deuda y rentabilidad.

---

## 1. DEUDA DE CLIENTES

**Análisis de Código:**
*   **Componentes responsables:** `Clientes.tsx` y `CuentaCorriente.tsx`.
*   **Hook utilizado:** `useSales` (obtiene la colección `sales`).
*   **Uso de `currentBalance`:** En las vistas de Clientes y Cuenta Corriente **YA NO SE UTILIZA**. Sin embargo, el componente `Dashboard.tsx` aún lo consulta erróneamente para calcular `cobrosPendientes`.
*   **Uso de `saldoPendiente`:** **SÍ**. El sistema actual iterativiza sobre los comprobantes reales de venta.

**Fragmento de Código Exacto (`Clientes.tsx` y `CuentaCorriente.tsx`):**
```typescript
  // Calculate debt dynamically from sales to ensure single source of truth
  const getCustomerDebt = (customerId: string) => {
    return sales
      .filter(s => s.customerId === customerId && s.paymentMethod === 'cc' && (s.status === 'PENDIENTE' || s.status === 'PARCIAL'))
      .reduce((acc, sale) => acc + (sale.saldoPendiente !== undefined ? sale.saldoPendiente : sale.total), 0);
  };
```

**Conclusión:**
**La auditoría anterior estaba parcialmente desactualizada.** La deuda mostrada en los módulos de Clientes y Cuenta Corriente es **ALTAMENTE CONFIABLE**, ya que se calcula en vivo iterando sobre las facturas (`sales`) con estado 'PENDIENTE' o 'PARCIAL'. El único riesgo remanente es el `Dashboard.tsx`, que debe ser actualizado para usar este mismo cálculo en lugar de `currentBalance`.

---

## 2. DEUDA DE PROVEEDORES

**Análisis de Código:**
*   **Componente:** `Proveedores.tsx`.
*   **Verdad actual:** La lista principal sigue leyendo la propiedad estática y legacy `currentBalance`.

**Fragmento de Código Exacto (Vista de Lista en `Proveedores.tsx`):**
```typescript
  const mappedProveedores = suppliers.map((s: any) => {
    const balance = (s as any).currentBalance || 0;
    return {
      // ...
      debt: formatCurrency(balance),
      rawBalance: balance
    };
  });
```

*   **¿Qué ocurre con las compras (Historial Detallado)?**
    En la vista de Cuenta Corriente del proveedor, el sistema hace un intento de crear un *Ledger* cronológico cruzando `purchases`, `movements` y `partner_transactions` (`transactions` de aportes):
```typescript
      let balance = 0;
      return history.map(item => {
        balance = balance + Number(item.debe || 0) - Number(item.haber || 0);
        return { ...item, saldo: balance };
      });
```
    **Sin embargo**, a pesar de calcular un historial cronológico, el KPI superior de "Deuda Total" de la pantalla ignora este historial y renderiza el `currentBalance` estático:
```typescript
    const saldoReal = selectedSupplier.rawBalance || 0;
    // ...
    <h3 style={{ fontSize: '1.25rem' }}>{formatCurrency(saldoReal)}</h3>
```

**Conclusión:**
**La deuda de proveedores NO ES CONFIABLE.** Aunque el sistema es capaz de generar un historial dinámico a partir de compras y pagos, los indicadores visuales principales de la UI siguen atados a la propiedad estática `currentBalance`, lo que genera una desconexión y una fuente de errores si un pago no actualiza correctamente el perfil en Firestore.

---

## 3. RENTABILIDAD REAL

**Análisis de Código:**
Existen dos enfoques completamente diferentes conviviendo en el sistema:

**A. Rentabilidad Teórica Simulada (`Rentabilidad.tsx`)**
Utiliza el objetivo de peso ideal y los costos de formulación crudos, ignorando lo que realmente sucedió en producción.
```typescript
    const cost = calculatePresentationCost(pres, mercaderias, insumos, recipes);
    const weightKg = (pres.pesoObjetivoGramos || 200) / 1000;
```

**B. Rentabilidad Histórica Real (`Ventas.tsx` y `Dashboard.tsx`)**
**SÍ utiliza `packages`.** Al momento de confirmar una venta, el módulo `Ventas.tsx` mapea exactamente los paquetes físicos seleccionados, sumando su peso y costo real con precisión de gramos:
```typescript
        items: items.map(item => {
          const pkgObjects = packages.filter(p => item.selectedPackages.includes(p.id!));
          const totalWeight = pkgObjects.reduce((sum, p) => sum + p.weight, 0);
          const totalCosto = pkgObjects.reduce((sum, p) => sum + p.cost, 0);
          
          return {
            // ...
            pesoRealTotal: totalWeight,
            price: item.selectedPackages.length > 0 ? amount / item.selectedPackages.length : 0, 
            cost: item.selectedPackages.length > 0 ? totalCosto / item.selectedPackages.length : 0,
            packages: item.selectedPackages
          };
        }),
```
Luego, `Dashboard.tsx` levanta este costo congelado para mostrar la utilidad absoluta en el widget "Top Productos Más Rentables":
```typescript
        const rev = item.price * item.quantity;
        const cst = (item.cost || 0) * item.quantity;
        stats[item.productId].profit += (rev - cst);
```

**Conclusión:**
**Depende de dónde se mire.**
La pantalla dedicada "Análisis de Rentabilidad" (`Rentabilidad.tsx`) es puramente **teórica y simulada** (Pricing Tool).
Sin embargo, la rentabilidad reportada en el **Dashboard Ejecutivo** es **100% HISTÓRICA REAL**, ya que se basa en las ventas cerradas calculadas a partir de los paquetes físicos rastreados (`packages`) con su costo de producción congelado milimétricamente.
