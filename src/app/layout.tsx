import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/providers/Providers';
import AppShell from '@/components/shell/AppShell';

export const metadata: Metadata = {
  title: 'Contractor Compliance · EZForm',
  description: 'Track contractors that work for you and clients you work for.',
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
