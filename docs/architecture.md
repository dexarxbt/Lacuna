# Architecture

Lacuna is a static STRK20 workbench that separates deterministic protocol reasoning, runtime wallet evidence, user consent, and public receipt verification.

## System boundary

```text
Recipe selection
      │
      ▼
@lacuna/recipe-engine ─────► disclosures, requirements, diagnostics
      │
      ▼
React Studio ──────────────► atomic in-memory WalletSession
      │                                  │
      │                                  ├── injected wallet reference
      │                                  ├── read-only capability report
      │                                  └── explicitly proven execution methods
      │
      ├── Wallet Doctor ────────────────► wallet_request* + wallet_strk20Balances
      │
      ├── Execution Panel ──────────────► fresh probe + immutable transfer/withdraw snapshot
      │                                  │
      │                                  ├── wallet_strk20PrepareInvoke(simulate: true)
      │                                  └── consented wallet_strk20InvokeTransaction
      │
      └── Mainnet receipt client ───────► public Starknet RPC
                                               │
                                               ▼
@lacuna/evidence-model ◄──────── receipt value + exact STRK20 pool
      ▲
      └── apps/cli ───────────── append-only public evidence artifacts
```

The wallet owns private notes, viewing keys, proof generation, signing, fee presentation, and approval. The browser receives no proof secret from the bridge's redacted simulation result.

## Workspaces

| Workspace | Responsibility | Explicitly excluded |
|---|---|---|
| `apps/web` | Product site, recipe inspector, Wallet Doctor, transfer/withdraw review, browser receipt verification | Keys, raw notes, proof state, server storage |
| `apps/cli` | Manifest validation, Mainnet RPC checks, pending-hash verification, append-only artifact publication | Signing, proving, private-state discovery |
| `packages/recipe-engine` | Deterministic recipes, disclosures, state constraints, required capabilities | React, wallet objects, RPC |
| `packages/wallet-bridge` | Runtime probing, felt/action bounds, strict response parsing, redacted simulation, consented submission | Seed phrases, local signing, proof retention |
| `packages/evidence-model` | Canonical felt identity, shared receipt rules, evidence/index/manifest schemas | Wallet identity and private action inputs |

## State ownership

### Wallet session

`Studio` owns one atomic `WalletSession`:

```text
{ wallet, report, provenExecutionCapabilities }
```

The wallet and report IDs must match. The Doctor replaces the pair atomically after a probe. The recipe analyzer credits `wallet_strk20Balances` only when the report proves it. Prepare and submit are absent until their own explicit calls succeed.

### Execution snapshot

The execution panel accepts only `transfer` and `withdraw`. Before simulation it re-probes the wallet, then validates:

- active account and `SN_MAIN`;
- required API evidence and STRK20 registration;
- token membership in wallet-reported balances;
- positive raw amount not exceeding the reported balance;
- Starknet recipient/address and felt bounds.

The resulting single action, account, wallet ID, and fingerprint are frozen. Input, wallet, account, or network changes invalidate review. Submission accepts only this exact snapshot.

### Submission and verification

Submission requires three booleans—network, disclosures, and final fee review in the wallet—and a single-flight mutex. There is no automatic transaction retry. A valid returned hash advances the UI only to submitted.

The browser then performs bounded polling through the public RPC. The same `verifyReceiptValue` function used by the CLI requires:

- requested and returned transaction hashes to match canonically;
- `execution_status === SUCCEEDED`;
- `finality_status` accepted on L1 or L2;
- a non-negative block number;
- an event from the exact STRK20 Mainnet pool.

## Evidence publication

The CLI compares canonical felt identities across `strk20.json` and the committed index, then re-derives every indexed evidence record from its raw receipt. It rejects missing, unindexed, tampered, or mismatched receipt files before querying pending hashes. New raw receipts use exclusive immutable paths; prior receipt bytes are never touched. Once all pending receipts and the merged index validate, a same-directory rename publishes the new index. An interrupted pre-index write can leave a detectable unindexed receipt, but cannot replace prior indexed evidence.

## Invariants

1. Domain analysis is deterministic and framework-independent.
2. Wallet branding or API version alone never proves a method.
3. The read-only Doctor never calls prepare or submit.
4. Simulation always sends `simulate: true` and returns no proof material to UI state.
5. Submission requires the unchanged snapshot, matching runtime identity, three review gates, and wallet approval.
6. Transaction submission is single-flight and never automatically retried.
7. A returned hash is not labeled verified until public receipt rules pass.
8. Evidence identity is canonical Starknet felt identity, not raw string equality.
9. Raw receipts are immutable, re-derived against index entries, and the merged index is replaced with a same-directory rename.
10. The browser never requests a mnemonic, private key, viewing key, or raw note.

## Hosting and network model

Vercel serves static HTML, CSS, JavaScript, and SVG files. There is no application backend, database, account system, cloud compiler, or hosted prover. The Content Security Policy allows the app's configured Starknet RPC and denies framing, plugins, forms, camera, microphone, and geolocation.

The configured RPC is a trust dependency. Receipt evidence is independently re-queryable but is not a verified Starknet state proof.

## Dependency policy

Dependencies are exact-pinned and locked. Internal domain packages have no third-party runtime dependencies and use the built-in Node test runner. CI installs with package scripts disabled. A new protocol dependency is added only when a concrete requirement cannot be met safely with platform primitives.
