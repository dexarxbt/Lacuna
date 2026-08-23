# Security policy

Lacuna is an unaudited sprint build. Do not use it with funds you cannot afford to lose.

## Trust boundary

Lacuna may construct STRK20 action descriptions, classify disclosures, query wallet capabilities, request a non-submittable simulation, and verify public receipts. It must never request, receive, store, log, or transmit:

- a mnemonic or seed phrase;
- a Starknet private key;
- a private viewing key;
- raw private notes or note decryption material;
- proof secrets;
- an exported wallet backup.

The supported wallet owns private-state discovery, proof generation, signing, and submission. The static deployment has no application server or database.

## Current execution status

The web studio exposes only a transaction-read-only capability doctor. With user approval, the probe receives wallet identity, account, network, API versions, and returned STRK20 token identifiers and shielded balances; it retains this result in page memory and sends it to no Lacuna backend or analytics service. Although the internal bridge models preparation and consent-gated submission, the interface keeps both disabled until real action inputs, simulation output, fee review, and failure recovery are complete.

## Safe mainnet use

1. Create a dedicated wallet through an official supported wallet interface.
2. Back up recovery material offline; never share it with Lacuna or its maintainer.
3. Fund only the amount required for the planned actions and fees.
4. Confirm `SN_MAIN` and the pool address shown in `docs/mainnet-verification.md`.
5. Review every public disclosure, token, amount, recipient, helper, and estimated fee.
6. Reject unexpected wallet prompts.
7. Re-check the public receipt through a provider you trust after settlement.

## Browser and deployment controls

- No analytics or session-replay SDK is installed.
- External fonts and image hosts are not used.
- Vercel headers deny framing, MIME sniffing, forms, plugins, and sensitive browser permissions.
- Runtime dependencies are exact-pinned and locked.
- CI installs from the lockfile with package scripts disabled.
- Wallet discovery is user-triggered and limited to injected Starknet providers.

## Public evidence

Evidence files may contain transaction hashes, pool events, fees, block numbers, relayer addresses, and timestamps. They must not contain wallet secrets, private recipe values, screenshots of recovery material, or claims that cannot be derived from public receipts.

## Reporting a vulnerability

Do not publish an exploitable report as a GitHub issue. Contact `dexarxbt@gmail.com` with:

- the affected commit and component;
- reproduction steps using placeholder accounts and values;
- expected and observed behavior;
- likely impact;
- no mnemonic, private key, viewing key, or real private transaction data.

Reports are acknowledged on a best-effort basis during the sprint. There is currently no bug-bounty program.
