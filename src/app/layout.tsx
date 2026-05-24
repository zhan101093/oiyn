import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ОЙЫН — Отбасылық викторина',
  description: 'Kahoot стиліндегі отбасылық викторина ойыны',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="kk">
      <body>{children}</body>
    </html>
  );
}
