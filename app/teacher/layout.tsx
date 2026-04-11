import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ExamFlow',
  description: 'Timed MCQ exams with instant grading.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
            <Navbar />
            <main>{children}</main>
    </div>
      
  );
}
