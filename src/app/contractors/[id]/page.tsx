'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import Checklist from '@/components/Checklist';
import ReviewModal from '@/components/ReviewModal';
import { Callout, Card, CompliantChip, EmptyState, PageHeader, ProgressLine } from '@/components/ui';
import type { Item } from '@/lib/types';
import { useContractor } from '@/services/queries';

export default function ContractorPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isError } = useContractor(id);
  const [reviewing, setReviewing] = useState<Item | null>(null);

  if (isError) return <Callout tone="bad">That contractor doesn't work for you.</Callout>;
  if (!data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }
  const c = data.row.company;

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/contractors', label: 'Contractors' }]}
        title={c.name}
        description={[c.trade, c.contact_name, c.email].filter(Boolean).join(' · ')}
        actions={
          <div className="flex items-center gap-3">
            <ProgressLine progress={data.row.progress} className="w-44" />
            <CompliantChip compliant={data.row.compliant} progress={data.row.progress} />
          </div>
        }
      />
      {data.row.to_review > 0 && (
        <div className="mb-5">
          <Callout title={`${data.row.to_review} waiting for your review`}>Open each one, then approve it or send it back with a note.</Callout>
        </div>
      )}
      {!data.row.progress.total && (
        <Card>
          <EmptyState
            title="You haven't said what you need yet"
            body={`Add requirements like insurance or site orientation. Every contractor, including ${c.name}, gets the same list.`}
            action={
              <Button as={Link} href="/requirements" color="primary" size="sm">
                Go to What I ask for
              </Button>
            }
          />
        </Card>
      )}
      <Checklist
        detail={data}
        peopleNote={`${c.name}'s own team. In your account they are external users.`}
        action={(i) =>
          i.pending?.status === 'WAITING' ? (
            <Button size="sm" color="primary" onPress={() => setReviewing(i)}>
              Review
            </Button>
          ) : null
        }
      />
      <ReviewModal item={reviewing} contractorName={c.name} onClose={() => setReviewing(null)} />
    </>
  );
}
