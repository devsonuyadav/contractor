'use client';

import { useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { BriefcaseIcon, PlusIcon } from '@heroicons/react/24/outline';
import AddClientModal from '@/components/AddClientModal';
import LinkTable from '@/components/LinkTable';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { useClients } from '@/services/queries';

export default function ClientsPage() {
  const { data } = useClients();
  const [adding, setAdding] = useState(false);
  const add = (
    <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setAdding(true)}>
      Add a client
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Clients"
        description="Companies you work for. Upload what each one asks for and keep it current, so you're ready before they check."
        actions={add}
      />
      <Card bodyClass="p-0">
        {!data ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : data.length ? (
          <LinkTable rows={data} hrefBase="/clients" side="clients" />
        ) : (
          <EmptyState
            icon={BriefcaseIcon}
            title="No clients yet"
            body="When a company on EZForm adds you as their contractor, it appears here. For a client that isn't on EZForm, add it yourself."
            action={add}
          />
        )}
      </Card>
      <AddClientModal isOpen={adding} onClose={() => setAdding(false)} />
    </>
  );
}
