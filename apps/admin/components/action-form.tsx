'use client';

import { useActionState, useTransition, type ReactNode } from 'react';
import { Button, Notice, type ButtonVariant } from '@pluma/ui';
import { CircleAlert, CircleCheck } from 'lucide-react';

export interface ActionState {
  error?: string;
  ok?: string;
}

/**
 * Formulario con acción de servidor. Se envía con onSubmit (sin el reinicio automático de React),
 * para que la persona no pierda lo que escribió si hay un error.
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  children,
  className,
  submitVariant = 'primary',
  footer,
  hideSubmit,
  id,
  submitDisabled,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  submitLabel: ReactNode;
  pendingLabel?: ReactNode;
  children?: ReactNode;
  className?: string;
  submitVariant?: ButtonVariant;
  footer?: ReactNode;
  hideSubmit?: boolean;
  id?: string;
  submitDisabled?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  return (
    <form
      id={id}
      noValidate
      className={className ?? 'flex flex-col gap-5'}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name) fd.set(submitter.name, submitter.value);
        startTransition(() => formAction(fd));
      }}
    >
      {children}
      {state.error && <Notice tone="alert" icon={<CircleAlert size={20} strokeWidth={2} />} title={state.error} />}
      {state.ok && <Notice tone="ok" icon={<CircleCheck size={20} strokeWidth={2} />} title={state.ok} />}
      {!hideSubmit && (
        <Button type="submit" variant={submitVariant} block disabled={pending || submitDisabled} aria-busy={pending}>
          {pending ? (pendingLabel ?? '…') : submitLabel}
        </Button>
      )}
      {footer}
    </form>
  );
}
