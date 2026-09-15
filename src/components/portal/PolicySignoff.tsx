'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Input } from '@heroui/react';
import type { Evidence, RequirementSnapshot } from '@/lib/types';
import { Callout } from '@/components/ui';
import SignaturePad from './SignaturePad';

export default function PolicySignoff({
  req,
  defaultName,
  busy,
  onSubmit,
}: {
  req: RequirementSnapshot;
  defaultName: string;
  busy: boolean;
  onSubmit: (ev: Evidence) => void;
}) {
  const policy = req.policy;
  const boxRef = useRef<HTMLDivElement>(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const [ack, setAck] = useState(false);
  const [name, setName] = useState(defaultName);
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setReadToEnd(true);
  }, [policy?.body]);

  if (!policy) return <Callout tone="warn">This policy has no text yet. Ask the client to add it.</Callout>;

  const onScroll = () => {
    const el = boxRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReadToEnd(true);
  };

  const ready = readToEnd && ack && name.trim().length > 1 && !!signature;

  return (
    <div className="flex flex-col gap-5">
      <div
        ref={boxRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Policy text"
        className="prose-policy max-h-80 overflow-y-auto rounded-xl border border-line bg-[#FAFAFD] p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {policy.body}
      </div>
      {!readToEnd && <p className="text-[12.5px] text-ink-3">Scroll to the end of the policy to continue.</p>}
      <Checkbox id="signoff-ack" isSelected={ack} onValueChange={setAck} isDisabled={!readToEnd}>
        <span className="text-[13.5px]">{policy.confirm_text}</span>
      </Checkbox>
      <Input
        id="signoff-name"
        label="Your full name"
        labelPlacement="outside"
        placeholder=" "
        variant="bordered"
        isRequired
        value={name}
        onValueChange={setName}
        className="max-w-sm"
      />
      <SignaturePad id="signoff-signature" onChange={setSignature} />
      <div className="flex justify-end">
        <Button
          color="primary"
          isDisabled={!ready}
          isLoading={busy}
          onPress={() => signature && onSubmit({ kind: 'SIGNOFF', signed_name: name.trim(), signature, acknowledged: true })}
        >
          Sign and submit
        </Button>
      </div>
    </div>
  );
}
