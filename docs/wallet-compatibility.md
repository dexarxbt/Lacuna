# Wallet compatibility

Lacuna does not maintain a hard-coded list of “supported” wallet brands. STRK20 support lives in a wallet's runtime Wallet API implementation and can change independently of its name.

## Required interface

A wallet is ready for Lacuna execution when it:

1. exposes a Starknet injected provider;
2. grants an account through `wallet_requestAccounts`;
3. reports `SN_MAIN` through `wallet_requestChainId`;
4. supports Wallet API `0.10.3` or newer;
5. answers `wallet_strk20Balances`;
6. supports `wallet_strk20PrepareInvoke` and `wallet_strk20InvokeTransaction` for the intended flow;
7. has a registered STRK20 account and sufficient mature private balance.

## Capability doctor

The studio's capability doctor runs only after the user clicks **Check wallet** and chooses an injected wallet. The probe is transaction-read-only, not privacy-neutral: after wallet approval, the page receives the wallet identity, account, network, API versions, and returned STRK20 token identifiers and shielded balances. It displays the account and asset count, keeps the result in page memory only, and has no backend or analytics destination for that state. It performs:

```text
wallet_requestAccounts
wallet_requestChainId
wallet_supportedWalletApi
wallet_strk20Balances({ tokens: [], api_version: "0.10.3" })
```

Error code `118` (`NOT_REGISTERED`) still proves the STRK20 method exists; the UI reports registration as the next required action. Other failures are reported without attempting a transaction.

## Safety behavior

- Discovery and probing never prepare, prove, sign, or submit a transaction.
- Lacuna does not read viewing keys or raw notes.
- The studio currently keeps execution locked even when all capability checks pass.
- A future execution screen must simulate first and require network, disclosure, and fee confirmation.

The official sprint guidance recommends Ready or Braavos for manual mainnet onboarding, but it also states that Wallet API support must be probed rather than assumed. The runtime report is authoritative for Lacuna.
