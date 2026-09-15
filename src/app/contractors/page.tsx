'use client';

import { useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { BuildingOffice2Icon, PlusIcon } from '@heroicons/react/24/outline';
import AddContractorModal from '@/components/AddContractorModal';
import LinkTable from '@/components/LinkTable';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { useContractors } from '@/services/queries';

export default function ContractorsPage() {
  const { data } = useContractors();
  const [adding, setAdding] = useState(false);
  const add = (
    <Button color="primary" startContent={<PlusIcon className="h-4 w-4" />} onPress={() => setAdding(true)}>
      Add contractor
    </Button>
  );

  return (
    <>
      <PageHeader title="Contractors" description="Companies that work for you. They upload what you ask for, and you approve it." actions={add} />
      <Card bodyClass="p-0">
        {!data ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : data.length ? (
          <LinkTable rows={data} hrefBase="/contractors" side="contractors" />
        ) : (
          <EmptyState icon={BuildingOffice2Icon} title="No contractors yet" body="Add the companies that work at your sites. They'll get a login and see your list." action={add} />
        )}
      </Card>
      <AddContractorModal isOpen={adding} onClose={() => setAdding(false)} />
    </>
  );
}
