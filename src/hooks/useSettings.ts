import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface SystemSettings {
  empresa_nombre: string;
  empresa_razon: string;
  empresa_cuit: string;
  empresa_direccion: string;
  empresa_telefono: string;
  empresa_email: string;
  empresa_whatsapp: string;
  empresa_instagram: string;
  
  comercial_listaDefault: string;
  comercial_margenDefault: number;
  comercial_politicaDescuento: string;
  
  costo_bolsa: number;
  costo_etiqueta: number;
  costo_manoObra: number;
  
  ventas_numeracionAutomatica: boolean;
  ventas_prefijoRemito: string;
  ventas_proximoNumero: number;
  ventas_observacionesDefault: string;
  ventas_textoPieRemito: string;
  ventas_firmaDigital: boolean;
  
  stock_diasAlertaVencimiento: number;
  stock_criticoGlobal: number;
  stock_notificarEmail: boolean;
  stock_permitirNegativo: boolean;
  
  prod_mermaEstandar: number;
  prod_unidadMedida: string;
  
  clientes_diasPago: number;
  clientes_limiteCredito: number;
  clientes_bloquearMorosos: boolean;
  clientes_alertaMorosidad: string;
  
  tesoreria_fondoCajaFijo: number;
  tesoreria_bancos: string;
  tesoreria_mediosPago: string;
  
  currencies: { code: string; symbol: string; rate: number }[];
  reinvestment_categories: string[];
  expense_categories: string[];
}

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
  
  costo_bolsa: 0,
  costo_etiqueta: 0,
  costo_manoObra: 0,
  
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
  tesoreria_mediosPago: "Efectivo\nTransferencia\nCheque a 30 días\nCheque a 60 días",
  
  currencies: [
    { code: 'ARS', symbol: '$', rate: 1 },
    { code: 'USD', symbol: 'U$S', rate: 1000 }
  ],
  reinvestment_categories: [
    'Maquinaria',
    'Vehículos',
    'Marketing',
    'Tecnología',
    'Infraestructura',
    'Mercadería estratégica',
    'Capital de trabajo'
  ],
  expense_categories: [
    'Mercadería',
    'Alquiler',
    'Servicios',
    'Sueldos',
    'Impuestos',
    'Combustible',
    'Logística',
    'Marketing',
    'Mantenimiento',
    'Honorarios',
    'Otros'
  ]
};

export const useSettings = () => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setSettings({ ...defaultSettings, ...snap.data() } as SystemSettings);
        } else {
          setSettings(defaultSettings);
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setSettings(defaultSettings);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const saveSettings = async (newSettings: SystemSettings) => {
    const ref = doc(db, 'settings', 'global');
    await setDoc(ref, newSettings);
  };

  return { settings, saveSettings, loading, error };
};
export default useSettings;
