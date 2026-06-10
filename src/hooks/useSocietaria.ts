import { useState, useEffect } from 'react';
import { 
  collection, onSnapshot, query, orderBy, 
  doc, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, getDocs, where 
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { parseNumber } from '../utils/format';

export interface Partner {
  id?: string;
  name: string;
  share: number; // percentage (0-100)
  isActive: boolean;
  observations: string;
  createdAt: number;
}

export const useSocietaria = () => {
  const { currentUser } = useAuth();
  
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Subscribe to Partners
    const qPartners = query(collection(db, 'partners'), orderBy('name', 'asc'));
    const unsubPartners = onSnapshot(qPartners, 
      (snap) => {
        const list: Partner[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || '',
            share: parseNumber(data.share),
            isActive: data.isActive ?? true,
            observations: data.observations || '',
            createdAt: data.createdAt || Date.now(),
          });
        });
        setPartners(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching partners:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubPartners();
    };
  }, [currentUser]);

  // Partners CRUD
  const savePartner = async (partner: Omit<Partner, 'id' | 'createdAt'>, id?: string) => {
    if (id) {
      const ref = doc(db, 'partners', id);
      await updateDoc(ref, { ...partner });
    } else {
      const ref = collection(db, 'partners');
      await addDoc(ref, { ...partner, createdAt: Date.now() });
    }
  };

  const deletePartner = async (id: string) => {
    const ref = doc(db, 'partners', id);
    await deleteDoc(ref);
  };

  return {
    partners,
    loading,
    error,
    savePartner,
    deletePartner
  };
};

export default useSocietaria;
