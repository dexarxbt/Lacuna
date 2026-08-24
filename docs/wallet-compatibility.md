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

Error code `118` (`NOT_REGISTERED`) proves that the STRK20 method exists, but it does not by itself prove Wallet API `0.10.3` compatibility; the UI reports registration and version status independently. A valid successful balance response can infer compatibility with the requested `0.10.3` only when the separate version lookup advertises no versions. Explicit older-version metadata or error `162` remains blocking.

The doctor distinguishes three STRK20 outcomes:

- **Supported**: the balance method returns a valid array or reports `NOT_REGISTERED`.
- **Unsupported**: the provider explicitly reports that the method is missing or unsupported.
- **Check incomplete**: the provider rejects the probe for another reason, returns malformed data, or cannot report enough information.

Missing version metadata alone is reported as **not reported**, not **too old**. The completed report preserves the wallet's probe error and numeric code when available so a locked wallet, user refusal, implementation error, and missing method are not presented as the same result. Conflicting error envelopes remain inconclusive. No inconclusive response unlocks execution or claims compatibility.

## Safety behavior

- Discovery and probing never prepare, prove, sign, or submit a transaction.
- Lacuna does not read viewing keys or raw notes.
- The studio currently keeps execution locked even when all capability checks pass.
- A future execution screen must simulate first and require network, disclosure, and fee confirmation.

The official sprint guidance recommends Ready or Braavos for manual mainnet onboarding, but it also states that Wallet API support must be probed rather than assumed. The runtime report is authoritative for Lacuna.
