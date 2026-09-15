'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@heroui/react';
import { useSessionContext } from '@/services/queries';
import { useSession } from '@/session/SessionProvider';

/** Lands a company on the side it uses: its own program first, otherwise its clients. */
export default function Home() {
  const { ready } = useSession();
  const { data: ctx } = useSessionContext(ready);
  const router = useRouter();
  useEffect(() => {
    if (ctx) router.replace(ctx.program.enabled ? '/dashboard' : '/portal');
  }, [ctx, router]);
  return (
    <div className="grid place-items-center py-24">
      <Spinner />
    </div>
  );
}
