import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="min-h-screen flex-1 bg-white p-6">
        <Outlet />
      </main>
    </div>
  );
}
