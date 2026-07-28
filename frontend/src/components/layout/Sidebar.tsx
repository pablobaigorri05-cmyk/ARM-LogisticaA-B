import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { logout } from '../../lib/auth';

type NavItem = { label: string; to: string };
type NavSection = { title: string; items: NavItem[] };

const seccionesAdministracion: NavSection[] = [
  { title: 'Activos', items: [{ label: 'Vehículos y más', to: '/activos' }] },
  {
    title: 'Combustible',
    items: [
      { label: 'Solicitudes', to: '/combustible/solicitudes' },
      { label: 'Órdenes de carga', to: '/combustible/ordenes' },
      { label: 'Transferencias', to: '/combustible/transferencias' },
      { label: 'Rendimiento', to: '/combustible/rendimiento' },
    ],
  },
  {
    title: 'Operaciones',
    items: [{ label: 'Centros de costo', to: '/operaciones/centros-costo' }],
  },
  {
    title: 'Configuración',
    items: [{ label: 'Precios de combustible', to: '/configuracion/precios' }],
  },
];

function LogoEmpresa() {
  return (
    <div className="mb-4 px-2">
      <img src="/logo-armegom.png" alt="Armegom" className="h-8 w-auto object-contain object-left" />
    </div>
  );
}

export function Sidebar() {
  const { perfil, user } = useAuth();
  const esEmpleado = perfil?.rol === 'empleado';

  const linkClass = (isActive: boolean) =>
    `block rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
      isActive ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-teal-50 hover:text-teal-700'
    }`;

  // Un Empleado solo tiene un lugar a donde ir: Solicitudes. Ni siquiera
  // le mostramos el resto del menú, aunque las rutas ya estén protegidas
  // por RoleGuard — no tiene sentido mostrar algo a lo que no puede entrar.
  if (esEmpleado) {
    return (
      <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50 px-2 py-4">
        <LogoEmpresa />
        <NavLink to="/combustible/solicitudes" className={({ isActive }) => linkClass(isActive)}>
          Solicitudes de combustible
        </NavLink>
        <div className="mt-auto border-t border-slate-200 px-2 pt-3">
          <p className="truncate text-[12px] text-slate-700">{perfil?.nombre ?? user?.email}</p>
          <button onClick={() => logout()} className="text-[11.5px] text-slate-400 hover:text-teal-700">
            Cerrar sesión
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 px-2 py-4">
      <LogoEmpresa />

      <NavLink to="/" end className={({ isActive }) => linkClass(isActive) + ' mb-3'}>
        Dashboard
      </NavLink>

      {seccionesAdministracion.map((section) => (
        <div key={section.title} className="mb-3">
          <div className="mb-1 px-3 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
            {section.title}
          </div>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => linkClass(isActive)}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-auto space-y-0.5">
        <NavLink to="/configuracion/usuarios" className={({ isActive }) => linkClass(isActive)}>
          Usuarios
        </NavLink>
        <div className="mt-3 border-t border-slate-200 px-2 pt-3">
          <p className="truncate text-[12px] text-slate-700">{perfil?.nombre ?? user?.email}</p>
          <button onClick={() => logout()} className="text-[11.5px] text-slate-400 hover:text-teal-700">
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}
