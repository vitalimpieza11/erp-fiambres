import { auth } from '../firebase/firebase';

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'al-vacio';
const BASE_URL = window.location.hostname === 'localhost'
  ? `http://localhost:5001/${PROJECT_ID}/us-central1/api`
  : `https://us-central1-${PROJECT_ID}.cloudfunctions.net/api`;

/**
 * Main API request dispatcher helper.
 * Attaches the authenticated userId automatically.
 */
async function apiRequest(endpoint: string, payload: any, extra?: any): Promise<any> {
  const url = `${BASE_URL}${endpoint}`;
  const userId = auth.currentUser?.uid || 'anonymous';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      payload,
      userId,
      extra
    })
  });

  const resText = await response.text();
  let resData;
  try {
    resData = JSON.parse(resText);
  } catch (_) {
    throw new Error(resText || `Error de servidor HTTP ${response.status}`);
  }

  if (!response.ok || !resData.success) {
    throw new Error(resData.error || 'Ocurrió un error inesperado en el servidor.');
  }

  return resData.id || resData.data;
}

export const erpApi = {
  createSale: async (payload: any, discountPercent: number, shippingCost: number): Promise<string> => {
    return await apiRequest('/createSale', payload, { discountPercent, shippingCost });
  },

  createPurchase: async (payload: any): Promise<string> => {
    return await apiRequest('/createPurchase', payload);
  },

  createProduction: async (payload: any, sourceProductId: string, sourceProductName: string, sourceProductQtyKg: number): Promise<string> => {
    return await apiRequest('/createProduction', payload, { sourceProductId, sourceProductName, sourceProductQtyKg });
  },

  getStock: async (productId: string): Promise<number> => {
    // Falls back to direct call to backend function (via GET/POST, since all endpoints are POST for safety, let's keep it POST!)
    const url = `${BASE_URL}/getStock`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    });
    if (!response.ok) return 0;
    const resData = await response.json();
    return resData.success ? Number(resData.data?.stock || 0) : 0;
  },

  getDashboard: async (): Promise<any> => {
    const url = `${BASE_URL}/getDashboard`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Error al obtener datos del Dashboard');
    const resData = await response.json();
    return resData.success ? resData.data : null;
  }
};
export default erpApi;
