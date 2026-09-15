import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/providers/Providers';
import AppShell from '@/components/shell/AppShell';

export const metadata: Metadata = {
  title: 'Contractor Compliance · EZForm',
  description: 'Contractor records, requirement library, review queue and gate check-in for EZForm.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ground text-ink antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
