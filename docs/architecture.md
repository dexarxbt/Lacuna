# Architecture

Lacuna is a static, visibility-first STRK20 development studio. It deliberately separates protocol reasoning, wallet custody, public verification, and presentation.

## System boundary

```text
Recipe input
    │
    ▼
Pure recipe engine ──────► disclosure and constraint report
    │                                  │
    ▼                                  ▼
Studio presentation             generated call shape
    │
    ├── transaction-read-only capability probe ──► injected Starknet wallet
    │                                      │
    └── reviewed STRK20 actions ───────────┤
                                           ├── private notes
                                           ├── proof generation
                                           └── signing and submission
                                                      │
                                                      ▼
                                              STRK20 mainnet pool
                                                      │
                                                      ▼
Public RPC ◄── receipt verifier ◄── transaction hashes
```

## Workspaces

| Workspace | Responsibility | Explicitly excluded |
|---|---|---|
| `apps/web` | Product site, recipe interaction, disclosure UI, capability doctor | Keys, proofs, server state |
| `apps/cli` | Manifest validation, chain checks, receipt verification, evidence export | Signing, private-state discovery |
| `packages/recipe-engine` | Deterministic recipe analysis and protocol constraints | React, wallets, RPC |
| `packages/wallet-bridge` | Typed Wallet API calls and execution consent gates | Seed phrases, local signing, proving |
| `packages/evidence-model` | Versioned public verification records and submission manifest rules | Private inputs and wallet identity |

## Invariants

1. The recipe engine is deterministic and framework-independent.
2. Wallet support is probed at runtime rather than inferred from wallet branding.
3. `wallet_strk20PrepareInvoke` is called with `simulate: true` for previews.
4. Submission requires explicit network, disclosure, and fee confirmation.
5. The browser never receives a viewing key, note inventory, proof secret, mnemonic, or private key.
6. Evidence is derived from public RPC receipts and the verified pool address.
7. A draft `strk20.json` may be incomplete; final verification requires three unique accepted mainnet pool transactions.

## Hosting model

The production bundle is static. Vercel or any static host serves HTML, CSS, JavaScript, and SVG assets. There is no application backend, database, account system, hosted compiler, or hosted prover. The deployment Content Security Policy denies frames, plugins, forms, and unlisted network destinations.

## Dependency policy

Dependencies are exact-pinned in workspace manifests and locked by `package-lock.json`. Domain packages use the Node test runner and no external runtime libraries. A protocol package is added only when a concrete Wallet API or chain requirement cannot be met safely with platform primitives.
