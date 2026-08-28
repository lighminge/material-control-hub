import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardList, ShieldAlert, PieChart, AlarmClock, FileWarning, Package } from 'lucide-react';

const navItems = [
  { name: '儀表板', path: '/', icon: LayoutDashboard },
  { name: '領料單管理', path: '/requisitions', icon: ClipboardList },
  { name: '物料管制', path: '/controls', icon: ShieldAlert },
  { name: '物料庫存', path: '/materials', icon: Package },
  { name: '不良品管理', path: '/defective', icon: FileWarning },
  { name: '稽催作業', path: '/expediting', icon: AlarmClock },
  { name: '統計作業', path: '/statistics', icon: PieChart },
  { name: '人員管理', path: '/staff', icon: Users },
];

export function Sidebar() {
  return (
    <aside className="w-72 bg-background flex flex-col h-full shadow-[6px_0_12px_#e0dcd1] pl-10">
      <div className="h-16 flex items-center justify-center px-4 font-bold text-xl text-primary">
        Material Hub
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mb-2 transition-all ${
                  isActive
                    ? 'clay-btn-primary font-bold'
                    : 'text-muted-foreground hover:clay-btn hover:text-foreground'
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
