import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

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

async function runPantherAudit() {
  console.log("Iniciando auditoria de Panther...");
  
  const ordersRef = collection(db, 'orders');
  const qOrders = query(ordersRef, where('customerName', '==', 'Panther'));
  const ordersSnap = await getDocs(qOrders);
  
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log("1. TODOS los pedidos del cliente Panther:\n");
  
  const duplicateOrders = [];
  
  for (const order of orders) {
    const orderId = order.id;
    const items = order.items || [];
    const produccionEsperada = items.reduce((acc, item) => acc + (item.quantity || 0), 0);
    
    const smRef = collection(db, 'stock_movements');
    const qSm = query(smRef, where('referenceType', '==', 'production'), where('referenceId', '==', orderId));
    const smSnap = await getDocs(qSm);
    const stockMovements = smSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const pkgRef = collection(db, 'packages');
    const qPkg = query(pkgRef, where('orderId', '==', orderId));
    const pkgSnap = await getDocs(qPkg);
    const packages = pkgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    let timesProduced = 0;
    if (produccionEsperada > 0) {
      timesProduced = Math.floor(packages.length / produccionEsperada);
    }
    
    const createDate = new Date(order.createdAt || order.date || 0).toLocaleString('es-AR');
    const updateDate = new Date(order.updatedAt || 0).toLocaleString('es-AR');
    
    console.log(`- OrderId: ${orderId}`);
    console.log(`  Estado actual: ${order.status}`);
    console.log(`  Fecha creación: ${createDate}`);
    console.log(`  Fecha última actualización: ${updateDate}`);
    console.log(`  Cantidad de stock_movements asociados: ${stockMovements.length}`);
    console.log(`  Cantidad de packages asociados: ${packages.length}`);
    console.log(`  Cantidad de veces que fue producido: ${timesProduced}\n`);
    
    if (timesProduced > 1) {
      duplicateOrders.push({
        order,
        produccionEsperada,
        timesProduced,
        stockMovements,
        packages
      });
    }
  }
  
  console.log("\n2. Detectar pedidos que tengan más de una ejecución de producción:\n");
  
  let totalSMDuplicados = 0;
  let totalPkgDuplicados = 0;
  let totalProduccionesDuplicadas = 0;
  
  for (const dup of duplicateOrders) {
    totalProduccionesDuplicadas++;
    
    const { order, timesProduced, stockMovements, packages, produccionEsperada } = dup;
    
    // Group execution by date (using createdAt of packages/movements)
    // We group by a small window (e.g., within the same 5 seconds) to consider it a single execution
    const executions = [];
    
    packages.forEach(pkg => {
      const ts = pkg.createdAt || pkg.productionDate;
      let found = executions.find(e => Math.abs(e.ts - ts) < 5000);
      if (!found) {
        found = { ts, date: new Date(ts).toLocaleString('es-AR'), pkgs: [], sms: [] };
        executions.push(found);
      }
      found.pkgs.push(pkg);
    });
    
    stockMovements.forEach(sm => {
      const ts = sm.createdAt || sm.date;
      let found = executions.find(e => Math.abs(e.ts - ts) < 5000);
      if (!found) {
        found = { ts, date: new Date(ts).toLocaleString('es-AR'), pkgs: [], sms: [] };
        executions.push(found);
      }
      found.sms.push(sm);
    });
    
    // Sort executions by time
    executions.sort((a, b) => a.ts - b.ts);
    
    console.log(`- OrderId: ${order.id}`);
    console.log(`  Cantidad de ejecuciones: ${executions.length}`);
    
    executions.forEach((ex, idx) => {
      console.log(`  * Ejecución ${idx + 1} - Fecha: ${ex.date}`);
      console.log(`    Stock movements generados: ${ex.sms.length}`);
      console.log(`    Packages generados: ${ex.pkgs.length}`);
    });
    console.log("");
    
    // Calculate what to delete (we keep the first execution, delete the rest)
    // Actually, keeping the FIRST execution or LAST execution? We usually keep the first one.
    const toKeep = executions[0];
    const toDelete = executions.slice(1);
    
    let smToDelete = [];
    let pkgToDelete = [];
    
    toDelete.forEach(ex => {
      smToDelete.push(...ex.sms.map(s => s.id));
      pkgToDelete.push(...ex.pkgs.map(p => p.id));
    });
    
    totalSMDuplicados += smToDelete.length;
    totalPkgDuplicados += pkgToDelete.length;
    
    console.log("4. Simular la corrección SIN EJECUTARLA.\n");
    console.log(`PEDIDO:\n${order.id}\n`);
    console.log(`SE CONSERVARÍA:\n* producción del día ${toKeep.date}\n`);
    console.log(`SE ELIMINARÍAN:`);
    smToDelete.forEach(id => console.log(`* stock_movement id ${id}`));
    pkgToDelete.forEach(id => console.log(`* package id ${id}`));
    console.log("");
  }
  
  console.log("\n3. Informar exactamente:");
  console.log(`TOTAL DE PRODUCCIONES DUPLICADAS DETECTADAS: ${totalProduccionesDuplicadas}`);
  console.log(`TOTAL DE STOCK_MOVEMENTS DUPLICADOS: ${totalSMDuplicados}`);
  console.log(`TOTAL DE PACKAGES DUPLICADOS: ${totalPkgDuplicados}`);
}

runPantherAudit().catch(console.error);
