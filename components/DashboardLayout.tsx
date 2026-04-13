'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { BookOpen, LayoutGrid, ChartBar as BarChart3, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import Navbar from './Navbar';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: 'teacher' | 'student';
}

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  const handleSignOut = async () => {
    setSidebarOpen(false);
    await signOut();
    router.push('/');
  };

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setSidebarOpen]);

  const handleNavClick = () => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const navItems: NavItem[] =
    role === 'teacher'
      ? [
          { label: 'Exams',   href: '/teacher/dashboard', icon: <LayoutGrid className="h-4 w-4" /> },
          { label: 'Create',  href: '/teacher/exams/new', icon: <BookOpen className="h-4 w-4" /> },
          { label: 'Results', href: '/teacher/results',   icon: <BarChart3 className="h-4 w-4" /> },
        ]
      : [
          { label: 'Exams',   href: '/student/dashboard', icon: <BookOpen className="h-4 w-4" /> },
          { label: 'Results', href: '/student/results',   icon: <BarChart3 className="h-4 w-4" /> },
        ];

  return (
    <> 
      <Navbar />
    <div className="flex h-screen overflow-hidden bg-muted/40">

      {/* Backdrop — mobile only */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}


      {/* Sidebar */}
      <aside
        className={`
          flex flex-col border-r border-border bg-card h-screen
          transition-all duration-300
          fixed inset-y-0 left-0 z-30 w-64 
          md:static md:z-auto md:translate-x-0 md:flex md:shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">

           <button
            onClick={()=> setSidebarOpen(false)}
              className="flex min-w-0 items-center gap-2 rounded-lg px-2  pb-6 text-foreground transition-opacity hover:opacity-90 md:hidden"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <BookOpen className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="font-semibold tracking-tight inline ">CHEM WITH DULA</span>
            </button>

          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 items-center justify-center ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </div>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <button
            onClick={handleSignOut}
            className="mt-4 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4 inline-block mr-4" />
            Sign out
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>

    </div>
    </>
  );
}