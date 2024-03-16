import {
  JsonMetadata,
  MetadataAccountData,
  deserializeMetadata,
  fetchJsonMetadata,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';
import { Connection, PublicKey } from '@solana/web3.js';

export type Metadata = MetadataAccountData & { json: JsonMetadata };

export const getMetadataForMint = async (
  connection: Connection,
  address: PublicKey,
): Promise<Metadata | undefined> => {
  const umi = createUmi(connection);
  const pda = findMetadataPda(umi, {
    mint: fromWeb3JsPublicKey(address),
  });

  const acct = await umi.rpc.getAccount(pda[0]);
  if (!acct.exists) return undefined;

  const metadata = deserializeMetadata(acct);
  const jsonMetadata = await fetchJsonMetadata(umi, metadata.uri);

  return {
    ...metadata,
    json: jsonMetadata,
  };
};
