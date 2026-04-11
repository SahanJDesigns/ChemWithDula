'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardRedirect() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        router.push('/auth');
      } else if (profile.role === 'teacher') {
        router.push('/teacher/dashboard');
      } else {
        router.push('/student/dashboard');
      }
    }
  }, [profile, loading, router]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );
}
