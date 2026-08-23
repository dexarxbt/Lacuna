<div align="center">
  <img src="apps/web/public/brand/lacuna-mark.svg" width="72" alt="Lacuna mark" />
  <h1>Lacuna</h1>
  <p><strong>Build private flows. Know what leaks.</strong></p>
  <p>A visibility-first development studio for STRK20 integrations on Starknet.</p>
</div>

## Why Lacuna

Private execution has public edges. Developers must reason about wallet capabilities, recipient registration, proof generation, note maturity, transaction constraints, and submission evidence before a flow is safe to ship.

Lacuna brings that lifecycle into one focused workspace:

- compose protocol-aware privacy recipes;
- inspect protected, public, and derived information;
- validate STRK20 constraints before signing;
- generate typed wallet integration code;
- track proving, inclusion, and note maturity;
- export independently verifiable mainnet evidence.

## Current status

Lacuna is under active development for the STRK20 Private Sprint. The repository currently contains the product foundation and original visual system. Wallet execution and verified mainnet receipts will be published only after they work against the live pool; no mainnet behavior is being claimed yet.

## Architecture

```text
Browser studio ── Wallet API ── Supported Starknet wallet
      │                              │
      ├─ recipe engine              ├─ keys and notes
      ├─ visibility model           ├─ proof generation
      ├─ code output                └─ transaction signing
      └─ evidence view                       │
                                             ▼
                               STRK20 pool on Starknet Mainnet
```

Lacuna is designed as a static client. It does not require an application database, authentication service, cloud compiler, or server-held secrets. A local CLI will handle environment checks, generated-code validation, receipt verification, and evidence export.

## Repository map

```text
apps/web          Public site and privacy studio
packages          Shared protocol, recipe, and evidence logic
verification      Public mainnet receipts and capability snapshots
strk20.json       Official hackathon submission manifest
```

## Run locally

Requirements:

- Node.js 22 or newer
- npm 10 or newer

```bash
npm install
npm run dev
```

Validate the production build:

```bash
npm run verify
```

## Security boundary

Lacuna plans and explains transactions. The connected wallet remains responsible for secret material, proof generation, and signing.

- Never enter a seed phrase or private key into Lacuna.
- Never commit wallet secrets to this repository.
- Confirm the network, pool, disclosure summary, and fee before signing.
- Treat deposits, withdrawals, timing, and other documented public edges as observable.

See `SECURITY.md` for reporting guidance and the complete trust boundary once protocol integration lands.

## Mainnet evidence

The root `strk20.json` is intentionally empty until successful transactions have been independently verified. Before submission it will contain at least three successful Starknet Mainnet transactions that touched the official STRK20 pool.

## License

Lacuna is available under the [MIT License](LICENSE).
