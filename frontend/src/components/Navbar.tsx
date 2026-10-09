import React from 'react';
import { NavLink } from 'react-router-dom';
import { Navigation, LayoutDashboard, History, Cpu, ShieldCheck, ShieldAlert } from 'lucide-react';

interface NavbarProps {
  engineOnline?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ engineOnline = true }) => {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 px-4 lg:px-8 py-3 flex items-center justify-between">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Navigation className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-blue-400 bg-clip-text text-transparent leading-tight">
            Traffic Route Optimizer
          </h1>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex items-center gap-1 sm:gap-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`
          }
        >
          <Navigation className="w-4 h-4" />
          <span className="hidden md:inline">Route Planner</span>
        </NavLink>

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="hidden md:inline">Dashboard</span>
        </NavLink>

        <NavLink
          to="/history"
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`
          }
        >
          <History className="w-4 h-4" />
          <span className="hidden md:inline">History</span>
        </NavLink>
      </nav>

      {/* Engine Status Indicator */}
      <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-medium">
        <Cpu className="w-3.5 h-3.5 text-blue-400" />
        <span className="hidden sm:inline text-slate-300">C++ Engine:</span>
        {engineOnline ? (
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Active (8080)
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Fallback
          </span>
        )}
      </div>
    </header>
  );
};
