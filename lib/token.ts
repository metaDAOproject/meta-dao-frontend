import {
  Account,
  Mint,
  TOKEN_PROGRAM_ID,
  getAccount,
  getMint as splGetMint,
} from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';

import { Metadata, getMetadataForMint } from './metadata';

const getResultOrUndefined = <T>(result: PromiseSettledResult<T>) =>
  result.status === 'fulfilled' ? result.value : undefined;

export const getMint = async ({
  connection,
  mint,
  programId = TOKEN_PROGRAM_ID,
  includeMetadata = true,
}: {
  connection: Connection;
  mint: PublicKey;
  programId?: PublicKey;
  includeMetadata?: boolean;
}): Promise<{
  mint: Mint;
  metadata?: Metadata;
}> => {
  const pendingPromises: Array<Promise<any>> = [splGetMint(connection, mint, undefined, programId)];
  if (includeMetadata) {
    pendingPromises.push(getMetadataForMint(connection, mint));
  }

  const results = await Promise.allSettled(pendingPromises);

  return {
    mint: getResultOrUndefined(results[0]),
    metadata: includeMetadata ? getResultOrUndefined(results[1]) : undefined,
  };
};

export const getMintForAta = async ({
  connection,
  ata,
  programId = TOKEN_PROGRAM_ID,
  includeMetadata = true,
}: {
  connection: Connection;
  ata: PublicKey;
  programId?: PublicKey;
  includeMetadata?: boolean;
}): Promise<{
  mint: Mint;
  ata: Account;
  metadata?: Metadata;
}> => {
  const account = await getAccount(connection, ata, undefined, programId);

  const { mint, metadata } = await getMint({
    connection,
    mint: account.mint,
    programId,
    includeMetadata,
  });

  return {
    mint,
    ata: account,
    metadata,
  };
};
