import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Navbar from '@/components/Navbar';
import DashboardLayout from '@/components/DashboardLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CHEM WITH DULA',
  description: 'Timed MCQ exams with instant grading.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
          <DashboardLayout role="teacher">
            <main>{children}</main>
          </DashboardLayout>
    </div>
      
  );
}
