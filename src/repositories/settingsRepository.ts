import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SystemSettings } from '../types/domain';

export const settingsRepository = {
  async getSettings(): Promise<SystemSettings> {
    try {
      const docRef = doc(db, 'settings', 'global');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { usePackages: false, allowNegativeStock: true, margenObjetivo: 35, ...snap.data() } as SystemSettings;
      }
    } catch (e) {
      console.error("Error fetching settings:", e);
    }
    // Default to false (Simplified mode)
    return { usePackages: false, allowNegativeStock: true, margenObjetivo: 35 };
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<void> {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(docRef, settings, { merge: true });
  }
};
