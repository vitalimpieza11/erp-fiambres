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

export interface PartnerDistribution {
  id?: string;
  date: number;
  partnerId: string;
  partnerName: string;
  amount: number;
  currency: string;
  type: 'retiro' | 'adelanto' | 'honorarios' | 'otro';
  observations: string;
  createdAt: number;
}

export interface Reinvestment {
  id?: string;
  date: number;
  category: string;
  amount: number;
  currency: string;
  observations: string;
  createdAt: number;
}

export interface PartnerContribution {
  id?: string;
  date: number;
  partnerId: string;
  partnerName: string;
  amount: number;
  currency: string;
  type: 'contribution' | 'return'; // contribution for Aporte, return for Devolución
  observations: string;
  createdAt: number;
}

export const useSocietaria = () => {
  const { currentUser } = useAuth();
  
  const [partners, setPartners] = useState<Partner[]>([]);
  const [distributions, setDistributions] = useState<PartnerDistribution[]>([]);
  const [reinvestments, setReinvestments] = useState<Reinvestment[]>([]);
  const [contributions, setContributions] = useState<PartnerContribution[]>([]);
  
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
      },
      (err) => console.error('Error fetching partners:', err)
    );

    // 2. Subscribe to Partner Distributions
    const qDist = query(collection(db, 'partner_distributions'), orderBy('date', 'desc'));
    const unsubDist = onSnapshot(qDist, 
      (snap) => {
        const list: PartnerDistribution[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            date: data.date || Date.now(),
            partnerId: data.partnerId || '',
            partnerName: data.partnerName || '',
            amount: parseNumber(data.amount),
            currency: data.currency || 'ARS',
            type: data.type || 'retiro',
            observations: data.observations || '',
            createdAt: data.createdAt || Date.now(),
          });
        });
        setDistributions(list);
      },
      (err) => console.error('Error fetching partner distributions:', err)
    );

    // 3. Subscribe to Reinvestments
    const qReinv = query(collection(db, 'reinvestments'), orderBy('date', 'desc'));
    const unsubReinv = onSnapshot(qReinv, 
      (snap) => {
        const list: Reinvestment[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            date: data.date || Date.now(),
            category: data.category || '',
            amount: parseNumber(data.amount),
            currency: data.currency || 'ARS',
            observations: data.observations || '',
            createdAt: data.createdAt || Date.now(),
          });
        });
        setReinvestments(list);
      },
      (err) => console.error('Error fetching reinvestments:', err)
    );

    // 4. Subscribe to Partner Contributions (Aportes/Devoluciones)
    const qCont = query(collection(db, 'partner_contributions'), orderBy('date', 'desc'));
    const unsubCont = onSnapshot(qCont, 
      (snap) => {
        const list: PartnerContribution[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            date: data.date || Date.now(),
            partnerId: data.partnerId || '',
            partnerName: data.partnerName || '',
            amount: parseNumber(data.amount),
            currency: data.currency || 'ARS',
            type: data.type || 'contribution',
            observations: data.observations || '',
            createdAt: data.createdAt || Date.now(),
          });
        });
        setContributions(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching partner contributions:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubPartners();
      unsubDist();
      unsubReinv();
      unsubCont();
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

  // Distributions CRUD
  const createDistribution = async (dist: Omit<PartnerDistribution, 'id' | 'createdAt'>) => {
    throw new Error('Bloqueo Arquitectónico: Operación prohibida. Utilice cash_movements en su lugar.');
  };

  const updateDistribution = async (id: string, data: Partial<PartnerDistribution>) => {
    throw new Error('Bloqueo Arquitectónico: Operación prohibida. Utilice cash_movements en su lugar.');
  };

  const deleteDistribution = async (id: string) => {
    throw new Error('Bloqueo Arquitectónico: Operación prohibida. Utilice cash_movements en su lugar.');
  };

  // Reinvestments CRUD
  const createReinvestment = async (reinv: Omit<Reinvestment, 'id' | 'createdAt'>) => {
    throw new Error('Bloqueo Arquitectónico: Operación prohibida. Utilice cash_movements en su lugar.');
  };

  const updateReinvestment = async (id: string, data: Partial<Reinvestment>) => {
    throw new Error('Bloqueo Arquitectónico: Operación prohibida. Utilice cash_movements en su lugar.');
  };

  const deleteReinvestment = async (id: string) => {
    throw new Error('Bloqueo Arquitectónico: Operación prohibida. Utilice cash_movements en su lugar.');
  };

  // Contributions CRUD
  const createContribution = async (cont: Omit<PartnerContribution, 'id' | 'createdAt'>) => {
    throw new Error('Bloqueo Arquitectónico: Operación prohibida. Utilice cash_movements en su lugar.');
  };

  const updateContribution = async (id: string, data: Partial<PartnerContribution>) => {
    throw new Error('Bloqueo Arquitectónico: Operación prohibida. Utilice cash_movements en su lugar.');
  };

  const deleteContribution = async (id: string) => {
    throw new Error('Bloqueo Arquitectónico: Operación prohibida. Utilice cash_movements en su lugar.');
  };

  return {
    partners,
    distributions,
    reinvestments,
    contributions,
    loading,
    error,
    savePartner,
    deletePartner,
    createDistribution,
    updateDistribution,
    deleteDistribution,
    createReinvestment,
    updateReinvestment,
    deleteReinvestment,
    createContribution,
    updateContribution,
    deleteContribution
  };
};

export default useSocietaria;
