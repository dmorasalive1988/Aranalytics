'use client';

import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from './cn';

/** Interruptor 52 × 32: activo Ámbar, inactivo #3A3D57, perilla Papel. */
export function Switch({ id, checked, onCheckedChange, disabled, name, label, form, value }: { id: string; checked: boolean; onCheckedChange?: (v: boolean) => void; disabled?: boolean; name?: string; label: string; form?: string; value?: string }) {
  return (
    <RadixSwitch.Root
      id={id}
      name={name}
      form={form}
      value={value}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn('relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-2xl p-[3px] transition-colors disabled:cursor-not-allowed disabled:opacity-50', checked ? 'bg-ambar' : 'bg-[#3A3D57]')}
    >
      <RadixSwitch.Thumb className={cn('block h-[26px] w-[26px] rounded-full bg-papel transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
    </RadixSwitch.Root>
  );
}
