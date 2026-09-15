'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@heroui/react';
import { daysUntil, fromDateInput, plusDays, toDateInput } from '@/lib/dates';
import { Api, useAction } from '@/services/queries';

export default function ExceptionRequestModal({
  isOpen,
  onClose,
  assignmentId,
  title,
  tenant,
  today,
}: {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  title: string;
  tenant: string;
  today: string;
}) {
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setUntil(toDateInput(plusDays(today, 30)));
  }, [isOpen, today]);

  const days = until ? daysUntil(fromDateInput(until), today) : null;
  const untilError = days === null ? null : days <= 0 ? 'Pick a date after today.' : days > 366 ? 'An exception can last a year at most.' : null;

  const request = useAction(
    () => Api.requestException({ id: assignmentId, reason: reason.trim(), until: fromDateInput(until) }),
    `Exception requested. ${tenant} will decide and email you.`,
  );

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="lg">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5">
              <span>Ask for an exception</span>
              <span className="text-[13px] font-normal text-ink-3">{title}</span>
            </ModalHeader>
            <ModalBody className="gap-4">
              <p className="text-[13px] text-ink-2">
                Explain why you can&apos;t meet this requirement yet and what you&apos;re doing about it. If {tenant} agrees, it counts as covered until the date you pick.
              </p>
              <Textarea
                id="exception-reason"
                label="Reason"
                labelPlacement="outside"
                placeholder="e.g. The recertification exam is booked for 2 October. Until then he'll only work under supervision."
                variant="bordered"
                minRows={3}
                isRequired
                value={reason}
                onValueChange={setReason}
              />
              <Input
                id="exception-until"
                type="date"
                label="Cover this until"
                labelPlacement="outside"
                placeholder=" "
                variant="bordered"
                isRequired
                className="max-w-xs"
                min={toDateInput(plusDays(today, 1))}
                max={toDateInput(plusDays(today, 366))}
                value={until}
                onValueChange={setUntil}
                isInvalid={!!untilError}
                errorMessage={untilError ?? undefined}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="warning"
                isLoading={request.isPending}
                isDisabled={!reason.trim() || !until || !!untilError}
                onPress={() => request.mutate(undefined, { onSuccess: onClose })}
              >
                Send request
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
