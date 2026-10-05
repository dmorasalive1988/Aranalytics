import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Pluma Admin', template: '%s · Pluma Admin' }, robots: { index: false, follow: false } };

/** Back-office en tema claro (Papel) para lectura de tablas. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light">
      <body className="min-h-dvh bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
