import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, documentId } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA1DVWWtmbK1TStPnm3DfQ27zKKNoFtYL8",
  authDomain: "al-vacio.firebaseapp.com",
  projectId: "al-vacio",
  storageBucket: "al-vacio.firebasestorage.app",
  messagingSenderId: "251108729374",
  appId: "1:251108729374:web:4f6c67930ed3286955840f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'default');

async function runAudit() {
  console.log("Iniciando auditoria...");
  
  // Get all PRODUCIDO and ENTREGADO orders
  const ordersRef = collection(db, 'orders');
  const qOrders = query(ordersRef, where('status', 'in', ['PRODUCIDO', 'ENTREGADO']));
  const ordersSnap = await getDocs(qOrders);
  
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  let correctos = 0;
  let duplicados = 0;
  
  const correctosArr = [];
  const duplicadosArr = [];

  for (const order of orders) {
    const orderId = order.id;
    const customerName = order.customerName || 'Sin Nombre';
    const status = order.status;
    const items = order.items || [];
    
    // 1. Produccion esperada
    const produccionEsperada = items.reduce((acc, item) => acc + (item.quantity || 0), 0);
    
    // 2. Buscar stock_movements
    const smRef = collection(db, 'stock_movements');
    const qSm = query(smRef, where('referenceType', '==', 'production'), where('referenceId', '==', orderId));
    const smSnap = await getDocs(qSm);
    const stockMovements = smSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Group stock movements by product
    const smByProduct = {};
    stockMovements.forEach(sm => {
      const prodName = sm.productName || sm.productId;
      if (!smByProduct[prodName]) smByProduct[prodName] = 0;
      smByProduct[prodName] += sm.quantity; // it's usually negative
    });
    
    // 3. Buscar packages
    const pkgRef = collection(db, 'packages');
    const qPkg = query(pkgRef, where('orderId', '==', orderId));
    const pkgSnap = await getDocs(qPkg);
    const packages = pkgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const produccionRealRegistrada = packages.length;
    const pesoTotalProducido = packages.reduce((acc, pkg) => acc + (pkg.weight || 0), 0);
    
    // 4. Detectar multiplicidad
    // If produccionEsperada is 0, skip.
    if (produccionEsperada === 0) continue;
    
    // The multiplier is how many times the order was produced
    // For example, if expected = 5, and real = 10, then it was produced 2 times.
    const timesProduced = produccionRealRegistrada / produccionEsperada;
    
    const info = {
      orderId,
      customerName,
      status,
      produccionEsperada,
      produccionRealRegistrada,
      pesoTotalProducido,
      smCount: stockMovements.length,
      smByProduct,
      timesProduced,
      stockMovementsIds: stockMovements.map(sm => sm.id),
      packageIds: packages.map(p => p.id)
    };
    
    if (timesProduced > 1 && Number.isInteger(timesProduced)) {
      duplicados++;
      duplicadosArr.push(info);
    } else if (timesProduced === 1) {
      correctos++;
      correctosArr.push(info);
    } else {
      // Partial or mismatched
      if (produccionRealRegistrada > produccionEsperada) {
         duplicados++;
         duplicadosArr.push(info);
      } else {
         correctos++;
         correctosArr.push(info);
      }
    }
  }
  
  console.log("=== PEDIDOS CORRECTOS ===");
  correctosArr.forEach(c => {
    console.log(`- Order: ${c.orderId} | Cliente: ${c.customerName} | Status: ${c.status}`);
    console.log(`  Esperado: ${c.produccionEsperada} pkgs | Real: ${c.produccionRealRegistrada} pkgs | Movimientos: ${c.smCount}`);
  });
  
  console.log("\n=== PEDIDOS DUPLICADOS ===");
  duplicadosArr.forEach(d => {
    console.log(`- Order: ${d.orderId} | Cliente: ${d.customerName} | Status: ${d.status}`);
    console.log(`  Movimientos stock encontrados: ${d.smCount}`);
    console.log(`  Cantidades stock afectadas (total acumulado):`, d.smByProduct);
    console.log(`  Packages encontrados: ${d.produccionRealRegistrada} (Peso total: ${d.pesoTotalProducido.toFixed(3)} Kg)`);
    console.log(`  Producción esperada: ${d.produccionEsperada} pkgs`);
    console.log(`  Veces producida: ${d.timesProduced}`);
    
    const vecesSobra = d.timesProduced - 1;
    const smSobran = (d.smCount / d.timesProduced) * vecesSobra;
    const pkgSobran = (d.produccionRealRegistrada / d.timesProduced) * vecesSobra;
    
    console.log(`  -> Sobran ${smSobran} movimientos y ${pkgSobran} packages.`);
    
    // Determinar qué IDs eliminar
    // Asumiremos que los "últimos" o una porción se pueden borrar. 
    // Para ser exactos, mostrar cuáles registros (sus IDs) se borrarían.
    const smToDelete = d.stockMovementsIds.slice(0, smSobran);
    const pkgToDelete = d.packageIds.slice(0, pkgSobran);
    
    console.log(`  Registros a eliminar para dejar una sola producción válida:`);
    console.log(`  stock_movements (${smToDelete.length}): ${smToDelete.join(', ')}`);
    console.log(`  packages (${pkgToDelete.length}): ${pkgToDelete.join(', ')}`);
    console.log("");
  });
  
  console.log("Finalizado.");
}

runAudit().catch(console.error);
