import { initializeApp } from "firebase/app";
import { getFirestore, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy-domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy-bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "dummy-sender",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "dummy-app"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const COLLECTIONS = {
  CUSTOMERS: collection(db, 'customers'),
  SUPPLIERS: collection(db, 'suppliers'),
  PRODUCTS: collection(db, 'products'),
  RECIPES: collection(db, 'recipes'),
  SHAREHOLDERS: collection(db, 'shareholders'),
  ORDERS: collection(db, 'orders'),
  STOCK_MOVEMENTS: collection(db, 'stock_movements'),
  SALES: collection(db, 'sales'),
  CAJA_MOVEMENTS: collection(db, 'caja_movements'),
  SHAREHOLDER_MOVEMENTS: collection(db, 'shareholder_movements'),
  USERS: collection(db, 'users'),
  CUSTOMER_MOVEMENTS: collection(db, 'customer_movements'),
  SETTINGS: collection(db, 'settings'),
  PRICE_LISTS: collection(db, 'price_lists'),
  EQUIVALENCES: collection(db, 'equivalences'),
  SUPPLIER_MOVEMENTS: collection(db, 'supplier_movements'),
  PURCHASES: collection(db, 'purchases')
};
