<div align="center">
  <img src="apps/web/public/brand/lacuna-mark.svg" width="72" alt="Lacuna interrupted-aperture mark" />
  <h1>Lacuna</h1>
  <p><strong>Build private flows. Know what leaks.</strong></p>
  <p>A visibility-first development studio for STRK20 integrations on Starknet.</p>
  <p>
    <a href="docs/privacy-boundaries.md">Privacy model</a> ·
    <a href="docs/architecture.md">Architecture</a> ·
    <a href="docs/mainnet-verification.md">Mainnet verification</a> ·
    <a href="LICENSE">MIT</a>
  </p>
</div>

## The missing layer

Private execution has public edges. A developer must reason about wallet capabilities, recipient registration, note maturity, proof latency, transaction constraints, public disclosures, and submission evidence before a flow is safe to ship.

Lacuna brings that reasoning into one focused workspace:

- compose protocol-aware privacy recipes;
- inspect private, public, wallet-held, and correlatable information;
- validate STRK20 constraints before a wallet request;
- preview conceptual Wallet API flow pseudocode;
- probe wallet support instead of assuming compatibility;
- verify mainnet receipts against the exact STRK20 pool;
- export evidence without including private wallet state.

## What works today

| Capability | Status |
|---|---|
| Recipe and disclosure engine | Implemented and tested |
| Registration, maturity, balance, and invoke constraints | Implemented and tested |
| Interactive visibility inspector | Implemented |
| Runtime Wallet API capability doctor | Implemented; transaction-read-only |
| Simulated preparation adapter | Implemented; not exposed until action inputs are complete |
| Submission adapter | Consent-gated; intentionally locked in the studio |
| Mainnet receipt verifier and evidence export | Implemented and tested |
| Three verified mainnet pool transactions | Pending |
| Public production deployment | Live at [lacuna-strk.vercel.app](https://lacuna-strk.vercel.app/) |

Lacuna does not claim mainnet completion yet. The transaction list in root `strk20.json` and the public evidence index remain empty until real transactions pass public RPC receipt validation.

## Product flow

```text
Choose recipe
    ↓
Inspect every disclosure
    ↓
Validate protocol constraints
    ↓
Probe the connected wallet
    ↓
Simulate the exact action set
    ↓
Review network, disclosures, and fee
    ↓
Let the wallet prove, sign, and submit
    ↓
Verify the public receipt and export evidence
```

The current studio stops before simulation and signing. That is deliberate: transaction execution will not be enabled around placeholder token, recipient, amount, or fee data.

## Architecture

```text
Browser studio ───────────────► Pure recipe engine
      │                                  │
      │                                  └── disclosures and diagnostics
      │
      └── Starknet Wallet API ─► Supported wallet
                                        ├── viewing key and notes
                                        ├── proof generation
                                        └── transaction signing
                                                   │
                                                   ▼
                                        STRK20 mainnet pool
                                                   │
Public RPC ──► Lacuna CLI ──► verified receipt evidence
```

The web application is static: no database, user account, cloud compiler, server wallet, analytics SDK, or hosted prover. See [the architecture document](docs/architecture.md) for workspace boundaries and invariants.

## Repository map

```text
apps/
  web/                 Product site, studio, and capability doctor
  cli/                 Manifest and public receipt verifier
packages/
  recipe-engine/       STRK20 recipes, disclosures, and constraints
  wallet-bridge/       Wallet API probing, simulation, and consent gates
  evidence-model/      Versioned verification and submission records
docs/                  Architecture, privacy, compatibility, verification
verification/mainnet/  Public evidence generated from accepted receipts
strk20.json             Official sprint submission manifest
```

## Run locally

Requirements:

- Node.js 22.12.0 or newer; CI tests Node.js 22.12.0 and 24
- npm 10 or newer
- An injected Starknet wallet only when testing the capability doctor

```bash
npm install
npm run dev
```

The studio opens at the Vite URL printed by the command. Wallet discovery occurs only after **Check wallet** is clicked.

## Verification commands

Run the same deterministic gate as CI:

```bash
npm run verify
```

That command type-checks every workspace, runs all tests, validates the draft submission manifest against the committed evidence index, and builds the production app. Empty and partial drafts are allowed, but every listed hash must have matching schema-valid evidence whose required checks passed; stale evidence is rejected.

Validate only `strk20.json`:

```bash
npm run check:manifest
```

After at least three real transaction hashes have been added, verify them against Starknet Mainnet and write public artifacts:

```bash
npm run verify:mainnet -- --write
```

The verifier rejects the wrong network, failed or unaccepted receipts, and transactions with no event from the verified pool. Artifact writing occurs only when every result passes and replaces the receipt directory so obsolete receipts cannot remain. The configured RPC is a trust dependency: evidence is publicly re-checkable but is not a cryptographic state proof or multi-provider attestation. See [mainnet verification](docs/mainnet-verification.md).

## Privacy model

The strongest private operation is a mature note-to-note transfer: parties, token, amount, and spent notes remain private. Public or potentially correlatable information still exists elsewhere:

- registration publishes the account and public viewing key;
- shielding publishes the depositor, token, amount, and timing;
- private transactions still reveal pool activity and timing;
- private DeFi reveals helper calls, moved amounts, and timing;
- withdrawal publishes destination, token, amount, and timing;
- distinctive values or closely spaced actions may be correlated.

The capability doctor is transaction-read-only, not privacy-neutral. After explicit wallet approval, the page receives wallet identity, account, network, API versions, token identifiers, and shielded balances; it shows the account and asset count and retains the result only in page memory. The static app has no backend or analytics path for this state.

The complete claims and non-claims are documented in [privacy boundaries](docs/privacy-boundaries.md).

## Wallet boundary

Lacuna never requests or stores a seed phrase, private key, viewing key, raw note, or proof secret. The wallet owns private-state discovery, proving, signing, and submission.

Compatibility is tested at runtime with:

```text
wallet_requestAccounts
wallet_requestChainId
wallet_supportedWalletApi
wallet_strk20Balances
```

The required Wallet API version is `0.10.3`. An account that returns `NOT_REGISTERED` still demonstrates STRK20 support and receives specific registration guidance. See [wallet compatibility](docs/wallet-compatibility.md).

## Mainnet constants

```text
CHAIN_ID=SN_MAIN
RPC_URL=https://rpc.starknet.lava.build
POOL_ADDRESS=0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
```

The RPC is replaceable for CLI verification; the chain and pool checks are not.

## Security

- Never enter wallet recovery material into Lacuna, source files, environment variables, issues, screenshots, or chat.
- Use a dedicated wallet containing only the amount needed for the intended mainnet operations.
- Review the network, pool, public disclosures, amount, destination, and fee before signing.
- Treat this sprint build as unaudited software.

Read [SECURITY.md](SECURITY.md) before attempting a mainnet transaction.

## Evidence and submission

The hackathon hub reads root `strk20.json`. A scoreable submission requires a live demo, a three-minute video URL, and at least three successful mainnet transactions touching the STRK20 pool. Lacuna preserves richer verification results under `verification/mainnet` while keeping the official root manifest minimal.

No custom contract is listed because Lacuna does not need one for its core Wallet API route. Listing a contract would require submitted transactions to carry an event from that contract as well as touching the pool.

## References

- [STRK20 Private Sprint rules](https://github.com/starkience/strk20-hackathon/blob/main/CONTRIBUTING.md)
- [Official mainnet day-zero guidance](https://github.com/starkience/strk20-hackathon/blob/main/docs/MAINNET-DAY-0.md)
- [STRK20 Wallet API overview](https://strk20-by-example.org/starknet-wallet-api/overview)
- [Private DeFi Wallet API flow](https://strk20-by-example.org/starknet-wallet-api/private-defi)
- [Starknet Wallet API types](https://github.com/starknet-io/types-js)

Source material was rephrased to preserve licensing and attribution requirements.

## License

Lacuna is available under the [MIT License](LICENSE). Copyright © 2026 Dexar.
