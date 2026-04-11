'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { BookOpen, LogOut, User, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { toggleSidebar } = useSidebar();
  const router = useRouter();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
            onClick={toggleSidebar}
              className="flex min-w-0 items-center gap-2 rounded-lg pr-2 text-foreground transition-opacity hover:opacity-90"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <BookOpen className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="hidden font-semibold tracking-tight sm:inline">ExamFlow</span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user && profile ? (
              <>
                <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="max-w-[140px] truncate text-sm font-medium">{profile.full_name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      profile.role === 'teacher'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    {profile.role}
                  </span>
                </div>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth?tab=signup">Start</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
