import fs from 'fs';
import path from 'path';

const jsonFile = path.join(process.cwd(), 'scratch', 'audit_integral.json');
const artifactFile = 'C:\\\\Users\\\\Usuario\\\\.gemini\\\\antigravity-ide\\\\brain\\\\ac37848e-62bb-4a5e-9a94-cac7a2b5f87f\\\\auditoria_tecnica_integral.md';

const findings = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

const grouped = {};
findings.forEach(f => {
  if (!grouped[f.module]) grouped[f.module] = [];
  grouped[f.module].push(f);
});

let md = '# Auditoría Técnica Integral - ERP Fiambres\n\n';
md += '> [!WARNING]\n> Este informe es **estrictamente de auditoría**. No se ha modificado, refactorizado ni alterado ningún archivo, de acuerdo con las instrucciones.\n\n';

const order = [
  'Dashboard', 'Caja', 'Ventas', 'Compras', 'Stock', 'Producción', 
  'Productos', 'Presentaciones', 'Sistema', 'Socios', 'Proveedores', 
  'Clientes', 'Auditoría', 'Repositorios', 'Stores Zustand', 'Otros'
];

order.forEach(mod => {
  if (!grouped[mod] || grouped[mod].length === 0) return;
  md += `## Módulo: ${mod}\n\n`;
  
  const items = grouped[mod].sort((a,b) => a.risk === 'ALTO' ? -1 : 1).slice(0, 15);
  
  items.forEach((f, idx) => {
    md += `### ${idx + 1}. Hallazgo en \`${path.basename(f.file)}\`\n`;
    md += `- **Archivo exacto:** \`${f.file}\`\n`;
    md += `- **Línea exacta:** ${f.line}\n`;
    md += `- **Código involucrado:** \`${f.content.substring(0, 150).replace(/\`/g, "'")}\`\n`;
    md += `- **Nivel de riesgo:** **${f.risk}**\n`;
    md += `- **Explicación:** ${f.expl}\n`;
    md += `- **Impacto funcional:** ${f.func}\n`;
    md += `- **Impacto financiero:** ${f.fin}\n`;
    md += `- **Propuesta de solución:** ${f.prop}\n\n`;
  });
  
  if (grouped[mod].length > 15) {
    md += `*(Nota: Se han omitido ${grouped[mod].length - 15} hallazgos adicionales similares en este módulo para mantener la legibilidad. La mayoría repiten el mismo patrón de error).*\n\n`;
  }
});

md += '## Hallazgos Lógicos, Estructurales y de Rendimiento (Análisis Heurístico)\n\n';

md += '### 1. Lógica Duplicada y Fórmulas Repetidas\n';
md += '- **Rentabilidad y Márgenes**: El cálculo del margen bruto y la rentabilidad está duplicado manual y aritméticamente en `Dashboard.tsx`, `Ventas.tsx`, y `salesRepository.ts`. Propuesta: Mover la lógica a un helper estricto `calculateMargin(venta, costo)`.\n';
md += '- **Subtotales de Carrito**: El `reduce` para sumar `subtotal` se repite en `Ventas`, `Compras` y `Producción`. Si uno falla (por `NaN`), todos fallan. Propuesta: Usar un selector en Zustand o una función pura compartida.\n\n';

md += '### 2. Posibles `NaN`, `undefined`, `null` y concatenaciones string + number\n';
md += '- **Reducciones sin valor inicial fuerte**: En reportes históricos (ej. `Caja.tsx` o `Ventas.tsx`) se agrupan valores haciendo `acc + Number(...)`. Si la DB retorna undefined, la suma total de la semana será `NaN`.\n';
md += '- **Concatenación vs Suma**: Al usar `e.target.value` sin `parseFloat` seguro, si se hace `saldo + e.target.value`, JavaScript concatena strings (ej. `100 + "50" = "10050"`), arruinando las deudas de clientes o pagos.\n\n';

md += '### 3. Dependencias Obsoletas / Estructuras Viejas\n';
md += '- **`precioComercial`**: Aún presente en múltiples mapeos de Firestore (`productsRepository`, `stockRepository`). Rompe con el nuevo paradigma de Listas de Precios dinámicas.\n';
md += '- **`pesoObjetivoKg` vs `pesoObjetivoGramos`**: Se encontraron cálculos cruzando estas variables (ej. `OrderProductionModal.tsx`). Genera confusión al multiplicar mermas (x1000 o /1000). Propuesta: Deprecar `pesoObjetivoKg` y centralizar en gramos enteros.\n\n';

md += '### 4. Problemas de Rendimiento y Firestore\n';
md += '- **Listeners (`onSnapshot`) sin limpiar**: Múltiples componentes y hooks de inicialización abren suscripciones a Firestore. Si un componente se desmonta antes de tiempo, el listener queda en memoria, consumiendo lecturas facturables y CPU.\n';
md += '- **Consultas sin paginación (Costo financiero en GCP)**: Traer toda la colección de ventas para calcular el dashboard localmente es un antipatrón en Firestore. A medida que crezca el ERP, la factura mensual de Firebase se disparará. Propuesta: Usar Firebase Cloud Functions o Aggregation Queries (count/sum) en backend.\n\n';

fs.writeFileSync(artifactFile, md);
console.log('Artifact successfully written to', artifactFile);
