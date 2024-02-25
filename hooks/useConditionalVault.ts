import { useCallback, useMemo } from 'react';
import { Program, utils, BN } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import numeral from 'numeral';
import { ConditionalVault, IDL as CONDITIONAL_VAULT_IDL } from '@themetadao/futarchy-ts/lib/idl/conditional_vault';
import { useProvider } from './useProvider';
import { useTokens } from './useTokens';
import { InitializedVault, ProposalAccount, VaultAccount, VaultAccountWithKey } from '@themetadao/futarchy-ts/lib/types';

export function useConditionalVault() {
  const provider = useProvider();
  const programId = new PublicKey('vaU1tVLj8RFk7mNj1BxqgAsMKKaL8UvEUHvU3tdbZPe');
  const program = useMemo(
    () => new Program<ConditionalVault>(CONDITIONAL_VAULT_IDL, programId, provider),
    [provider, programId],
  );

  const { tokens } = useTokens();

  const getVaultMint = useCallback(
    async (vault: PublicKey) => {
      const storedVault = await program.account.conditionalVault.fetch(vault);
      return storedVault;
    },
    [program, tokens],
  );

  const initializeVault = useCallback(
    async (
      settlementAuthority: PublicKey,
      underlyingTokenMint: PublicKey,
      nonce: BN,
    ): Promise<InitializedVault> => {
      const [vault] = PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode('conditional_vault'),
          settlementAuthority.toBuffer(),
          underlyingTokenMint.toBuffer(),
          nonce.toArrayLike(Buffer, 'le', 8),
        ],
        program.programId,
      );

      try {
        const fetchedVault = await program.account.conditionalVault.fetch(vault);
        return {
          signers: [],
          vault,
          finalizeMint: fetchedVault.conditionalOnFinalizeTokenMint,
          revertMint: fetchedVault.conditionalOnRevertTokenMint,
        };
      } catch (err) {
        const vaultUnderlyingTokenAccount = getAssociatedTokenAddressSync(
          underlyingTokenMint,
          vault,
          true,
        );
        const conditionalOnFinalizeTokenMint = Keypair.generate();
        const conditionalOnRevertTokenMint = Keypair.generate();

        return {
          tx: await program.methods
            .initializeConditionalVault(settlementAuthority, nonce)
            .accounts({
              vault,
              underlyingTokenMint,
              vaultUnderlyingTokenAccount,
              conditionalOnFinalizeTokenMint: conditionalOnFinalizeTokenMint.publicKey,
              conditionalOnRevertTokenMint: conditionalOnRevertTokenMint.publicKey,
              payer: provider.publicKey,
            })
            .transaction(),
          signers: [conditionalOnFinalizeTokenMint, conditionalOnRevertTokenMint],
          vault,
          finalizeMint: conditionalOnFinalizeTokenMint.publicKey,
          revertMint: conditionalOnRevertTokenMint.publicKey,
        };
      }
    },
    [program],
  );

  const createConditionalTokensAccounts = useCallback(
    async (proposal: ProposalAccount, vault: VaultAccount, fromBaseVault?: boolean) => ({
      ixs: [
        createAssociatedTokenAccountIdempotentInstruction(
          provider.publicKey,
          getAssociatedTokenAddressSync(vault.conditionalOnFinalizeTokenMint, provider.publicKey),
          provider.publicKey,
          vault.conditionalOnFinalizeTokenMint,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          provider.publicKey,
          getAssociatedTokenAddressSync(vault.conditionalOnRevertTokenMint, provider.publicKey),
          provider.publicKey,
          vault.conditionalOnRevertTokenMint,
        ),
        await program.methods
          .mintConditionalTokens(new BN(0))
          .accounts({
            vault: fromBaseVault ? proposal.baseVault : proposal.quoteVault,
            userConditionalOnFinalizeTokenAccount: getAssociatedTokenAddressSync(
              vault.conditionalOnFinalizeTokenMint,
              provider.publicKey,
            ),
            userConditionalOnRevertTokenAccount: getAssociatedTokenAddressSync(
              vault.conditionalOnRevertTokenMint,
              provider.publicKey,
            ),
            userUnderlyingTokenAccount: getAssociatedTokenAddressSync(
              vault.underlyingTokenMint,
              provider.publicKey,
            ),
            vaultUnderlyingTokenAccount: vault.underlyingTokenAccount,
            conditionalOnFinalizeTokenMint: vault.conditionalOnFinalizeTokenMint,
            conditionalOnRevertTokenMint: vault.conditionalOnRevertTokenMint,
          })
          .instruction(),
      ],
    }),
    [program],
  );

  const mintConditionalTokens = useCallback(
    async (
      amount: number,
      proposal: ProposalAccount,
      vault: VaultAccount,
      fromBaseVault?: boolean,
    ) => {
      if (!tokens || !provider || !provider.publicKey) {
        return;
      }
      const token = Object.values(tokens).find(
        (e) => e.publicKey.toString() === vault.underlyingTokenMint.toString(),
      );

      return {
        ixs: [
          createAssociatedTokenAccountIdempotentInstruction(
            provider.publicKey,
            getAssociatedTokenAddressSync(vault.conditionalOnFinalizeTokenMint, provider.publicKey),
            provider.publicKey,
            vault.conditionalOnFinalizeTokenMint,
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            provider.publicKey,
            getAssociatedTokenAddressSync(vault.conditionalOnRevertTokenMint, provider.publicKey),
            provider.publicKey,
            vault.conditionalOnRevertTokenMint,
          ),
          await program.methods
            .mintConditionalTokens(
              new BN(
                numeral(amount)
                  .multiply(10 ** (token?.decimals || 0))
                  .format('0'),
              ),
            )
            .accounts({
              vault: fromBaseVault ? proposal.baseVault : proposal.quoteVault,
              userConditionalOnFinalizeTokenAccount: getAssociatedTokenAddressSync(
                vault.conditionalOnFinalizeTokenMint,
                provider.publicKey,
              ),
              userConditionalOnRevertTokenAccount: getAssociatedTokenAddressSync(
                vault.conditionalOnRevertTokenMint,
                provider.publicKey,
              ),
              userUnderlyingTokenAccount: getAssociatedTokenAddressSync(
                vault.underlyingTokenMint,
                provider.publicKey,
              ),
              vaultUnderlyingTokenAccount: vault.underlyingTokenAccount,
              conditionalOnFinalizeTokenMint: vault.conditionalOnFinalizeTokenMint,
              conditionalOnRevertTokenMint: vault.conditionalOnRevertTokenMint,
            })
            .instruction(),
        ],
      };
    },
    [program, tokens],
  );

  const redeemTokensTransactions = useCallback(
    async (vault: VaultAccountWithKey) => {
      if (!program || !program.provider.publicKey) return;

      const userConditionalOnFinalizeTokenAccount = getAssociatedTokenAddressSync(
        vault.account.conditionalOnFinalizeTokenMint,
        program.provider.publicKey,
      );
      const userConditionalOnRevertTokenAccount = getAssociatedTokenAddressSync(
        vault.account.conditionalOnRevertTokenMint,
        program.provider.publicKey,
      );
      const userUnderlyingTokenAccount = getAssociatedTokenAddressSync(
        vault.account.underlyingTokenMint,
        program.provider.publicKey,
      );
      return [
        await program.methods
          .redeemConditionalTokensForUnderlyingTokens()
          .accounts({
            vault: vault.publicKey,
            conditionalOnFinalizeTokenMint: vault.account.conditionalOnFinalizeTokenMint,
            conditionalOnRevertTokenMint: vault.account.conditionalOnRevertTokenMint,
            vaultUnderlyingTokenAccount: vault.account.underlyingTokenAccount,
            userConditionalOnFinalizeTokenAccount,
            userConditionalOnRevertTokenAccount,
            userUnderlyingTokenAccount,
          })
          .preInstructions([
            createAssociatedTokenAccountIdempotentInstruction(
              program.provider.publicKey,
              userConditionalOnFinalizeTokenAccount,
              program.provider.publicKey,
              vault.account.conditionalOnFinalizeTokenMint,
            ),
            createAssociatedTokenAccountIdempotentInstruction(
              program.provider.publicKey,
              userConditionalOnRevertTokenAccount,
              program.provider.publicKey,
              vault.account.conditionalOnRevertTokenMint,
            ),
            createAssociatedTokenAccountIdempotentInstruction(
              program.provider.publicKey,
              userUnderlyingTokenAccount,
              program.provider.publicKey,
              vault.account.underlyingTokenMint,
            ),
          ])
          .transaction(),
      ];
    },
    [program],
  );

  return {
    program,
    initializeVault,
    mintConditionalTokens,
    createConditionalTokensAccounts,
    redeemTokensTransactions,
    getVaultMint,
  };
}
