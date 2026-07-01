import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

const CAPITAL_CATEGORIES = ['aporte_socio', 'inversion_inicial', 'bien_capital', 'maquinaria', 'tecnologia', 'vehiculos', 'vehiculo', 'equipamiento', 'herramientas'];

async function runAudit() {
  const salesSnap = await getDocs(collection(db, 'sales'));
  const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const movementsSnap = await getDocs(collection(db, 'cash_movements'));
  const movements = movementsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const isThisMonth = (d) => {
    const date = new Date(d);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  };

  // 1. Ventas del Mes
  const ventasDocs = sales.filter(s => isThisMonth(s.date) && s.status !== 'ANULADA');
  const ventasDelMes = ventasDocs.reduce((sum, s) => sum + s.total, 0);

  // 2. Cuentas por Cobrar
  const cuentasDocs = sales.filter(s => s.paymentMethod === 'cc' && (s.status === 'PENDIENTE' || s.status === 'PARCIAL'));
  const cobrosPendientes = cuentasDocs.reduce((acc, sale) => acc + (sale.saldoPendiente !== undefined ? sale.saldoPendiente : sale.total), 0);

  // 3. Resultado Operativo
  let ingresosOp = 0;
  let egresosOp = 0;
  const ingresosDocs = [];
  const egresosDocs = [];

  movements.forEach(m => {
    if (m.type === 'transfer') return;
    const cat = (m.category || '').toLowerCase();
    const isCapital = CAPITAL_CATEGORIES.some(c => cat.includes(c)) || m.tipoMovimiento === 'APORTE_SOCIO';
    if (!isCapital) {
      if (m.type === 'in') {
        ingresosOp += m.amount;
        ingresosDocs.push(m);
      } else if (m.type === 'out') {
        egresosOp += m.amount;
        egresosDocs.push(m);
      }
    }
  });

  console.log("=== RESUMEN ===");
  console.log("Ventas del Mes:", ventasDelMes);
  console.log("Cuentas por Cobrar:", cobrosPendientes);
  console.log("Resultado Operativo:", ingresosOp - egresosOp);
  console.log("\n=== DOCUMENTOS EN VENTAS DEL MES ===");
  ventasDocs.forEach(d => {
    console.log(`COLECCIÓN: sales\nID DOCUMENTO: ${d.id}\nFECHA: ${new Date(d.date).toISOString()}\nMONTO: ${d.total}\nTIPO: sale\nPOR QUÉ ESTÁ SIENDO INCLUIDO EN EL CÁLCULO: Cumple isThisMonth y status (${d.status}) !== 'ANULADA'.\n`);
  });

  console.log("=== DOCUMENTOS EN CUENTAS POR COBRAR ===");
  cuentasDocs.forEach(d => {
    const saldo = d.saldoPendiente !== undefined ? d.saldoPendiente : d.total;
    console.log(`COLECCIÓN: sales\nID DOCUMENTO: ${d.id}\nFECHA: ${new Date(d.date).toISOString()}\nMONTO: ${saldo}\nTIPO: sale (cc)\nPOR QUÉ ESTÁ SIENDO INCLUIDO EN EL CÁLCULO: Cumple paymentMethod === 'cc' y status (${d.status}) es PENDIENTE o PARCIAL.\n`);
  });

  console.log("=== DOCUMENTOS EN INGRESOS OPERATIVOS ===");
  ingresosDocs.forEach(d => {
    console.log(`COLECCIÓN: cash_movements\nID DOCUMENTO: ${d.id}\nFECHA: ${new Date(d.date || d.createdAt).toISOString()}\nMONTO: ${d.amount}\nTIPO: ${d.type}\nREFERENCIA: ${d.referenceId}\nCATEGORIA: ${d.category}\nPOR QUÉ ESTÁ SIENDO INCLUIDO EN EL CÁLCULO: type === 'in', no es transfer, ni aporte_socio/capital.\n`);
  });
  
  console.log("=== DOCUMENTOS EN EGRESOS OPERATIVOS ===");
  egresosDocs.forEach(d => {
    console.log(`COLECCIÓN: cash_movements\nID DOCUMENTO: ${d.id}\nFECHA: ${new Date(d.date || d.createdAt).toISOString()}\nMONTO: ${d.amount}\nTIPO: ${d.type}\nREFERENCIA: ${d.referenceId}\nCATEGORIA: ${d.category}\nPOR QUÉ ESTÁ SIENDO INCLUIDO EN EL CÁLCULO: type === 'out', no es transfer, ni aporte_socio/capital.\n`);
  });

  process.exit(0);
}

runAudit().catch(console.error);
