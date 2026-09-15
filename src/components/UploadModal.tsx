'use client';

import { useRef, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { ArrowUpTrayIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Item, StoredFile } from '@/lib/types';
import { daysUntil, fromDateInput } from '@/lib/dates';
import { fmtBytes } from '@/lib/describe';
import { Api, useAction } from '@/services/queries';
import { Callout } from './ui';

const MAX_BYTES = 8 * 1024 * 1024;
// Demo storage is localStorage, so only small files keep a preview.
const KEEP_BYTES = 1.5 * 1024 * 1024;

/** The contractor uploads proof for one checklist item. */
export default function UploadModal({ item, today, reviewed, clientName, onClose }: { item: Item | null; today: string; reviewed: boolean; clientName: string; onClose: () => void }) {
  return (
    <Modal isOpen={!!item} onOpenChange={(open) => !open && onClose()} size="lg">
      <ModalContent>{item && <UploadForm key={item.key} item={item} today={today} reviewed={reviewed} clientName={clientName} onClose={onClose} />}</ModalContent>
    </Modal>
  );
}

function UploadForm({ item, today, reviewed, clientName, onClose }: { item: Item; today: string; reviewed: boolean; clientName: string; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<StoredFile | null>(null);
  const [expires, setExpires] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const r = item.requirement;
  const save = useAction(Api.upload, (res) => (res.status === 'WAITING' ? `Sent to ${clientName} for review` : 'Uploaded'));

  const pick = (f: File | null | undefined) => {
    setError(null);
    if (!f) return;
    if (!(f.type === 'application/pdf' || f.type.startsWith('image/'))) return setError('Upload a PDF or an image, such as a JPG or PNG.');
    if (f.size > MAX_BYTES) return setError(`That file is ${fmtBytes(f.size)}. Upload one under 8 MB.`);
    if (f.size > KEEP_BYTES) return setFile({ name: f.name, size: f.size, type: f.type, data_url: null });
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setFile({ name: f.name, size: f.size, type: f.type, data_url: String(reader.result) });
      setReading(false);
    };
    reader.onerror = () => {
      setError("We couldn't read that file. Try another copy.");
      setReading(false);
    };
    reader.readAsDataURL(f);
  };

  const expiryError = expires && daysUntil(fromDateInput(expires), today) <= 0 ? 'That date has passed. Upload a current copy.' : null;
  const ready = !!file && !reading && (!r.has_expiry || (!!expires && !expiryError));

  const submit = () => {
    if (!file) return setError('Attach the file first.');
    if (r.has_expiry && !expires) return setError('Enter the expiry date shown on the document.');
    save.mutate(
      { link_id: item.link_id, requirement_id: r.id, person_id: item.person?.id ?? null, file, expires_at: r.has_expiry ? fromDateInput(expires) : null },
      { onSuccess: onClose },
    );
  };

  return (
    <>
      <ModalHeader className="flex flex-col gap-0.5">
        <span>{r.title}</span>
        <span className="text-[12.5px] font-normal text-ink-3">
          {item.person ? `For ${item.person.name}` : 'For the company'} · {clientName}
        </span>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        {r.hint && <Callout title="What to upload">{r.hint}</Callout>}
        {item.pending?.status === 'REJECTED' && item.pending.note && (
          <Callout tone="bad" title="Why the last copy was sent back">
            {item.pending.note}
          </Callout>
        )}

        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-line p-3">
            <span className="grid h-12 w-12 place-items-center rounded bg-gray-100 text-ink-3">
              <DocumentIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{file.name}</p>
              <p className="text-[12px] text-ink-3">{fmtBytes(file.size)}</p>
            </div>
            <Button size="sm" variant="light" startContent={<XMarkIcon className="h-4 w-4" />} onPress={() => setFile(null)}>
              Remove
            </Button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files?.[0]);
            }}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-[#FAFAFD] px-6 py-8 text-center"
          >
            <ArrowUpTrayIcon className="h-7 w-7 text-ink-3" />
            <p className="font-medium text-ink">Drag the file here</p>
            <p className="text-[12.5px] text-ink-3">PDF or image, up to 8 MB</p>
            <Button size="sm" color="primary" variant="flat" isLoading={reading} onPress={() => inputRef.current?.click()}>
              Choose a file
            </Button>
            <input ref={inputRef} id="upload-file" type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        )}

        {r.has_expiry && (
          <Input
            id="upload-expires"
            type="date"
            label="Expires on"
            labelPlacement="outside"
            placeholder=" "
            variant="bordered"
            isRequired
            description="As printed on the document. We'll show it as expiring 30 days before."
            value={expires}
            onValueChange={setExpires}
            isInvalid={!!expiryError}
            errorMessage={expiryError ?? undefined}
          />
        )}

        {error && <Callout tone="bad">{error}</Callout>}
        {!reviewed && <p className="text-[12.5px] text-ink-3">{clientName} isn't on EZForm, so this counts as done as soon as you upload it.</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          Cancel
        </Button>
        <Button color="primary" isLoading={save.isPending} isDisabled={!ready} onPress={submit}>
          {reviewed ? 'Send for review' : 'Upload'}
        </Button>
      </ModalFooter>
    </>
  );
}
