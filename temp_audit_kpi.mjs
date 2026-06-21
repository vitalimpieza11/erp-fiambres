import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "dummy",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "dummy",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "dummy",
  appId: process.env.VITE_FIREBASE_APP_ID || "dummy"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'default');

async function getKPIs() {
  const [salesSnap, stockSnap, cajaSnap] = await Promise.all([
    getDocs(collection(db, 'sales')),
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'caja_movements'))
  ]);

  const sales = [];
  salesSnap.forEach(d => sales.push(d.data()));

  const products = [];
  stockSnap.forEach(d => products.push({ id: d.id, ...d.data() }));

  const movements = [];
  cajaSnap.forEach(d => movements.push(d.data()));

  const ventasHist = sales
    .filter(s => s.status !== 'ANULADO')
    .reduce((acc, s) => acc + (s.totalAmount || 0), 0);

  const cmvHistoricoAcumulado = sales
    .filter(s => s.status !== 'ANULADO')
    .reduce((acc, s) => {
      if (s.isHistorical && s.costoTotal !== undefined) return acc + s.costoTotal;

      const saleCost = (s.items || []).reduce((itemAcc, item) => {
        if (item.costoTotalHistorico !== undefined) return itemAcc + item.costoTotalHistorico;
        if (item.costoTotal !== undefined) return itemAcc + item.costoTotal;
        
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          const qty = prod.unitType === 'KG' ? (item.pesoReal || item.cantidad) : item.cantidad;
          return itemAcc + (qty * (prod.costoActual || prod.costoUltimaCompra || 0));
        }
        return itemAcc;
      }, 0);

      return acc + saleCost;
    }, 0);

  const gananciaBrutaAcumulada = ventasHist - cmvHistoricoAcumulado;

  const gastosOperativosAcumulados = movements
    .filter(m => m.type === 'EXPENSE' && !m.isDeleted)
    .filter(m => {
      const cat = (m.category || '').toUpperCase();
      const excludeCategories = [
        'COMPRA_PROVEEDOR', 'SOCIOS', 'APORTE_SOCIOS_INICIAL',
        'ANULACION', 'ANULACION_VENTA', 'ANULACION_COMPRA',
        'SALDO_INICIAL', 'TRANSFERENCIA', 'MOVIMIENTO_INTERNO'
      ];
      return !excludeCategories.includes(cat);
    })
    .reduce((acc, m) => acc + (m.amount || 0), 0);

  const resultadoOperativoAcumulado = gananciaBrutaAcumulada - gastosOperativosAcumulados;

  console.log("=== KPI RESULTS ===");
  console.log("Ventas Históricas Totales: ", ventasHist);
  console.log("CMV Histórico Acumulado: ", cmvHistoricoAcumulado);
  console.log("Ganancia Bruta Acumulada: ", gananciaBrutaAcumulada);
  console.log("Gastos Operativos Acumulados: ", gastosOperativosAcumulados);
  console.log("Resultado Operativo Acumulado: ", resultadoOperativoAcumulado);
}

getKPIs().catch(console.error).then(() => process.exit(0));
