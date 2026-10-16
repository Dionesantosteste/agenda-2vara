import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SCRIPT_APARENCIA } from '@/lib/aparencia';
import { Avisos } from '@/componentes/Avisos';
import './legado.css';
import './novo.css';

export const metadata: Metadata = {
  title: 'Portal da 2ª Vara',
  icons: { icon: '/brasao/icone.svg' }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function Raiz({ children }: { children: ReactNode }){
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* tema e fundo antes de desenhar a página (sem piscar) */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_APARENCIA }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>
        <Avisos>{children}</Avisos>
      </body>
    </html>
  );
}
