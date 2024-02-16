import React from 'react';
import { ColorSchemeScript } from '@mantine/core';
import { Providers } from '../components/Providers/Providers';
import '@solana/wallet-adapter-react-ui/styles.css';
import '@mantine/core/styles.css';
import ogImage from '@/public/ogImage.png';
import './globals.css';

export const metadata = {
  title: 'Futarchy - MetaDAO',
  description: 'Market governance, for the people',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
        <link rel="shortcut icon" href="/meta.png" />
        <script src="https://terminal.jup.ag/main-v2.js" data-preload />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
        <meta property="og:image" content={ogImage.src} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="2056" />
        <meta property="og:image:height" content="936" />
        <meta name="twitter:image" content={ogImage.src} />
        <meta name="twitter:image:type" content="image/png" />
        <meta name="twitter:image:width" content="2056" />
        <meta name="twitter:image:height" content="936" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
