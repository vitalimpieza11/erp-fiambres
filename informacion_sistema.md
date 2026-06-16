# Información General y Análisis de Arquitectura del Sistema: Al Vacío ERP (erp-fiambres)

Este documento detalla la estructura, arquitectura de software, modelo de datos y políticas de negocio implementadas en el **ERP Al Vacío**, diseñado específicamente para el control integral de producción, pesaje físico y comercialización de fiambres envasados al vacío.

---

## 1. Arquitectura de Software (Patrón de 4 Capas)

El desarrollo del ERP sigue una arquitectura estrictamente desacoplada de 4 capas para garantizar escalabilidad, mantenimiento y facilidad de pruebas (conforme a principios **SOLID**):

```
┌───────────────────────────────────────┐
│        Capa de Vista (UI)             │  React Components (.tsx) & CSS
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│    Capa de Control y Lógica (Hooks)   │  Custom Hooks (use*.ts)
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│     Capa de Estado (Zustand)          │  Stores (Zustand / Memory Cache)
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│     Capa de Datos (Repositories)      │  Async Calls & OnSnapshot (Firestore)
└───────────────────────────────────────┘
```

1. **Capa de Vista (UI)** (`src/features/*/`): Interfaces declarativas y minimalistas con estética inspirada en Apple (paneles deslizantes laterales en lugar de modales, tarjetas expandibles). Consumen información exclusivamente del custom hook.
2. **Capa de Control y Lógica** (`src/features/*/use*.ts`): Custom hooks que agrupan cálculos pesados (mermas, saldos pendientes, etc.) y actúan como intermediarios entre el componente de UI y el Store de estado.
3. **Capa de Estado** (`src/store/`): Stores globales con Zustand que manejan la caché en memoria y resuelven suscripciones asíncronas en tiempo real (`onSnapshot`) a Firebase Firestore de forma centralizada (suscripción singleton).
4. **Capa de Datos (Repositories)** (`src/repositories/*/`): Funciones asíncronas puras sin dependencias de la UI ni de React que realizan las escrituras/lecturas de la base de datos Firestore.

---

## 2. Mapa del Código (Estructura de Directorios)

```
erp-fiambres/
├── src/
│   ├── app/
│   │   └── Router.tsx                # Enrutador principal (React Router v7) y Guards de seguridad (AuthGuard / GuestGuard)
│   ├── components/                   # Componentes globales y reutilizables de UI
│   │   ├── ExpandableCard            # Tarjeta animada expandible para detalles
│   │   ├── RightPanel                # Panel deslizante lateral (para formularios de edición sin salir del contexto)
│   │   ├── FilterBar                 # Barra de búsqueda y filtrado de listas
│   │   └── Layout / LoadingSpinner   # Estructura base de navegación y pantalla de carga
│   ├── features/                     # Módulos funcionales del sistema (Vista + Lógica local)
│   │   ├── auth/                     # Autenticación de usuarios (Login)
│   │   ├── dashboard/                # Métricas gerenciales, rentabilidad en base a paquetes, flujos proyectados y balances
│   │   ├── clientes/                 # Listado, cuenta corriente detallada (cronograma de deuda/pagos) de clientes
│   │   ├── proveedores/              # Listado y cuenta corriente detallada de proveedores de materia prima e insumos
│   │   ├── compras/                  # Registro de compras de materias primas e insumos (actualiza stock y c/c)
│   │   ├── pedidos/                  # Gestión de pedidos de clientes (registra intención de compra por unidades)
│   │   ├── produccion/               # Registro de mermas y producción por paquete físico con peso real
│   │   ├── ventas/                   # Facturación y selección dinámica de paquetes físicos para cobro exacto en Kg
│   │   ├── stock/                    # Inventario y valorización (Mercaderías [Kg], Insumos [Unidades], Producto Terminado [Kg/Uni])
│   │   ├── caja/                     # Gestión de liquidez diaria de caja, bancos y transferencias
│   │   ├── socios/                   # Registro de aportes y retiros de capital societario sin mezclar flujo operativo
│   │   └── configuracion/            # Definición de productos, recetas, equivalencias, listas de precios y perfiles
│   ├── lib/                          # Helpers y utilidades del sistema
│   │   ├── firebase.ts               # Inicialización de SDK Firebase y atajos de colecciones
│   │   ├── formatters.ts             # Formateadores seguros de divisas, porcentajes y fechas
│   │   ├── unitConverter.ts          # Conversión de unidades (Kg, Gramos, Unidades, Fetas) con soporte de equivalencias
│   │   └── pdfHelper.ts              # Motor de exportación a PDF para remitos e informes
│   ├── repositories/                 # Capa de datos pura para interactuar con Firestore
│   ├── store/                        # Manejador de estado Zustand (Zustand Stores)
│   └── types/
│       └── domain.ts                 # Definición de tipos TypeScript del modelo de negocio
```

