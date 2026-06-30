import { Outlet } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';

export default function MobileLayout() {
  return (
    <div className="mobile-app-container">
      {/* Outlet renderiza la pantalla activa (Home, Pedidos, etc.) */}
      <Outlet />
      
      {/* Navegación inferior fija */}
      <MobileBottomNav />
    </div>
  );
}
