<div align="center">
  <img src="apps/web/public/brand/lacuna-mark.svg" width="72" alt="Lacuna interrupted-aperture mark" />
  <h1>Lacuna</h1>
  <p><strong>Build private flows. Know what leaks.</strong></p>
  <p>A Mainnet STRK20 Wallet API workbench for inspecting privacy boundaries, proving wallet capabilities, safely reviewing user-initiated actions, and publishing re-checkable receipt evidence.</p>
  <p>
    <a href="https://lacuna-strk.vercel.app/">Live app</a> ·
    <a href="https://lacuna-strk.vercel.app/studio">Studio</a> ·
    <a href="https://lacuna-strk.vercel.app/#transactions">Transactions</a> ·
    <a href="docs/architecture.md">Architecture</a> ·
    <a href="docs/mainnet-verification.md">Verification</a> ·
    <a href="SECURITY.md">Security</a>
  </p>
  <p>
    <a href="https://github.com/dexarxbt/Lacuna/actions/workflows/verify.yml"><img src="https://github.com/dexarxbt/Lacuna/actions/workflows/verify.yml/badge.svg" alt="Repository verification status" /></a>
  </p>
</div>

## Why Lacuna

Private execution is not the same as invisible execution. Wallet support, registration, note maturity, public pool activity, withdrawals, fees, timing, and RPC traffic all create different evidence and disclosure boundaries. Lacuna makes those boundaries inspectable before a user approves a Mainnet action, while leaving private-state discovery, proof generation, signing, and final approval inside the wallet.

The product combines three concerns that are usually separated: deterministic privacy-boundary analysis, runtime Wallet API capability evidence, and public receipt verification. It does not claim that public receipts reveal private intent or guarantee unlinkability.

## Submission snapshot

