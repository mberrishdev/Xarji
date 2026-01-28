import { NavLink, Outlet } from "react-router-dom";
import { cn } from "../lib/utils";
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  Tag,
  Settings,
  Wallet,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", to: "/", icon: LayoutDashboard },
  { name: "Transactions", to: "/transactions", icon: Receipt },
  { name: "Analytics", to: "/analytics", icon: PieChart },
  { name: "Categories", to: "/categories", icon: Tag },
  { name: "Settings", to: "/settings", icon: Settings },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar - Desktop */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 bg-white border-r border-slate-200 lg:block">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Wallet className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Expense Tracker</h1>
            <p className="text-xs text-slate-500">Track your spending</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64">
        {/* Top bar - Mobile */}
        <div className="sticky top-0 z-40 lg:hidden bg-white border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Wallet className="w-5 h-5 text-primary-600" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Expense Tracker</h1>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>

        {/* Bottom Navigation - Mobile */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-slate-200">
          <div className="flex justify-around">
            {navigation.slice(0, 4).map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                    isActive ? "text-primary-600" : "text-slate-500"
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}
          </div>
        </nav>
      </main>
    </div>
  );
}
