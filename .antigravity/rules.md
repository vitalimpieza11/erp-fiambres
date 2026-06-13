# Directrices de Desarrollo: ERP Al Vacío V2

Este documento detalla las reglas de diseño arquitectónico, estándares de código limpio y flujos de datos unificados en el sistema.

---

## 1. Estructura del Código y Principios SOLID

El ERP está diseñado para aislar completamente las operaciones comerciales de los componentes visuales:

- **Single Responsibility (SRP)**:
  - **Vistas** (`.tsx`): Solo contienen JSX declarativo y estilos. Consumen estados a través de hooks.
  - **Hooks** (`use[Feature].ts`): Calculan valores derivados y exponen acciones (controladores).
  - **Stores** (`[feature]Store.ts`): Almacenan el estado global y manejan la reactividad con Zustand.
  - **Repositorios** (`[feature]Repository.ts`): Contienen todas las consultas y escrituras a Firestore de manera aislada.

- **Helpers e Inmutabilidad**:
  - Toda conversión de unidades debe pasar por `src/lib/unitConverter.ts`.
  - Todo formateo de fecha expuesto al usuario debe controlarse mediante helpers defensivos (`formatDate`, `formatTime`) para evitar excepciones por valores corruptos en documentos legados de Firebase.

---

## 2. Unificación de Cadenas e IDs

- **Colecciones de Firebase**: Referenciadas mediante `COLLECTIONS` de `src/lib/firebase.ts`.
- **Tipos de Stock**: Los tipos oficiales son `MERCADERIA`, `INSUMO` y `PRESENTACION`. Los tipos antiguos (`RAW_MATERIAL` y `PACKAGING`) no deben usarse en el código de producción.
- **Estados Operacionales**: Los pedidos de venta deben seguir de forma estricta el flujo de estados del negocio: `PENDIENTE`, `EN_PRODUCCION`, `PRODUCIDO`, `ENTREGADO`, `FACTURADO`, `ANULADO`.

---

## 3. Experiencia de Usuario (Apple Style)

- **Modo Claro**: Estética moderna con bordes redondeados, colores harmonizados (rojo principal `#C43126`, blanco, grises y negro suave), y sombras difusas (`--shadow-sm`, `--shadow-md`).
- **RightPanel**: Las altas y ediciones de registros se realizan de forma exclusiva a través de paneles laterales deslizantes desde la derecha, evitando overlays de diálogos emergentes clásicos.
- **ExpandableCard**: Agrupación interactiva que evita sobrecargar la pantalla con datos simultáneos.
