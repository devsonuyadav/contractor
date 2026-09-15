'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeroUIProvider } from '@heroui/react';
import { ToastProvider } from '@heroui/toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '@/session/SessionProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: false, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={router.push}>
        <ToastProvider placement="top-center" toastOffset={72} />
        <SessionProvider>{children}</SessionProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
