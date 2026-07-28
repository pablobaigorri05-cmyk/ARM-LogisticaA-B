import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleGuard } from './components/RoleGuard';
import { Dashboard } from './pages/dashboard/Dashboard';
import { ActivosList } from './pages/activos/ActivosList';
import { TransferenciasPage } from './pages/combustible/TransferenciasPage';
import { SolicitudesPage } from './pages/combustible/SolicitudesPage';
import { OrdenesCargaPage } from './pages/combustible/OrdenesCargaPage';
import { CentrosCostoPage } from './pages/operaciones/CentrosCostoPage';
import { RendimientoPage } from './pages/operaciones/RendimientoPage';
import { LoginPage } from './pages/auth/LoginPage';
import { UsuariosPage } from './pages/configuracion/UsuariosPage';
import { PreciosPage } from './pages/configuracion/PreciosPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<RoleGuard allow={['administracion']}><Dashboard /></RoleGuard>} />
        <Route path="/activos" element={<RoleGuard allow={['administracion']}><ActivosList /></RoleGuard>} />

        {/* Solicitudes es el único módulo al que entran los Empleados */}
        <Route path="/combustible/solicitudes" element={<SolicitudesPage />} />

        <Route path="/combustible/ordenes" element={<RoleGuard allow={['administracion']}><OrdenesCargaPage /></RoleGuard>} />
        <Route path="/combustible/transferencias" element={<RoleGuard allow={['administracion']}><TransferenciasPage /></RoleGuard>} />
        <Route path="/combustible/rendimiento" element={<RoleGuard allow={['administracion']}><RendimientoPage /></RoleGuard>} />

        <Route path="/operaciones/centros-costo" element={<RoleGuard allow={['administracion']}><CentrosCostoPage /></RoleGuard>} />

        <Route path="/configuracion/usuarios" element={<RoleGuard allow={['administracion']}><UsuariosPage /></RoleGuard>} />
        <Route path="/configuracion/precios" element={<RoleGuard allow={['administracion']}><PreciosPage /></RoleGuard>} />
      </Route>
    </Routes>
  );
}
