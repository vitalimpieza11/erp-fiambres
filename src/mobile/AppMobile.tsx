import React from 'react';
import MobileRouter from './router/MobileRouter';
import './mobile.css';

/**
 * AppMobile
 * 
 * Este es el punto de entrada principal y exclusivo para la experiencia Mobile.
 * Posee sus propios estilos y su propio router aislado del ERP Desktop.
 */
export default function AppMobile() {
  return (
    <React.StrictMode>
      <MobileRouter />
    </React.StrictMode>
  );
}
