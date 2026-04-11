'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BookOpen, LayoutGrid, ChartBar as BarChart3, Clock, CircleCheck as CheckCircle2, CircleAlert as AlertCircle } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: 'teacher' | 'student';
  title: string;
  subtitle?: string;
  navItems: NavItem[];
}

export default function DashboardLayout({
  children,
  role,
  title,
  subtitle,
  navItems,
}: DashboardLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:w-64 border-r border-slate-200 bg-white flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900">ExamFlow</span>
          </div>
          <p className="text-xs text-slate-500 font-medium capitalize">{role} Account</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-5 w-5 items-center justify-center ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                    {item.icon}
                  </div>
                  {item.label}
                </div>
                {item.badge !== undefined && (
                  <span className="ml-auto text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {/* Mobile sidebar toggle - simplified header */}
        <div className="lg:hidden border-b border-slate-200 bg-white px-4 py-4 flex items-center justify-between">
          <h1 className="font-semibold text-slate-900">{title}</h1>
        </div>

        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-6 sm:px-8 py-6">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-slate-500 mt-1 text-sm">{subtitle}</p>}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
