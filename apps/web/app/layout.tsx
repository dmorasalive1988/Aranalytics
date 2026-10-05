import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { ServiceWorker } from '@/components/service-worker';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Pluma', template: '%s · Pluma' },
  description: 'Escribe. Firma. Cobra. Write it. Own it. Get paid. Escreva. Assine. Receba.',
  applicationName: 'Pluma',
  appleWebApp: { capable: true, title: 'Pluma', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { themeColor: '#0E1020', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