| Item | Current state |
|---|---|
| Mainnet receipt evidence | **6** canonically unique accepted STRK20 pool interactions |
| Required evidence checks | **24/24 passing** across the six version-2 records |
| Submission minimum | **6/3** verified transaction hashes |
| Custom contracts | **0** — the product uses the Wallet API route |
| Hosted demo | [lacuna-strk.vercel.app](https://lacuna-strk.vercel.app/) |
| Demo video | Pending the final privacy-safe recording; no placeholder URL is published |
| Evidence operation labels | `unclassified-pool-interaction`; public receipts do not authenticate private intent |

## Judge quick path

1. Open the [live landing page](https://lacuna-strk.vercel.app/) and review the implementation-status ledger.
2. Scroll to [Transactions](https://lacuna-strk.vercel.app/#transactions). All six rows are parsed from the evidence index and link to Voyager plus committed raw receipts.
3. Open the [Studio](https://lacuna-strk.vercel.app/studio), select a recipe, and inspect its privacy boundary and runtime checks.
4. Click **Check wallet**. The read-only doctor reports the account, network, Wallet API evidence, registration state, and wallet-returned private token entries.
5. For a private transfer, independently confirm recipient registration or explicitly consent to the public Mainnet registration lookup. Lacuna never silently sends the recipient to its RPC.
6. With a compatible registered Mainnet account, prepare a private transfer or withdrawal. The Studio re-probes the wallet, freezes the exact action, requests `simulate: true`, and exposes three review gates.
7. Do not approve a live transaction unless you intend to spend Mainnet funds. A returned hash remains **submitted, not verified** until the independent receipt check passes.

The source, product, manifest, evidence index, and raw receipts are public. The demo video will be added only after the author's final recording is uploaded to a real HTTPS URL.

## Verification vocabulary

Lacuna keeps four evidence levels distinct:

| Level | Meaning |
|---|---|
| Implemented | Behavior exists in the source tree |
| Test-covered | Repository tests exercise the stated rule or boundary |
| Wallet-proven | The connected wallet successfully completed that exact user-initiated Wallet API call |
| Receipt-proven | A public Mainnet receipt passed the hash, execution, pool-event, and accepted-block checks |

A receipt-proven pool interaction does not prove which private action produced it. A successful balance call does not prove prepare or submit support. The UI and documentation preserve these distinctions.

## Product status

| Capability | Current behavior |
|---|---|
| Recipe and disclosure engine | Deterministic, implemented, and test-covered |
| Protocol checks | Registration, maturity, balance, capability, and invoke constraints |
| Boundary inspector | Private, public, wallet-held, and correlatable fields per recipe stage |
| Wallet Doctor | User-initiated read probe; does not prepare, sign, or submit |
| Runtime capability evidence | Credits a method only after its corresponding call proves it |
| Recipient readiness | Transfer-only confirmation or explicit opt-in Mainnet `get_public_key` lookup |
| Private transfer simulation | Fresh wallet/account/network/balance validation and immutable review |
| Withdrawal simulation | Same validation and frozen-review boundary; no private-recipient registration gate |
| Mainnet submission | Exact simulated action only; three acknowledgements plus wallet approval |
| Arbitrary private invoke | Not exposed: no trusted helper allowlist or deterministic encoder is configured |
| Receipt verification | Shared browser/CLI rules for success, finality, block, hash, and exact pool event |
| Evidence publication | CLI-enforced append-only workflow; prior receipts are re-derived and preserved |
| Hosted demo | [lacuna-strk.vercel.app](https://lacuna-strk.vercel.app/) |

## Mainnet evidence

The root [`strk20.json`](strk20.json) and [`transaction-index.json`](verification/mainnet/transaction-index.json) agree on six accepted Starknet Mainnet pool interactions. Each record has exactly four passing checks, for 24 passing checks in total. The list is appendable rather than a fixed ceiling.

| Transaction | Block | Receipt checks | Public artifacts |
|---|---:|---|---|
| `0x02e991…1f720` | 13,786,473 | `SUCCEEDED` · `ACCEPTED_ON_L2` · pool event | [Voyager](https://voyager.online/tx/0x02e9918193a344303b170839bc1ab5737758e8306887cfb12c899ea2c481f720) · [raw receipt](verification/mainnet/receipts/0x02e9918193a344303b170839bc1ab5737758e8306887cfb12c899ea2c481f720.json) |
| `0x05f623…11a0cd` | 13,788,410 | `SUCCEEDED` · `ACCEPTED_ON_L2` · pool event | [Voyager](https://voyager.online/tx/0x05f6231da1b66f28964af7ac872ea85a3b1310516c90cc10cf2b9f57c011a0cd) · [raw receipt](verification/mainnet/receipts/0x05f6231da1b66f28964af7ac872ea85a3b1310516c90cc10cf2b9f57c011a0cd.json) |
| `0x036e91…8da3` | 13,788,382 | `SUCCEEDED` · `ACCEPTED_ON_L2` · pool event | [Voyager](https://voyager.online/tx/0x036e91f666a49e95c7b125a9d711eaf425c4bd1a1c8fcad98a503d83dbaf8da3) · [raw receipt](verification/mainnet/receipts/0x036e91f666a49e95c7b125a9d711eaf425c4bd1a1c8fcad98a503d83dbaf8da3.json) |
| `0x6e6469…0b5ec` | 13,936,911 | `SUCCEEDED` · `ACCEPTED_ON_L2` · pool event | [Voyager](https://voyager.online/tx/0x6e64697a93ff7b71313e69ea76dae0696ca03b7b85d93d2d736bcba6190b5ec) · [raw receipt](verification/mainnet/receipts/0x6e64697a93ff7b71313e69ea76dae0696ca03b7b85d93d2d736bcba6190b5ec.json) |
| `0x031fdd…7b0f2` | 13,937,171 | `SUCCEEDED` · `ACCEPTED_ON_L2` · pool event | [Voyager](https://voyager.online/tx/0x031fdd9bea8f10dee78fd63ef152586c62efa7146c415927fbb5bc1bd207b0f2) · [raw receipt](verification/mainnet/receipts/0x031fdd9bea8f10dee78fd63ef152586c62efa7146c415927fbb5bc1bd207b0f2.json) |
| `0x04dd79…931c4` | 13,937,473 | `SUCCEEDED` · `ACCEPTED_ON_L2` · pool event | [Voyager](https://voyager.online/tx/0x04dd797282b7453d2780ed18935b82981c01f6602d4dd2b8e7aa7a0d1f8931c4) · [raw receipt](verification/mainnet/receipts/0x04dd797282b7453d2780ed18935b82981c01f6602d4dd2b8e7aa7a0d1f8931c4.json) |

These records prove successful accepted interactions with the exact pool. They do not reveal or authenticate whether an interaction was a shield, private transfer, withdrawal, registration, or another supported pool action.

Mainnet constants:

```text
CHAIN_ID=SN_MAIN
RPC_URL=https://rpc.starknet.lava.build
POOL_ADDRESS=0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
WALLET_API_REQUIRED=0.10.3
```

The RPC is a replaceable trust dependency, not a cryptographic state proof or multi-provider attestation. Raw receipts and hashes are committed so reviewers can independently re-query another provider.

## Safe execution design

```text
Select transfer or withdrawal
        ↓
For transfer: confirm recipient readiness or explicitly opt in to public registration lookup
        ↓
Re-probe wallet + account + SN_MAIN + API + balances
        ↓
Validate wallet-returned token, amount, recipient, and available private balance
        ↓
Freeze one immutable action snapshot
        ↓
wallet_strk20PrepareInvoke({ simulate: true })
        ↓
Discard proof material; retain only redacted call metadata
        ↓
Review exact action + disclosure boundary + final-fee limitation
        ↓
Confirm network + disclosures + wallet fee review
        ↓
Re-probe wallet + account + SN_MAIN + API + balances
        ↓
One wallet_strk20InvokeTransaction request; never auto-retry
        ↓
Treat returned hash as submitted, then independently poll public receipt
        ↓
Verify SUCCEEDED + accepted block + matching hash + exact pool event
```

Safety properties:

- inputs changing after simulation invalidate the review;
- wallet, account, or network changes invalidate the frozen snapshot;
- transfer registration checks are explicit and stale RPC results cannot validate a changed recipient;
- action count, calldata length, addresses, amounts, and felt range are bounded before wallet access;
- malformed prepare and submit responses are rejected;
- proof fields are validated at the bridge boundary but are never returned to, retained by, or rendered in the UI;
- submission has a single-flight mutex and no automatic transaction retry;
- Lacuna never invents a fee estimate—the final fee must be reviewed in the wallet;
- receipt polling is bounded and cannot upgrade a failed or wrong-pool receipt to verified.

## Wallet and token semantics

The Wallet Doctor performs these user-initiated calls:

```text
wallet_requestAccounts
wallet_requestChainId
wallet_supportedWalletApi
wallet_strk20Balances({ tokens: [], api_version: "0.10.3" })
```

A valid balance response—or structured error `118` (`NOT_REGISTERED`)—proves only `wallet_strk20Balances`. It does **not** prove prepare or submit support. `wallet_strk20PrepareInvoke` is credited only after a successful simulation; `wallet_strk20InvokeTransaction` is credited only after a consented call returns a valid Starknet transaction hash. Unsupported and inconclusive results remain separate.

The execution token selector accepts only tokens returned by the connected wallet's STRK20 private-balance response. It does not accept an arbitrary ERC-20 address, and a public token balance is not a private pool balance. STRK has verified 18-decimal metadata for normal-unit entry; other wallet-returned tokens use exact raw base units unless trusted metadata is added.

For private transfers, recipient registration is a separate prerequisite. The recipient can confirm registration without an RPC lookup, or the sender can explicitly consent to disclose that address to the configured public RPC for the pool's `get_public_key` check. Ready remains responsible for private sender-channel and token-subchannel setup.

## Technology stack

| Layer | Technology |
|---|---|
| UI | React `19.2.8`, React DOM `19.2.8`, semantic HTML, hand-authored responsive CSS |
| Language | TypeScript `7.0.2`, strict workspace configuration |
| Build | Vite `8.2.2` |
| Runtime/tooling | Node.js `>=22.12.0`, npm `>=10`, npm workspaces |
| Tests | Built-in `node:test` and `node:assert/strict`; no browser-test dependency |
| Wallet integration | Injected Starknet provider and STRK20 Wallet API `0.10.3` |
| Public verification | Starknet JSON-RPC, shared `@lacuna/evidence-model` receipt rules |
| Hosting | Static Vercel deployment with route-specific HTML and security headers |
| CI | GitHub Actions on Node.js `22.12.0` and `24`, locked install with scripts disabled |

The repository includes no analytics SDK, application backend, database, hosted wallet, hosted prover, cloud compiler, or external font host.

## Architecture

```text
React Studio ─────► @lacuna/recipe-engine
     │                       └── deterministic disclosures + diagnostics
     │
     ├────────────► @lacuna/wallet-bridge ─────► injected Starknet wallet
     │                       │                         ├── private state
     │                       │                         ├── proof generation
     │                       │                         └── signing/approval
     │                       └── strict validation + redacted responses
     │
     └────────────► browser Mainnet receipt client
                                 │
                                 ▼
@lacuna/evidence-model ◄── public Starknet RPC
          ▲
          └──────────── apps/cli append-only evidence writer
```

Workspace responsibilities:

```text
apps/web/                 Product site, Studio, Wallet Doctor, execution review, browser receipt check
apps/cli/                 Manifest checks, Mainnet RPC verification, append-only artifact writer
packages/recipe-engine/   Pure STRK20 recipes, disclosures, state constraints, capability diagnostics
packages/wallet-bridge/   Runtime probing, action bounds, redacted simulation, consented submission
packages/evidence-model/  Canonical felt identity, receipt rules, evidence/index/manifest schemas
verification/mainnet/     Public transaction index and immutable raw receipt artifacts
```

See [`docs/architecture.md`](docs/architecture.md) for state ownership and invariants.

## Run locally

Requirements:

- Node.js `22.12.0` or newer;
- npm `10` or newer;
- an injected Starknet wallet only for runtime checks or deliberate Mainnet execution.

```bash
git clone https://github.com/dexarxbt/Lacuna.git
cd Lacuna
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

Open the Vite URL printed by the terminal. Wallet discovery does not occur until **Check wallet** is clicked.

## Verification and CI

Run the same deterministic gate as CI:

```bash
npm run verify
```

This command type-checks every workspace, runs all workspace tests, checks exact manifest/evidence consistency, and builds the production application. CI executes it on Node.js `22.12.0` and `24` after a locked install with lifecycle scripts disabled.

Focused commands:

```bash
npm run typecheck
npm test
npm run check:manifest
npm run verify:mainnet
npm run build
```

To verify and append only manifest hashes that are not already committed:

```bash
npm run verify:mainnet -- --write
```

The writer re-derives every indexed record from its raw receipt, queries pending hashes only, fails before publication if any new receipt fails, rejects canonical duplicates and raw-receipt mismatches, preserves prior receipt bytes, and leaves the repository unchanged when every manifest hash is already committed. See [`docs/mainnet-verification.md`](docs/mainnet-verification.md).

## Privacy and security boundaries

Lacuna explains privacy boundaries; it does not enlarge the protocol anonymity set or guarantee unlinkability.

- Registration publishes account and public viewing-key material.
- Shielding publishes depositor, token, amount, and timing.
- Private transfer still exposes pool activity and timing.
- Withdrawal publishes destination, token, amount, and timing.
- Distinctive values, timing, browser metadata, wallet infrastructure, and RPC traffic can create correlation risk.
- The read-only doctor exposes approved account/network/API/token/balance data to the page in memory; it is read-only with respect to transactions, not privacy-neutral.
- An opted-in recipient lookup discloses that address to the configured public RPC.
- Lacuna has no seed-phrase, private-key, viewing-key, raw-note, or proof input.

This is unaudited sprint software. Use a dedicated wallet, fund only the intended amount plus fees, verify `SN_MAIN`, and reject any unexpected wallet prompt. Read [`SECURITY.md`](SECURITY.md) and [`docs/privacy-boundaries.md`](docs/privacy-boundaries.md) before live use.

## Limitations and submission status

- Arbitrary private invoke remains disabled because no trusted helper address, code-hash allowlist, ABI, or deterministic calldata encoder is configured.
- Recipient registration and note maturity remain wallet/protocol-enforced; registration preflight cannot prove private channel readiness.
- The UI has no trusted pre-approval fee estimate; the wallet is the final fee boundary.
- Public verification uses one configured RPC by default and does not verify a state proof.
- All six evidence operation labels remain `unclassified-pool-interaction`; Lacuna does not infer intent from receipts.
- No custom contract is listed because the core product uses the Wallet API route.
- `strk20.json` contains six transaction hashes, the hosted demo URL, and no fabricated metadata.
- `demo_video` is intentionally absent until the final recording is uploaded.

## Maintainer

Built and maintained by [Dexar](https://github.com/dexarxbt). Security reports should follow the private disclosure process in [`SECURITY.md`](SECURITY.md).

## Documentation

- [Architecture and invariants](docs/architecture.md)
- [Privacy boundaries and non-claims](docs/privacy-boundaries.md)
- [Wallet compatibility and method evidence](docs/wallet-compatibility.md)
- [Mainnet receipt verification and append-only publication](docs/mainnet-verification.md)
- [Security policy](SECURITY.md)

## References

- [STRK20 Private Sprint contribution rules](https://github.com/starkience/strk20-hackathon/blob/main/CONTRIBUTING.md)
- [Official Mainnet day-zero guidance](https://github.com/starkience/strk20-hackathon/blob/main/docs/MAINNET-DAY-0.md)
- [STRK20 Wallet API overview](https://strk20-by-example.org/starknet-wallet-api/overview)
- [Private DeFi Wallet API flow](https://strk20-by-example.org/starknet-wallet-api/private-defi)
- [Starknet Wallet API types](https://github.com/starknet-io/types-js)

Source material was rephrased to preserve licensing and attribution requirements.

## License

Lacuna is available under the [MIT License](LICENSE). Copyright © 2026 Dexar.
