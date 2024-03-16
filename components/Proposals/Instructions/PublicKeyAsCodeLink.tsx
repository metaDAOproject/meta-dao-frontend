import { Code } from '@mantine/core';
import { PublicKey } from '@solana/web3.js';

import { shortKey } from '@/lib/utils';
import { useExplorerConfiguration } from '@/hooks/useExplorerConfiguration';

export const PublicKeyAsCodeLink = ({ publicKey }: { publicKey: PublicKey }) => {
  const { generateExplorerLink } = useExplorerConfiguration();

  const publicKeyStr = publicKey.toBase58();
  return (
    <a
      href={generateExplorerLink(publicKeyStr, 'account')}
      target="blank"
      onClick={(e) => e.stopPropagation()}
    >
      <Code>{shortKey(publicKeyStr)}</Code>
    </a>
  );
};
