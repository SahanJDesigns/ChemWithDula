'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, Users, Eye, EyeOff, Clock, ChartBar } from 'lucide-react';

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<'signin' | 'signup'>(
    searchParams.get('tab') === 'signup' ? 'signup' : 'signin'
  );
  const [role, setRole] = useState<'teacher' | 'student'>(
    searchParams.get('role') === 'teacher' ? 'teacher' : 'student'
  );
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && profile) {
      router.push(profile.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    }
  }, [profile, authLoading, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) {
      setError('Name required.');
      return;
    }
    if (password.length < 6) {
      setError('Password: min 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName.trim(),
          role,
          phone: phone.trim(),
        });
        if (profileError) throw profileError;
        router.push(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh)] bg-muted/30">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-primary to-teal-900 p-10 text-primary-foreground lg:flex xl:p-14">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-foreground/15">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold">ExamFlow</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">Run exams in one place</h2>
          <ul className="mt-8 space-y-4 text-sm text-primary-foreground/90">
            <li className="flex items-center gap-3">
              <Clock className="h-5 w-5 shrink-0 opacity-90" />
              Timed attempts and windows
            </li>
            <li className="flex items-center gap-3">
              <ChartBar className="h-5 w-5 shrink-0 opacity-90" />
              Auto-grade on submit
            </li>
            <li className="flex items-center gap-3">
              <Users className="h-5 w-5 shrink-0 opacity-90" />
              Separate teacher &amp; student views
            </li>
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/60">&copy; {new Date().getFullYear()} ExamFlow</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex rounded-xl border border-border bg-muted/50 p-1">
            {(['signin', 'signup'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setError('');
                }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'signin' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <Label htmlFor="fullName">Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>
            )}

              {tab === 'signup' && (
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="text"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>
            )}
           
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={tab === 'signup' ? '6+ characters' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="h-11 w-full text-base font-semibold">
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : tab === 'signin' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {tab === 'signin' ? 'No account? ' : 'Have an account? '}
            <button
              type="button"
              onClick={() => {
                setTab(tab === 'signin' ? 'signup' : 'signin');
                setError('');
              }}
              className="font-semibold text-primary hover:underline"
            >
              {tab === 'signin' ? 'Register' : 'Sign in'}
            </button>
          </p>
          <p className="mt-4 text-center">
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <AuthForm />
    </Suspense>
  );
}
