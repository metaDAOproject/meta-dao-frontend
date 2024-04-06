import { useCallback, useEffect, useState } from 'react';
import { ComputeBudgetProgram, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { BN, utils } from '@coral-xyz/anchor';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAutocrat } from '@/contexts/AutocratContext';
import { useConditionalVault } from './useConditionalVault';
import { InitializedVault, ProposalInstruction } from '../lib/types';
import { createOpenbookMarket } from '../lib/openbook';
import { useOpenbook } from './useOpenbook';
import { useOpenbookTwap } from './useOpenbookTwap';
import { useTransactionSender } from './useTransactionSender';

export function useInitializeProposal() {
  const { connection } = useConnection();
  const sender = useTransactionSender();
  const {
    autocratProgram: program,
    daoKey,
    daoTreasuryKey,
    daoState,
    daoTokens,
    fetchProposals,
  } = useAutocrat();
  const { initializeVault } = useConditionalVault();
  const wallet = useWallet();
  const openbook = useOpenbook().program;
  const { program: openbookTwap } = useOpenbookTwap();
  const baseNonce: BN = new BN(daoState?.proposalCount || 0);
  const [vaults, setVaults] = useState<{ base: InitializedVault; quote: InitializedVault }>();
  const [markets, setMarkets] = useState<{ pass: Keypair; fail: Keypair }>();
  const [twaps, setTwaps] = useState<{ pass: PublicKey; fail: PublicKey }>();

  const baseToken = daoTokens?.baseToken;
  const quoteToken = daoTokens?.quoteToken;

  useEffect(() => {
    const f = async () => {
      if (!daoTreasuryKey || !baseToken || !quoteToken) return;

      const baseVault = await initializeVault(daoTreasuryKey, baseToken.publicKey, baseNonce);
      const quoteVault = await initializeVault(
        daoTreasuryKey,
        quoteToken.publicKey,
        baseNonce.or(new BN(1).shln(63)),
      );

      if (!baseVault.tx && !quoteVault.tx) {
        setVaults({ base: baseVault, quote: quoteVault });
      }
    };

    f();
  }, [daoTreasuryKey]);

  const initializeVaults = useCallback(async () => {
    if (!baseToken || !quoteToken || !daoTreasuryKey) {
      return;
    }

    /// Init conditional vaults
    const baseVault = await initializeVault(daoTreasuryKey, baseToken.publicKey, baseNonce);

    const quoteVault = await initializeVault(
      daoTreasuryKey,
      quoteToken.publicKey,
      baseNonce.or(new BN(1).shln(63)),
    );

    const vaultTx = new Transaction();
    if (baseVault.tx) vaultTx.add(baseVault.tx);
    if (quoteVault.tx) vaultTx.add(quoteVault.tx);

    await sender.send([vaultTx]);
    setVaults({ base: baseVault, quote: quoteVault });
    fetchProposals();
  }, [daoTreasuryKey, daoTokens]);

  const initializeMarkets = useCallback(async () => {
    if (
      !wallet?.publicKey ||
      !wallet.signAllTransactions ||
      !baseToken ||
      !quoteToken ||
      !daoTreasuryKey ||
      !program ||
      !openbookTwap ||
      !vaults
    ) {
      return;
    }

    /// Init markets
    const openbookPassMarketKP = Keypair.generate();
    const openbookFailMarketKP = Keypair.generate();
    const [openbookTwapPassMarket] = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode('twap_market'), openbookPassMarketKP.publicKey.toBuffer()],
      openbookTwap.programId,
    );
    const [openbookTwapFailMarket] = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode('twap_market'), openbookFailMarketKP.publicKey.toBuffer()],
      openbookTwap.programId,
    );

    const openbookPassMarket = await createOpenbookMarket(
      openbook,
      wallet.publicKey,
      vaults.base.finalizeMint,
      vaults.quote.finalizeMint,
      `p${daoTokens.baseToken}/p${daoTokens.quoteToken}`,
      new BN(100),
      new BN(1e9),
      new BN(0),
      new BN(0),
      new BN(0),
      null,
      null,
      openbookTwapPassMarket,
      null,
      openbookTwapPassMarket,
      { confFilter: 0.1, maxStalenessSlots: 100 },
      openbookPassMarketKP,
      daoTreasuryKey,
    );

    const openbookFailMarket = await createOpenbookMarket(
      openbook,
      wallet.publicKey,
      vaults.base.revertMint,
      vaults.quote.revertMint,
      `f${daoTokens.baseToken}/f${daoTokens.quoteToken}`,
      new BN(100),
      new BN(1e9),
      new BN(0),
      new BN(0),
      new BN(0),
      null,
      null,
      openbookTwapFailMarket,
      null,
      openbookTwapFailMarket,
      { confFilter: 0.1, maxStalenessSlots: 100 },
      openbookFailMarketKP,
      daoTreasuryKey,
    );

    const passMarketTx = new Transaction().add(...openbookPassMarket.instructions);
    const failMarketTx = new Transaction().add(...openbookFailMarket.instructions);

    const blockhask = await connection.getLatestBlockhash();
    passMarketTx.feePayer = wallet.publicKey!;
    passMarketTx.recentBlockhash = blockhask.blockhash;
    failMarketTx.feePayer = wallet.publicKey!;
    failMarketTx.recentBlockhash = blockhask.blockhash;

    passMarketTx.sign(...openbookPassMarket.signers);
    failMarketTx.sign(...openbookFailMarket.signers);

    const txs = [passMarketTx, failMarketTx].filter(Boolean) as Transaction[];
    const signedTxs = await wallet.signAllTransactions(txs);
    // Using loops here to make sure transaction are executed in the correct order
    // eslint-disable-next-line no-restricted-syntax
    for (const tx of signedTxs) {
      // eslint-disable-next-line no-await-in-loop
      await connection.confirmTransaction(
        // eslint-disable-next-line no-await-in-loop
        await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true }),
        'processed',
      );
    }
    setMarkets({ pass: openbookPassMarketKP, fail: openbookFailMarketKP });
    fetchProposals();
  }, [daoKey, program, connection, wallet, daoTokens, vaults]);

  const initializeTwaps = useCallback(async () => {
    if (
      !wallet?.publicKey ||
      !wallet.signAllTransactions ||
      !baseToken ||
      !quoteToken ||
      !daoTreasuryKey ||
      !program ||
      !openbookTwap ||
      !daoState ||
      !vaults ||
      !markets
    ) {
      return;
    }

    /// Init markets
    const [openbookTwapPassMarket] = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode('twap_market'), markets.pass.publicKey.toBuffer()],
      openbookTwap.programId,
    );
    const [openbookTwapFailMarket] = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode('twap_market'), markets.fail.publicKey.toBuffer()],
      openbookTwap.programId,
    );

    const createPassTwapMarketIx = await openbookTwap.methods
      .createTwapMarket(daoState?.twapExpectedValue)
      .accounts({
        market: markets.pass.publicKey,
        twapMarket: openbookTwapPassMarket,
        payer: wallet.publicKey,
      })
      .instruction();
    const createFailTwapMarketIx = await openbookTwap.methods
      .createTwapMarket(daoState.twapExpectedValue)
      .accounts({
        market: markets.fail.publicKey,
        twapMarket: openbookTwapFailMarket,
        payer: wallet.publicKey,
      })
      .instruction();

    const twapsTx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
      createPassTwapMarketIx,
      createFailTwapMarketIx,
    );

    const blockhask = await connection.getLatestBlockhash();
    twapsTx.feePayer = wallet.publicKey!;
    twapsTx.recentBlockhash = blockhask.blockhash;

    const txs = [twapsTx].filter(Boolean) as Transaction[];
    const signedTxs = await wallet.signAllTransactions(txs);
    // Using loops here to make sure transaction are executed in the correct order
    // eslint-disable-next-line no-restricted-syntax
    for (const tx of signedTxs) {
      // eslint-disable-next-line no-await-in-loop
      await connection.confirmTransaction(
        // eslint-disable-next-line no-await-in-loop
        await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true }),
        'processed',
      );
    }
    setTwaps({ pass: openbookTwapPassMarket, fail: openbookTwapFailMarket });
    fetchProposals();
  }, [daoKey, program, connection, wallet, daoTokens]);

  const initializeProposal = useCallback(
    async (url: string, instruction: ProposalInstruction) => {
      if (
        !wallet?.publicKey ||
        !wallet.signAllTransactions ||
        !baseToken ||
        !quoteToken ||
        !daoTreasuryKey ||
        !program ||
        !openbookTwap ||
        !vaults ||
        !markets
      ) {
        return;
      }

      const [openbookTwapPassMarket] = PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode('twap_market'), markets.pass.publicKey.toBuffer()],
        openbookTwap.programId,
      );
      const [openbookTwapFailMarket] = PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode('twap_market'), markets.fail.publicKey.toBuffer()],
        openbookTwap.programId,
      );

      const proposalKeypair = Keypair.generate();
      const initProposalTx = new Transaction().add(
        await program.account.proposal.createInstruction(proposalKeypair, 1500),
        await program.methods
          .initializeProposal(url, instruction)
          .accounts({
            proposal: proposalKeypair.publicKey,
            dao: daoKey,
            daoTreasury: daoTreasuryKey,
            baseVault: vaults.base.vault,
            quoteVault: vaults.quote.vault,
            openbookTwapPassMarket,
            openbookTwapFailMarket,
            openbookPassMarket: markets.pass.publicKey,
            openbookFailMarket: markets.fail.publicKey,
            proposer: wallet.publicKey,
          })
          .instruction(),
      );

      const blockhask = await connection.getLatestBlockhash();
      initProposalTx.feePayer = wallet.publicKey!;
      initProposalTx.recentBlockhash = blockhask.blockhash;
      initProposalTx.sign(proposalKeypair);

      const txs = [initProposalTx];
      const signedTxs = await wallet.signAllTransactions(txs);
      // Using loops here to make sure transaction are executed in the correct order
      // eslint-disable-next-line no-restricted-syntax
      for (const tx of signedTxs) {
        // eslint-disable-next-line no-await-in-loop
        await connection.confirmTransaction(
          // eslint-disable-next-line no-await-in-loop
          await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true }),
          'confirmed',
        );
      }
      fetchProposals();
    },
    [daoKey, program, connection, wallet, daoTokens],
  );

  return {
    vaults,
    markets,
    twaps,
    initializeVaults,
    initializeMarkets,
    initializeTwaps,
    initializeProposal,
  };
}
