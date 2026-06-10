# FASE 3B.0 – UNIFICACIÓN DE PRECIOS ENTRE ERP Y BALANZA

## Resumen de la Implementación
El objetivo principal de esta fase consistía en desacoplar el costo teórico calculado por el ERP del precio comercial real configurado en la balanza para alinear el sistema con la realidad del negocio, sin modificar todavía las entidades de Producción, Pedidos ni Stock. 

Se completaron exitosamente todas las etapas, introduciendo una separación explícita de `Costo Kg`, `Precio Sugerido Kg` y `Precio Comercial Kg`.

## Módulos Afectados

### 1. Modelos Base (`database.ts`)
- **`Mercaderia` y `Presentacion`:**
  - Se mantuvieron los campos base requeridos (`costoKg` en Mercaderías).
  - Se agregó soporte para `precioSugeridoKg`.
  - Se modificó `precioVentaKg` pasando a utilizarse la convención obligatoria `precioComercialKg` a lo largo de todo el ciclo de vida del producto y venta.

### 2. Panel de Productos (`Productos.tsx`)
- Se rediseñó la tabla principal para exponer con claridad comercial:
  - **Costo Kg:** Derivado directamente del cálculo de la presentación (Costo Total / Peso en Kg).
  - **Precio Sugerido Kg:** El cual ahora figura como el cálculo teórico sugerido basado en el margen objetivo del sistema.
  - **Precio Comercial Kg:** El precio introducido de forma directa por el usuario, que refleja exactamente el precio configurado en la balanza física de la tienda.
  - **Diferencia %:** Un indicador de rentabilidad y desfasaje que avisa al usuario qué tan lejos o cerca está el "Precio Comercial" del "Precio Sugerido".
  
### 3. Panel de Listas de Precios (`Precios.tsx`)
- Modificado para que las listas de precios afecten y exporten directamente el `precioComercialKg` al interactuar con el entorno de Ventas.
- El `costoKg` de la presentación o mercadería base jamás es modificado por las Listas de Precios, manteniendo su función como "fuente de la verdad del valor del insumo".

### 4. Ciclo de Ventas (`Ventas.tsx` y `Rentabilidad.tsx`)
- Todos los cálculos de subtotal de los "Carritos" de ventas directas o pedidos ahora utilizan estrictamente el `precioComercialKg` del producto o el precio pisado de las listas comerciales activas.
- El Análisis de Rentabilidad evalúa su utilidad y porcentaje de márgenes enfrentando directamente el "Costo Real" de fabricación de la presentación contra su `precioComercialKg`.

## Impacto y Preparación para Fase 3B.1
Con esta reestructuración, el modelo de datos de Venta y Comercialización queda 100% blindado contra fluctuaciones automáticas en la rentabilidad. 

En la siguiente Fase (3B.1), todo flujo de **Pedidos** y **Producción** podrá leer de forma independiente el `precioComercialKg` real (la fuente de verdad de la balanza) sin causar inconsistencias si un cambio en el costo afecta el margen. De esta forma la empresa sabe si un paquete de 2.5kg se vendió al `precioComercialKg` de la balanza por más que su costo haya aumentado un 15% horas más tarde.

## Validación Final
- Se garantizó la retrocompatibilidad en todos los módulos de listado y cálculos iterando y adaptando las referencias al nuevo `precioComercialKg`.
- Build TypeScript verificado y libre de errores: **`npm run build` ejecutado exitosamente**.
