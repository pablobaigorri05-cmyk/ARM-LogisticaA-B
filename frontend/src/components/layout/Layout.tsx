import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Footer } from '../Footer';

export function Layout() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col bg-white">
        <main className="flex-1 p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
