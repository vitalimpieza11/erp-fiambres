import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface PriceList {
  id?: string;
  name: string;
  target: string;
  margin: number;
  isActive: boolean;
  productOverrides?: {
    [productId: string]: {
      margin: number;
    };
  };
  createdAt: number;
  updatedAt: number;
}

export const usePriceLists = () => {
  const { currentUser } = useAuth();
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'priceLists'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: PriceList[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            name: data.name || '',
            target: data.target || '',
            margin: Number(data.margin) || 0,
            isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
            productOverrides: data.productOverrides || {},
            createdAt: data.createdAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
          });
        });
        setPriceLists(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setPriceLists([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const savePriceList = async (priceList: Omit<PriceList, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    if (id) {
      const ref = doc(db, 'priceLists', id);
      await updateDoc(ref, { ...priceList, updatedAt: Date.now() } as any);
    } else {
      const ref = doc(collection(db, 'priceLists'));
      await setDoc(ref, { ...priceList, createdAt: Date.now(), updatedAt: Date.now() } as any);
    }
  };

  const deletePriceList = async (id: string) => {
    const ref = doc(db, 'priceLists', id);
    await deleteDoc(ref);
  };

  const seedPriceLists = async () => {
    const mockLists = [
      { name: 'Lista Gastronómica', target: 'Bares y Restaurantes', margin: 30, isActive: true, productOverrides: {} },
      { name: 'Lista Kioscos', target: 'Kioscos y Minimarkets', margin: 40, isActive: true, productOverrides: {} },
      { name: 'Lista Minorista', target: 'Consumidor Final', margin: 55, isActive: true, productOverrides: {} },
      { name: 'Mayorista (Volumen)', target: 'Supermercados', margin: 20, isActive: false, productOverrides: {} },
    ];
    for (const list of mockLists) {
      const ref = doc(collection(db, 'priceLists'));
      await setDoc(ref, { ...list, createdAt: Date.now(), updatedAt: Date.now() });
    }
  };

  return { priceLists, loading, error, savePriceList, deletePriceList, seedPriceLists };
};