---

## 3. Modelo de Datos y Entidades principales

El sistema mapea las siguientes colecciones y estructuras en Firestore (declarados formalmente en `src/types/domain.ts`):

*   **Clientes (`customers`)**: Registra la información comercial de los clientes. Contiene nombre, Razón Social, CUIT, teléfono, dirección y un enlace a su Lista de Precios (`priceListId`).
*   **Proveedores (`suppliers`)**: Datos de proveedores de materias primas (carne, condimentos) e insumos (bolsas, etiquetas).
*   **Productos (`products`)**: Categorizados en `MERCADERIA` (materia prima), `INSUMO` (embalaje) y `PRESENTACION` (producto terminado empaquetado). Registra el tipo de unidad (`KG`, `GRAMOS`, `UNIDADES`, `FETAS`) y parámetros físicos como el `pesoObjetivoGramos` y `pesoFeta`.
*   **Recetas (`recipes`)**: Asocia un producto terminado (`PRESENTACION`) con sus ingredientes teóricos (`MERCADERIA` e `INSUMO`) y cantidades de formulación.
*   **Pedidos (`orders`)**: Registra pedidos con estado (`PENDIENTE`, `EN_PRODUCCION`, `PRODUCIDO`, `ENTREGADO`, `FACTURADO`, `ANULADO`).
*   **Ventas (`sales`)**: Guarda facturas y remitos concretados. Contiene la referencia a los paquetes físicos reales entregados, el peso acumulado real y el método de pago (`cc` cuenta corriente, o contado).
*   **Compras (`purchases`)**: Registra entradas de mercaderías e insumos, actualizando la cuenta corriente del proveedor y el inventario.
*   **Movimientos de Caja (`caja_movements`)**: Libro diario financiero clasificado en `INCOME` y `EXPENSE`. Categoriza ingresos de ventas, pagos a proveedores, gastos fijos y movimientos societarios.
*   **Movimientos de Stock (`stock_movements`)**: Registro detallado de entradas y salidas de inventario por tipo de operación (`PRODUCCION`, `VENTA`, `AJUSTE`, `COMPRA`).
*   **Cuentas Corrientes (`customer_movements` y `supplier_movements`)**: Registran débitos y créditos cronológicos por cada cliente y proveedor para control de morosidad y pagos.
*   **Socios (`shareholders` y `shareholder_movements`)**: Permiten el control de capital de inversión aportado y retiros personales, aislándolos de los números del negocio.

---

## 4. Políticas Críticas de Negocio Implementadas

