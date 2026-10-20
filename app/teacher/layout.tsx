import type { Metadata } from 'next';
import DashboardLayout from '@/components/DashboardLayout';

export const metadata: Metadata = {
  title: 'CHEM WITH DULA',
  description: 'Timed MCQ exams with instant grading.',
};

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout role="teacher">
      {children}
    </DashboardLayout>
  );
}
