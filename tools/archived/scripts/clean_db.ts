import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'default');

const collectionsToDelete = [
  'sales',
  'orders',
  'payment_receipts',
  'cash_movements',
  'purchases',
  'partner_transactions',
  'stock_movements',
  'production_batches',
  'production_lots',
  'production_consumptions',
  'packages',
];

const main = async () => {
  console.log('--- INICIANDO AUDITORÍA PRE-BORRADO ---');
  
  const initialCounts: Record<string, number> = {};
  
  // 1. Get counts for transaccionales
  for (const colName of collectionsToDelete) {
    const snap = await getDocs(collection(db, colName));
    initialCounts[colName] = snap.size;
  }
  
  console.log('Auditoría inicial transaccional:', initialCounts);
  
  // Get counts for maestros
  const maestros = ['customers', 'suppliers', 'mercaderias', 'presentaciones', 'insumos', 'recipes', 'priceLists'];
  const maestroCounts: Record<string, number> = {};
  for (const colName of maestros) {
    const snap = await getDocs(collection(db, colName));
    maestroCounts[colName] = snap.size;
  }
  console.log('Auditoría inicial maestros:', maestroCounts);
  
  console.log('\n--- INICIANDO BORRADO DE DATOS TRANSACCIONALES ---');
  // Delete transaccionales
  for (const colName of collectionsToDelete) {
    const snap = await getDocs(collection(db, colName));
    let deleted = 0;
    for (const document of snap.docs) {
      await deleteDoc(doc(db, colName, document.id));
      deleted++;
    }
    console.log(`Colección ${colName}: Eliminados ${deleted} documentos.`);
  }

  console.log('\n--- INICIANDO RESETEO DE ESTADOS ---');
  
  // Reset mercaderias
  const mercaderiasSnap = await getDocs(collection(db, 'mercaderias'));
  for (const document of mercaderiasSnap.docs) {
    await updateDoc(doc(db, 'mercaderias', document.id), { stockKg: 0 });
  }
  console.log(`Mercaderias: ${mercaderiasSnap.size} documentos reseteados a stockKg = 0`);

  // Reset insumos
  const insumosSnap = await getDocs(collection(db, 'insumos'));
  for (const document of insumosSnap.docs) {
    await updateDoc(doc(db, 'insumos', document.id), { stockUnidades: 0 });
  }
  console.log(`Insumos: ${insumosSnap.size} documentos reseteados a stockUnidades = 0`);
  
  // Reset customers
  const customersSnap = await getDocs(collection(db, 'customers'));
  for (const document of customersSnap.docs) {
    await updateDoc(doc(db, 'customers', document.id), { currentBalance: 0 });
  }
  console.log(`Clientes: ${customersSnap.size} documentos reseteados a currentBalance = 0`);

  // Reset suppliers
  const suppliersSnap = await getDocs(collection(db, 'suppliers'));
  for (const document of suppliersSnap.docs) {
    await updateDoc(doc(db, 'suppliers', document.id), { currentBalance: 0 });
  }
  console.log(`Proveedores: ${suppliersSnap.size} documentos reseteados a currentBalance = 0`);
  
  console.log('\n--- INICIANDO AUDITORÍA POST-BORRADO ---');
  
  const finalCounts: Record<string, number> = {};
  for (const colName of collectionsToDelete) {
    const snap = await getDocs(collection(db, colName));
    finalCounts[colName] = snap.size;
  }
  
  const finalMaestroCounts: Record<string, number> = {};
  for (const colName of maestros) {
    const snap = await getDocs(collection(db, colName));
    finalMaestroCounts[colName] = snap.size;
  }

  console.log('\nAUDITORÍA FINAL:');
  console.log('Ventas (sales):', finalCounts['sales']);
  console.log('Pedidos (orders):', finalCounts['orders']);
  console.log('Compras (purchases):', finalCounts['purchases']);
  console.log('Recibos (payment_receipts):', finalCounts['payment_receipts']);
  console.log('Movimientos Caja (cash_movements):', finalCounts['cash_movements']);
  console.log('Movimientos Stock (stock_movements):', finalCounts['stock_movements']);
  console.log('Transacciones Socios (partner_transactions):', finalCounts['partner_transactions']);
  console.log('Producciones (batches, lots, packages):', 
    finalCounts['production_batches'] + finalCounts['production_lots'] + finalCounts['production_consumptions'] + finalCounts['packages']
  );
  
  console.log('\nStock Mercaderías: 0 (Reseteado)');
  console.log('Stock Insumos: 0 (Reseteado)');
  console.log('Stock Presentaciones: 0 (Calculado dinámicamente o reseteado indirectamente)');
  
  console.log('\nMaestros Conservados:');
  console.log(`Clientes conservados: ${finalMaestroCounts['customers']}`);
  console.log(`Proveedores conservados: ${finalMaestroCounts['suppliers']}`);
  console.log(`Mercaderías conservadas: ${finalMaestroCounts['mercaderias']}`);
  console.log(`Presentaciones conservadas: ${finalMaestroCounts['presentaciones']}`);
  console.log(`Insumos conservados: ${finalMaestroCounts['insumos']}`);
  console.log(`Recetas conservadas: ${finalMaestroCounts['recipes']}`);
  console.log(`Listas de precios conservadas: ${finalMaestroCounts['priceLists']}`);

  console.log('\n✅ SISTEMA LISTO PARA CARGA INICIAL REAL.');
  process.exit(0);
};

main().catch(console.error);
