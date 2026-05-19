import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { 
  Customer, 
  Supplier, 
  SystemSettings 
} from '../types/database';

export const initializeCollections = async () => {
  try {
    // 1. Initializing settings
    const settingsRef = doc(db, 'settings', 'global');
    const settingsSnap = await getDocs(collection(db, 'settings'));
    if (settingsSnap.empty) {
      const defaultSettings: SystemSettings = {
        empresa_nombre: "Fiambres del Sur S.A.",
        empresa_razon: "Fiambres del Sur Sociedad Anónima",
        empresa_cuit: "30-12345678-9",
        empresa_direccion: "Av. San Martín 1234, CABA",
        empresa_telefono: "(011) 4567-8901",
        empresa_email: "info@fiambresdelsur.com.ar",
        empresa_whatsapp: "+54 9 11 1234-5678",
        empresa_instagram: "@fiambresdelsur",
        
        comercial_listaDefault: "1",
        comercial_margenDefault: 30,
        comercial_politicaDescuento: "1",
        
        costo_bolsa: 15,
        costo_etiqueta: 8.5,
        costo_manoObra: 250,
        
        ventas_numeracionAutomatica: true,
        ventas_prefijoRemito: "REM-0001",
        ventas_proximoNumero: 1049,
        ventas_observacionesDefault: "La mercadería viaja por cuenta y orden del comprador.",
        ventas_textoPieRemito: "Gracias por su compra.",
        ventas_firmaDigital: true,
        
        stock_diasAlertaVencimiento: 15,
        stock_criticoGlobal: 10,
        stock_notificarEmail: true,
        stock_permitirNegativo: false,
        
        prod_mermaEstandar: 12,
        prod_unidadMedida: "kg",
        
        clientes_diasPago: 30,
        clientes_limiteCredito: 500000,
        clientes_bloquearMorosos: true,
        clientes_alertaMorosidad: "2",
        
        tesoreria_fondoCajaFijo: 50000,
        tesoreria_bancos: "Banco Galicia\nBanco Santander\nMercado Pago",
        tesoreria_mediosPago: "Efectivo\nTransferencia\nCheque a 30 días\nCheque a 60 días"
      };
      await setDoc(settingsRef, defaultSettings);
      console.log('Collection initialized: settings');
    }

    // 2. Customers initialization bypassed (Empty state guaranteed)
    // 3. Suppliers initialization bypassed (Empty state guaranteed)

    // 4. Checking existence/initialization logs for other collections
    // sales, purchases, production_batches, stock_movements, cash_movements, products
    const salesSnap = await getDocs(collection(db, 'sales'));
    if (salesSnap.empty) {
      console.log('Collection ready: sales (empty)');
    }
    const purchasesSnap = await getDocs(collection(db, 'purchases'));
    if (purchasesSnap.empty) {
      console.log('Collection ready: purchases (empty)');
    }
    const productionSnap = await getDocs(collection(db, 'production_batches'));
    if (productionSnap.empty) {
      console.log('Collection ready: production_batches (empty)');
    }
    const stockSnap = await getDocs(collection(db, 'stock_movements'));
    if (stockSnap.empty) {
      console.log('Collection ready: stock_movements (empty)');
    }
    const cashSnap = await getDocs(collection(db, 'cash_movements'));
    if (cashSnap.empty) {
      console.log('Collection ready: cash_movements (empty)');
    }
    
    console.log('Firestore initialization complete.');
  } catch (error) {
    console.error('Error initializing Firestore collections:', error);
  }
};
