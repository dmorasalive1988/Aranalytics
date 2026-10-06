'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@pluma/ui';
import { BellRing } from 'lucide-react';
import { CatalogSwitch } from '@/components/catalog-switch';
import { setPreferenceAction, subscribePushAction, unsubscribePushAction } from './actions';

type Category = 'money' | 'splits' | 'membership' | 'works';
type Channel = 'email' | 'push' | 'whatsapp';

export function PreferenceSwitch(props: { id: string; category: Category; channel: Channel; label: string; hint?: string; checked: boolean; disabled: boolean }) {
  return <CatalogSwitch id={props.id} label={props.label} hint={props.hint} checked={props.checked} disabled={props.disabled} onToggle={(v) => setPreferenceAction(props.category, props.channel, v)} />;
}

/** Clave VAPID (base64url) → bytes para PushManager.subscribe. */
function keyBytes(b64url: string) {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

type State = 'loading' | 'unsupported' | 'denied' | 'off' | 'on';

/** Push en este dispositivo: registra el service worker, pide permiso y guarda la suscripción. */
export function PushDevice({ publicKey, devices, labels }: { publicKey: string | null; devices: string[]; labels: Record<'title' | 'body' | 'enable' | 'disable' | 'on' | 'unsupported' | 'denied' | 'unavailable', string> }) {
  const [state, setState] = useState<State>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    navigator.serviceWorker
      .getRegistration('/sw.js')
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub && devices.includes(sub.endpoint) ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, [devices]);

  const enable = () =>
    start(async () => {
      setError(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return setState(permission === 'denied' ? 'denied' : 'off');
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey!) }));
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const r = await subscribePushAction({ endpoint: json.endpoint, keys: json.keys });
        if (r.error) return setError(r.error);
        setState('on');
        router.refresh();
      } catch {
        setState('unsupported');
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState('off');
      router.refresh();
    });

  const note = !publicKey ? labels.unavailable : state === 'unsupported' ? labels.unsupported : state === 'denied' ? labels.denied : state === 'on' ? labels.on : labels.body;
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-bold">
        <BellRing size={18} strokeWidth={2} aria-hidden /> {labels.title}
      </h2>
      <p className="text-sm text-fg-2" aria-live="polite">{note}</p>
      {publicKey && state === 'off' && (
        <Button variant="secondary" block onClick={enable} disabled={pending} aria-busy={pending}>
          {labels.enable}
        </Button>
      )}
      {state === 'on' && (
        <Button variant="ghost" block onClick={disable} disabled={pending} aria-busy={pending}>
          {labels.disable}
        </Button>
      )}
      {error && <p role="alert" className="text-xs font-medium text-danger-fg">{error}</p>}
    </Card>
  );
}
