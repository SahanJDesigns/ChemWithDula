'use client';

import Link from 'next/link';
import { BookOpen, Clock, Image, ChartBar as BarChart3, CircleCheck as CheckCircle2, ArrowRight, Shield, Zap, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: BookOpen,
    title: 'Create MCQ Exams',
    description: 'Build comprehensive multiple-choice exams with rich text and image-based questions.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Image,
    title: 'Image Questions',
    description: 'Upload images directly into questions for diagrams, charts, and visual assessments.',
    color: 'bg-teal-50 text-teal-600',
  },
  {
    icon: Clock,
    title: 'Timed Exams',
    description: 'Set precise start and end times. Students are auto-submitted when time expires.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: BarChart3,
    title: 'Instant Grading',
    description: 'Exams are automatically graded the moment time ends or students submit early.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Shield,
    title: 'Secure Platform',
    description: 'Role-based access control ensures teachers and students see only what they should.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: Users,
    title: 'Student Analytics',
    description: 'View detailed results including individual question performance for every student.',
    color: 'bg-sky-50 text-sky-600',
  },
];

const steps = [
  { number: '01', title: 'Create an Exam', description: 'Set title, duration, and schedule. Add MCQ questions with optional image uploads.', role: 'Teacher' },
  { number: '02', title: 'Publish & Share', description: 'Publish your exam so students can find and access it within the time window.', role: 'Teacher' },
  { number: '03', title: 'Take the Exam', description: 'Students start the exam, answer questions with a live countdown timer visible.', role: 'Student' },
  { number: '04', title: 'Auto-Graded Results', description: 'Scores are calculated instantly. Teachers review detailed per-student breakdowns.', role: 'Both' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white pt-16 pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-white to-white opacity-70" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 mb-8">
            <Zap className="h-3.5 w-3.5" />
            Automated grading &amp; real-time timers
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-tight mb-6">
            Exams made{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
              effortless
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-slate-600 leading-relaxed mb-10">
            ExamFlow lets teachers build image-rich MCQ exams and students take them with live timers.
            Grading happens automatically the instant time runs out.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="bg-blue-600 hover:bg-blue-700 text-base h-12 px-8 gap-2">
              <Link href="/auth?tab=signup">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-base h-12 px-8">
              <Link href="/auth">Sign In</Link>
            </Button>
          </div>
          {/* Hero visual */}
          <div className="mt-16 mx-auto max-w-4xl">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs text-slate-400 font-medium">ExamFlow &mdash; Exam Portal</span>
              </div>
              <div className="p-6 grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-4">
                  <div className="rounded-lg border border-slate-200 p-4 text-left">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Question 3 of 10</p>
                    <p className="text-sm font-medium text-slate-800 mb-3">What is the primary function of mitochondria in a cell?</p>
                    <div className="space-y-2">
                      {['Protein synthesis', 'Energy production (ATP)', 'Cell division', 'DNA replication'].map((opt, i) => (
                        <div key={i} className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm border cursor-pointer transition-all ${i === 1 ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${i === 1 ? 'border-blue-500' : 'border-slate-300'}`}>
                            {i === 1 && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                          </div>
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                    <p className="text-xs font-medium text-amber-600 mb-1">Time Remaining</p>
                    <p className="text-2xl font-mono font-bold text-amber-700">14:32</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500 mb-2">Progress</p>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full w-3/10 rounded-full bg-blue-500" style={{ width: '30%' }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">3 / 10 answered</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs font-medium text-emerald-700">Auto-graded on submit</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Everything you need to run great exams</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">From creation to grading, ExamFlow handles the entire exam lifecycle.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-slate-300 hover:shadow-md transition-all">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${f.color} mb-4`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">How it works</h2>
            <p className="text-lg text-slate-600">Four simple steps from setup to results.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-slate-200 z-0" style={{ width: 'calc(100% - 2rem)', left: 'calc(50% + 1.5rem)' }} />
                )}
                <div className="relative z-10 bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="text-3xl font-bold text-slate-200 mb-3">{step.number}</div>
                  <div className="mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      step.role === 'Teacher' ? 'bg-blue-50 text-blue-600' :
                      step.role === 'Student' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>{step.role}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-blue-600 to-cyan-600">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to transform your exams?</h2>
          <p className="text-lg text-blue-100 mb-8">Join as a teacher or student and experience seamless online examinations.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="bg-white text-blue-700 hover:bg-blue-50 text-base h-12 px-8 font-semibold">
              <Link href="/auth?tab=signup&role=teacher">I&apos;m a Teacher</Link>
            </Button>
            <Button size="lg" asChild className="bg-blue-700 hover:bg-blue-800 text-white border border-blue-500 text-base h-12 px-8">
              <Link href="/auth?tab=signup&role=student">I&apos;m a Student</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900">ExamFlow</span>
          </div>
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} ExamFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
