'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, LogOut, User, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const dashboardHref = profile?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 group-hover:bg-blue-700 transition-colors">
              <BookOpen className="h-4.5 w-4.5 text-white" size={18} />
            </div>
            <span className="text-lg font-semibold text-slate-900">ExamFlow</span>
          </Link>

          <div className="flex items-center gap-3">
            {user && profile ? (
              <>
                <div className="hidden sm:flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">{profile.full_name}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    profile.role === 'teacher'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {profile.role}
                  </span>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={dashboardHref} className="gap-1.5">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-1.5">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth">Sign In</Link>
                </Button>
                <Button size="sm" asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/auth?tab=signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