### A. Trazabilidad por Paquete Físico con Pesaje Real (Fase 3)
*   **El Desafío**: Los productos envasados al vacío tienen variaciones de peso inherentes al proceso artesanal. Un paquete etiquetado como "1 kg teórico" puede pesar en la balanza `1.120 kg` o `0.980 kg`. Vender por "unidad teórica" generaba fugas de dinero (cuando pesaba más) o reclamos (cuando pesaba menos).
*   **La Solución**: Producción genera paquetes físicos individuales (`packages`), cada uno con un identificador único (ID de paquete) y su **peso real en gramos**.
*   **El Impacto**: Al vender, el despachante selecciona físicamente qué paquetes entrega y el ERP calcula el precio exacto multiplicando el **peso real** por el precio de lista. Esto asegura precisión de stock (en kilogramos reales) y rentabilidad exacta.

### B. Inmutabilidad Financiera y Registros Compensatorios
*   Para garantizar coherencia contable y prevenir fraudes o errores de auditoría, las colecciones financieras (`caja_movements`, `customer_movements`, `supplier_movements`, `shareholder_movements`) son **inmutables**.
*   Si se detecta un error en un cobro o pago, **no se elimina ni se edita** el documento original. En su lugar, el sistema genera una transacción de tipo `ANULACION` o `AJUSTE` inverso con signo opuesto y enlaza al documento anulado (`reversalOf`).

### C. Cálculo de Deuda Dinámico (Single Source of Truth)
*   El ERP calcula la deuda real de un cliente en tiempo real iterando directamente sobre las facturas en cuenta corriente impagas (`sales` con pago en `cc` y estado `PENDIENTE` o `PARCIAL`), evitando almacenar saldos acumulativos estáticos susceptibles de desincronización en escrituras dobles.

### D. Aislamiento Societario y Estado de Resultados Puro
*   Los movimientos de los socios (`shareholder_movements`) se registran por separado. De esta forma, el **Dashboard Ejecutivo** puede calcular un **Estado de Resultados Operativo Puro** (Ingresos Operativos - Costos de Producción/Materia Prima) sin que los retiros personales de los socios aparezcan erróneamente como pérdidas del ejercicio ni los aportes como ingresos operativos.

---

## 5. Estado Actual del Sistema y Puntos de Atención

### 1. Limpieza de Datos de Prueba Realizada (Listo para Producción)
Conforme a la última auditoría final (`auditoria_fase_final.md`), se eliminaron todas las transacciones históricas de prueba (compras, ventas, caja, paquetes físicos, lotes de producción) y se resetearon los saldos financieros a cero. **Se conservaron intactos los datos maestros** (clientes, proveedores, mercaderías, recetas). El sistema está listo para la carga inicial de saldos y stock de producción.

### 2. Conciliación Crítica ERP vs Balanza (Propuesta de Bonificaciones)
*   **Situación**: Las balanzas físicas imprimen etiquetas con precios calculados a partir de la lista de precio base cargada en la máquina. Si el ERP aplica una lista de precios mayorista con descuento directo sobre el ítem, el remito/factura final diferirá del precio impreso en el paquete físico, generando confusión en los clientes.
*   **Propuesta técnica en diseño (Fase 5)**: Cambiar el paradigma de las Listas de Precios para que el precio unitario del remito en el ERP coincida exactamente con el de la Balanza física (Precio Base). La diferencia del descuento de la lista mayorista se aplica como una **Bonificación Comercial / Descuento General** al pie del comprobante.

### 3. Deuda de Proveedores (Mejora Pendiente)
*   A diferencia de la deuda de clientes (que se calcula dinámicamente desde los comprobantes de venta), la pantalla principal de Proveedores aún depende de la propiedad `currentBalance` en el perfil del proveedor. Se recomienda migrar este cálculo a una sumatoria dinámica sobre `purchases` impagas y movimientos de cuenta corriente para evitar riesgos de desincronización.

### 4. Corrección en Dashboard Principal
*   El indicador de "Cobros Pendientes" en el Dashboard principal aún lee el campo legacy `currentBalance` de los perfiles de clientes. Se debe modificar para que consuma el hook dinámico de deuda estructurado a partir del estado de las ventas (`sales`).
