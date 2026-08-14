import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardList, ShieldAlert } from 'lucide-react';

const navItems = [
  { name: '儀表板', path: '/', icon: LayoutDashboard },
  { name: '領料單管理', path: '/requisitions', icon: ClipboardList },
  { name: '物料管制', path: '/controls', icon: ShieldAlert },
  { name: '物料庫存', path: '/materials', icon: ClipboardList },
  { name: '人員管理', path: '/staff', icon: Users },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card flex flex-col h-full">
      <div className="h-14 flex items-center px-4 border-b font-semibold text-lg text-primary">
        Material Control Hub
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
