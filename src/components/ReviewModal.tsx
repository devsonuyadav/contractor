'use client';

import { useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@heroui/react';
import type { Item } from '@/lib/types';
import { fmtDate } from '@/lib/dates';
import { Api, useAction } from '@/services/queries';
import { FileButton } from './Checklist';
import { Callout } from './ui';

/** The client approves an upload or sends it back with a reason. */
export default function ReviewModal({ item, contractorName, onClose }: { item: Item | null; contractorName: string; onClose: () => void }) {
  return (
    <Modal isOpen={!!item} onOpenChange={(open) => !open && onClose()} size="lg">
      <ModalContent>{item?.pending && <ReviewForm key={item.pending.id} item={item} contractorName={contractorName} onClose={onClose} />}</ModalContent>
    </Modal>
  );
}

function ReviewForm({ item, contractorName, onClose }: { item: Item; contractorName: string; onClose: () => void }) {
  const u = item.pending!;
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState('');
  const review = useAction(Api.review, (res) => (res.status === 'APPROVED' ? 'Approved' : `Sent back to ${contractorName}`));
  const decide = (decision: 'APPROVED' | 'REJECTED') => review.mutate({ id: u.id, decision, note }, { onSuccess: onClose });

  return (
    <>
      <ModalHeader className="flex flex-col gap-0.5">
        <span>{item.requirement.title}</span>
        <span className="text-[12.5px] font-normal text-ink-3">
          {contractorName}
          {item.person ? ` · ${item.person.name}` : ''}
        </span>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        {u.file.data_url && u.file.type.startsWith('image/') && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.file.data_url} alt={`Uploaded ${item.requirement.title}`} className="max-h-72 w-full rounded-lg border border-line object-contain" />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-2">
            Uploaded by {u.uploaded_by} on {fmtDate(u.uploaded_at)}
            {u.expires_at ? ` · expires ${fmtDate(u.expires_at)}` : ''}
          </span>
          <FileButton upload={u} />
        </div>
        {item.requirement.hint && <Callout title="What you asked for">{item.requirement.hint}</Callout>}
        {item.ok && <p className="text-[12.5px] text-ink-3">This is a new copy. The one you approved before still counts until {fmtDate(item.approved?.expires_at)}.</p>}
        {sendingBack && (
          <Textarea
            id="review-note"
            label="What needs to change?"
            labelPlacement="outside"
            placeholder={`${contractorName} will see this`}
            variant="bordered"
            isRequired
            autoFocus
            value={note}
            onValueChange={setNote}
          />
        )}
      </ModalBody>
      <ModalFooter>
        {sendingBack ? (
          <>
            <Button variant="light" onPress={() => setSendingBack(false)}>
              Back
            </Button>
            <Button color="danger" isDisabled={!note.trim()} isLoading={review.isPending} onPress={() => decide('REJECTED')}>
              Send back
            </Button>
          </>
        ) : (
          <>
            <Button variant="flat" color="danger" onPress={() => setSendingBack(true)}>
              Send back
            </Button>
            <Button color="success" className="text-white" isLoading={review.isPending} onPress={() => decide('APPROVED')}>
              Approve
            </Button>
          </>
        )}
      </ModalFooter>
    </>
  );
}
