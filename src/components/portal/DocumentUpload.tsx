'use client';

import { useRef, useState } from 'react';
import { Button, Input } from '@heroui/react';
import { ArrowPathRoundedSquareIcon, ArrowUpTrayIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Evidence, RequirementSnapshot, ReusableDocument, StoredFile } from '@/lib/types';
import { daysUntil, fmtDate, fromDateInput } from '@/lib/dates';
import { fmtBytes } from '@/lib/slot';
import { Callout } from '@/components/ui';

const MAX_BYTES = 8 * 1024 * 1024;
// Demo storage is localStorage, so only small files keep a preview.
const KEEP_BYTES = 1.5 * 1024 * 1024;

export default function DocumentUpload({
  req,
  today,
  busy,
  onSubmit,
  reusable,
  onReuse,
}: {
  req: RequirementSnapshot;
  today: string;
  busy: boolean;
  onSubmit: (ev: Evidence) => void;
  /** Copies another client already approved. The same certificate usually satisfies every client. */
  reusable?: ReusableDocument[];
  onReuse?: (assignmentId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<StoredFile | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [reference, setReference] = useState('');
  const [issued, setIssued] = useState('');
  const [expires, setExpires] = useState('');
  const [error, setError] = useState<string | null>(null);
  const needsExpiry = req.validity.kind === 'DOCUMENT_DATE';

  const pick = (f: File | null | undefined) => {
    setError(null);
    if (!f) return;
    if (!(f.type === 'application/pdf' || f.type.startsWith('image/'))) {
      setError('Upload a PDF or an image, such as a JPG or PNG.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`That file is ${fmtBytes(f.size)}. Upload one under 8 MB.`);
      return;
    }
    if (f.size > KEEP_BYTES) {
      setFile({ name: f.name, size: f.size, type: f.type, data_url: null });
      return;
    }
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

  const clearFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const expiryDays = expires ? daysUntil(fromDateInput(expires), today) : null;
  const expiryError = needsExpiry && expiryDays !== null && expiryDays <= 0 ? 'That date has passed. Upload a current document.' : null;
  const issuedError = issued && expires && issued > expires ? 'The issue date is after the expiry date.' : null;
  const ready = !!file && !reading && (!needsExpiry || (!!expires && !expiryError)) && !issuedError;

  const submit = () => {
    if (!file) return setError('Attach the document first.');
    if (needsExpiry && !expires) return setError('Enter the expiry date shown on the document.');
    if (expiryError || issuedError) return;
    onSubmit({
      kind: 'DOCUMENT',
      file,
      reference: reference.trim(),
      issued_at: issued ? fromDateInput(issued) : null,
      expires_at: expires ? fromDateInput(expires) : null,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {req.document_hint && <Callout title="What to upload">{req.document_hint}</Callout>}

      {!!reusable?.length && onReuse && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-3">
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
            <ArrowPathRoundedSquareIcon className="h-5 w-5 text-primary" />
            Already approved by another client
          </p>
          <p className="mb-2 mt-0.5 text-[12.5px] text-ink-2">
            Send the same copy instead of uploading again.{req.needs_review ? ' This client still reviews it against its own rules.' : ' It counts as soon as you send it.'}
          </p>
          <ul className="space-y-1.5">
            {reusable.slice(0, 4).map((d) => (
              <li key={d.assignment_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
                <DocumentIcon className="h-5 w-5 shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{d.evidence.file.name}</p>
                  <p className="truncate text-[12px] text-ink-3">
                    {d.same_title ? '' : `${d.title} · `}Approved by {d.client_name} {fmtDate(d.approved_at)}
                    {d.evidence.expires_at ? ` · expires ${fmtDate(d.evidence.expires_at)}` : ''}
                  </p>
                </div>
                <Button size="sm" color="primary" variant={d.same_title ? 'solid' : 'flat'} isLoading={busy} onPress={() => onReuse(d.assignment_id)}>
                  Use this copy
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-white p-3">
          {file.data_url && file.type.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.data_url} alt="" className="h-14 w-14 rounded border border-line object-cover" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded bg-gray-100 text-ink-3">
              <DocumentIcon className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{file.name}</p>
            <p className="text-[12px] text-ink-3">
              {fmtBytes(file.size)}
              {!file.data_url && ' · too large to keep a preview in demo storage, but the submission still counts'}
            </p>
          </div>
          <Button size="sm" variant="light" onPress={clearFile} startContent={<XMarkIcon className="h-4 w-4" />}>
            Remove
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragOver ? 'border-primary bg-primary-50' : 'border-line bg-[#FAFAFD]'
          }`}
        >
          <ArrowUpTrayIcon className="h-8 w-8 text-ink-3" />
          <p className="font-medium text-ink">Drag the file here</p>
          <p className="text-[12.5px] text-ink-3">PDF or image, up to 8 MB</p>
          <Button size="sm" color="primary" variant="flat" isLoading={reading} onPress={() => inputRef.current?.click()}>
            Choose a file
          </Button>
          <input
            ref={inputRef}
            id="document-file"
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          id="document-reference"
          label="Policy or certificate number"
          labelPlacement="outside"
          placeholder="Optional"
          variant="bordered"
          value={reference}
          onValueChange={setReference}
        />
        <Input
          id="document-issued"
          type="date"
          label="Issued on"
          labelPlacement="outside"
          placeholder=" "
          variant="bordered"
          value={issued}
          onValueChange={setIssued}
          isInvalid={!!issuedError}
          errorMessage={issuedError ?? undefined}
        />
        {needsExpiry && (
          <Input
            id="document-expires"
            type="date"
            label="Expires on"
            labelPlacement="outside"
            placeholder=" "
            variant="bordered"
            isRequired
            description="As printed on the document"
            value={expires}
            onValueChange={setExpires}
            isInvalid={!!expiryError}
            errorMessage={expiryError ?? undefined}
          />
        )}
      </div>

      {error && <Callout tone="bad">{error}</Callout>}

      <div className="flex justify-end border-t border-line pt-4">
        <Button color="primary" isLoading={busy} isDisabled={!ready} onPress={submit}>
          {req.needs_review ? 'Submit for review' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
