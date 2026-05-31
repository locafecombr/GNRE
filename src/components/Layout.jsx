import { Outlet, NavLink } from 'react-router-dom';
import { FileUp, LayoutDashboard, Receipt, BarChart2 } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/importacao', label: 'Importação', icon: FileUp },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart2 },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="bg-sidebar w-full md:w-64 md:min-h-screen flex md:flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-syne font-bold text-sidebar-foreground text-sm leading-none">GNRE</p>
            <p className="text-sidebar-foreground/50 text-xs mt-0.5">Manager</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex md:flex-col gap-1 p-3 flex-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-sidebar-primary text-white shadow-md'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
