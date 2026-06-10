import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface PriceList {
  id?: string;
  name: string;
  target: string;
  type?: 'presentaciones' | 'mercaderias';
  mode?: 'auto' | 'manual';
  margin: number;
  isActive: boolean;
  includedTypes?: string[];
  productOverrides?: {
    [productId: string]: {
      margin: number;
      mode?: 'auto' | 'manual';
      manualPrice?: number;
      excluded?: boolean;
      itemType?: 'mercaderia' | 'presentacion' | 'receta';
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
        console.log("[FORENSIC] 8. Dentro del onSnapshot que vuelve a cargar las listas. docs count:", snapshot.docs.length);
        
        // [STEP 8] datos que vuelven desde Firestore luego del guardado
        console.log("[STEP 8] datos que vuelven desde Firestore (1er doc):", JSON.stringify(snapshot.docs[0]?.data(), null, 2));

        const list: PriceList[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const legacyType = data.type;

          let overrides = data.productOverrides || {};

          // Compatibilidad retroactiva: asignar itemType a cada overide si hay legacyType
          if (legacyType) {
            const defaultItemType = legacyType === 'mercaderias' ? 'mercaderia' : 'presentacion';
            const updatedOverrides: Record<string, any> = {};
            for (const [key, val] of Object.entries(overrides)) {
              updatedOverrides[key] = {
                ...(val as any),
                itemType: (val as any).itemType || defaultItemType
              };
            }
            overrides = updatedOverrides;
          }

          list.push({
            id: doc.id,
            name: data.name || '',
            target: data.target || '',
            type: legacyType, // Keep it for backwards compatibility if needed
            mode: data.mode || 'auto',
            margin: Number(data.margin) || 0,
            isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
            includedTypes: data.includedTypes || [],
            productOverrides: overrides,
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
    console.log("[FORENSIC] 5. Dentro de savePriceList(). id:", id, "payload:", JSON.stringify(priceList, null, 2));
    
    // [STEP 5] payload recibido dentro de savePriceList
    console.log("[STEP 5] payload recibido dentro de savePriceList:", JSON.stringify(priceList, null, 2));
    
    // [STEP 6] documentId utilizado
    console.log("[STEP 6] documentId utilizado:", id);

    try {
      if (id) {
        console.log("[FORENSIC] 6. Antes de updateDoc(). documentId:", id);
        const ref = doc(db, 'priceLists', id);
        await updateDoc(ref, { ...priceList, updatedAt: Date.now() } as any);
        console.log("[FORENSIC] 7. Después de updateDoc(). documentId:", id);
        
        // [STEP 7] resultado de updateDoc
        console.log("[STEP 7] resultado de updateDoc: EXITOSO");
      } else {
        console.log("[FORENSIC] 6. Antes de setDoc() nuevo documento.");
        const ref = doc(collection(db, 'priceLists'));
        await setDoc(ref, { ...priceList, createdAt: Date.now(), updatedAt: Date.now() } as any);
        console.log("[FORENSIC] 7. Después de setDoc() nuevo documento. documentId:", ref.id);
        console.log("[STEP 7] resultado de setDoc: EXITOSO");
      }
    } catch (error) {
       console.log("[STEP 7] resultado de updateDoc: ERROR", error);
       throw error;
    }
  };

  const deletePriceList = async (id: string) => {
    const ref = doc(db, 'priceLists', id);
    await deleteDoc(ref);
  };

  return { priceLists, loading, error, savePriceList, deletePriceList };
};
