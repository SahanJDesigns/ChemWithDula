'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, GraduationCap, Users, Eye, EyeOff } from 'lucide-react';

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
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName.trim(),
          role,
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
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-slate-50">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-cyan-600 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-12">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">ExamFlow</span>
          </div>
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            The smarter way to run online exams
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed">
            Create image-rich MCQ papers, set timers, and get instant auto-graded results.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: BookOpen, label: 'Exams created', value: '10,000+' },
            { icon: Users, label: 'Active students', value: '50,000+' },
            { icon: GraduationCap, label: 'Teachers onboard', value: '2,000+' },
            { icon: BookOpen, label: 'Questions uploaded', value: '500,000+' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white/10 p-4">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-blue-100">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-200 p-1 mb-8">
            {(['signin', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {tab === 'signup' && (
            <div className="mb-6">
              <p className="text-sm font-medium text-slate-700 mb-3">I am a...</p>
              <div className="grid grid-cols-2 gap-3">
                {(['teacher', 'student'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 py-4 px-3 transition-all ${
                      role === r
                        ? r === 'teacher'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {r === 'teacher' ? <GraduationCap className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                    <span className="text-sm font-semibold capitalize">{r}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
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
                  placeholder={tab === 'signup' ? 'At least 6 characters' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-base font-semibold"
            >
              {loading ? (
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : tab === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {tab === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setTab(tab === 'signin' ? 'signup' : 'signin'); setError(''); }}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              {tab === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
