# Security policy

Lacuna is unaudited sprint software. Do not use it with funds you cannot afford to lose.

## Trust boundary

Lacuna may classify STRK20 disclosures, probe wallet capabilities, validate transfer/withdraw action descriptions, request a non-submittable simulation, request an explicitly approved submission, and verify public receipts. It must never ask the user for, persist, log, render, or transmit onward:

- a mnemonic or seed phrase;
- a Starknet private key;
- a private viewing key;
- raw private notes or note-decryption material;
- proof secrets;
- an exported wallet backup.

The injected wallet owns private-state discovery, proof generation, signing, fee presentation, and final approval. The static deployment has no application server, database, analytics SDK, or session replay.

## Current execution boundary

The web Studio exposes only validated private transfer and withdrawal actions. Arbitrary external invoke is not exposed because this repository has no trusted helper allowlist, code-hash verification, ABI, or deterministic calldata encoder.

Simulation:

1. re-requests the current account, chain, API information, and STRK20 balances;
2. requires `SN_MAIN`, a registered account, the required API evidence, and a token returned by the wallet;
3. validates the recipient, positive raw amount, wallet-reported balance, felt range, action count, and calldata bounds;
4. freezes the action snapshot;
5. calls `wallet_strk20PrepareInvoke` with `simulate: true`;
6. validates the wallet response and discards proof material before it reaches UI state.

Submission:

1. requires the exact unchanged simulated action and matching wallet/account/network;
2. requires separate network, disclosure, and final-fee-in-wallet acknowledgements;
3. makes one `wallet_strk20InvokeTransaction` request under a single-flight guard;
4. never automatically retries a transaction;
5. treats a returned hash as submitted, not verified;
6. performs a bounded independent public receipt check.

Lacuna does not provide a trusted fee estimate. Review and approve the final fee only in the wallet.

## Wallet Doctor disclosure

The Doctor is read-only with respect to transactions, not privacy-neutral. After explicit approval, the page receives wallet identity, account, network, API versions, token identifiers, and private balance values. Wallet Doctor summarizes the token-entry count, while the execution selector displays shortened token identifiers and exact wallet-reported private balances. Those local values are visible on screen and can appear in screenshots or recordings. The result remains in page memory and is sent to no Lacuna backend or analytics service. The injected wallet and its own infrastructure remain outside Lacuna's control.

The Doctor proves only `wallet_strk20Balances`. Prepare and submit are marked proven only after their explicit user-initiated calls succeed.

## Safe Mainnet use

1. Use an official supported wallet and a dedicated account.
2. Back up recovery material offline; never share it with Lacuna or its maintainer.
3. Fund only the intended action amount plus fees.
4. Confirm `SN_MAIN` and the pool address in `docs/mainnet-verification.md`.
5. Review the exact token, raw amount, recipient, disclosure boundary, and wallet fee.
6. Reject unexpected prompts or changed values.
7. After submission, independently verify the receipt through a provider you trust.

## Browser and deployment controls

- No analytics, session replay, external fonts, or third-party image hosts.
- CSP allows application connections only to the configured Starknet RPC.
- Framing, plugins, forms, camera, microphone, and geolocation are denied.
- Runtime dependencies are exact-pinned and locked.
- CI uses `npm ci --ignore-scripts` and read-only repository permissions.
- Wallet discovery occurs only after user interaction.

## Public evidence

Evidence may contain transaction hashes, pool events, fees, block numbers, relayer addresses, and timestamps. It must not contain wallet secrets, private recipe inputs, proof material, screenshots of recovery data, or claims not derivable from public receipts.

The default RPC is a trust dependency. Evidence is re-checkable through another provider but is not a cryptographic state proof or multi-provider attestation.

## Reporting a vulnerability

Do not publish an exploitable report as a GitHub issue. Contact `dexarxbt@gmail.com` with:

- the affected commit and component;
- reproduction steps using placeholder accounts and values;
- expected and observed behavior;
- likely impact;
- no mnemonic, private key, viewing key, or real private transaction data.

Reports are acknowledged on a best-effort basis during the sprint. There is no bug-bounty program.
