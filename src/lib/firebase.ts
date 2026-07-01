import { initializeApp } from "firebase/app";
import { getFirestore, collection } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const requiredVars = {
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId
};

const missingVars = Object.entries(requiredVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(`Missing Firebase configuration variables: ${missingVars.join(', ')}. Please check your .env file.`);
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, 'default');
export const auth = getAuth(app);

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
  PURCHASES: collection(db, 'purchases'),
  PACKAGES: collection(db, 'packages'),
  FINANCIAL_ACCOUNTS: collection(db, 'financial_accounts')
};

export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const newObj = {} as any;
    for (const key of Object.keys(obj as any)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        newObj[key] = removeUndefinedFields(val);
      }
    }
    return newObj as T;
  }
  return obj;
}
