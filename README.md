<div align="center">
  <img src="apps/web/public/brand/lacuna-mark.svg" width="72" alt="Lacuna interrupted-aperture mark" />
  <h1>Lacuna</h1>
  <p><strong>Build private flows. Know what leaks.</strong></p>
  <p>A Mainnet STRK20 Wallet API workbench for inspecting privacy boundaries, proving wallet capabilities, safely reviewing user-initiated actions, and publishing receipt evidence.</p>
  <p>
    <a href="https://lacuna-strk.vercel.app/">Live app</a> ·
    <a href="https://lacuna-strk.vercel.app/studio">Studio</a> ·
    <a href="https://lacuna-strk.vercel.app/#transactions">Transactions</a> ·
    <a href="docs/architecture.md">Architecture</a> ·
    <a href="docs/mainnet-verification.md">Verification</a> ·
    <a href="SECURITY.md">Security</a>
  </p>
</div>

## Judge quick path

1. Open the [live landing page](https://lacuna-strk.vercel.app/) and review the implementation-status ledger.
2. Scroll to [Transactions](https://lacuna-strk.vercel.app/#transactions). Every row comes from the committed evidence index and links to Voyager plus its raw receipt.
3. Open the [Studio](https://lacuna-strk.vercel.app/studio), select a recipe, and inspect its boundary and runtime checks.
4. Click **Check wallet**. The read-only doctor reports the account, network, required and wallet-reported API versions, registration, token entries, and evidence state for each STRK20 method.
5. With a compatible registered Mainnet account, use **User-initiated Mainnet execution** to prepare a private transfer or withdrawal. The Studio re-probes the wallet, freezes the exact action, requests `simulate: true`, and exposes three review gates.
6. Do not approve a live transaction unless you intend to spend Mainnet funds. A returned hash is shown as **submitted, not verified** until the independent public receipt check passes.

The source, product, and evidence are public. The demo video is intentionally pending the author's final recording; `strk20.json` does not contain a placeholder `demo_video` URL.

## Product status

| Capability | Current behavior | 
|---|---|
| Recipe and disclosure engine | Deterministic, implemented, and tested |
| Protocol checks | Registration, maturity, balance, capability, and invoke constraints |
| Boundary inspector | Private, public, wallet-held, and correlatable fields per recipe stage |
| Wallet Doctor | User-initiated read probe; does not prepare, sign, or submit |
| Runtime capability evidence | Credits a method only after its corresponding call proves it |
| Private transfer simulation | Implemented with fresh wallet/account/network/balance validation |
| Withdrawal simulation | Implemented with the same validation and frozen-review boundary |
| Mainnet submission | Exact simulated action only; three acknowledgements plus wallet approval |
| Arbitrary private invoke | Not exposed: no trusted helper allowlist or deterministic encoder is configured |
| Receipt verification | Shared browser/CLI rules for success, finality, block, hash, and exact pool event |
| Evidence publication | Append-only; raw receipts are re-derived against index entries, prior bytes are preserved, and only pending hashes are queried |
| Production deployment | [lacuna-strk.vercel.app](https://lacuna-strk.vercel.app/) |

## Mainnet evidence

The root [`strk20.json`](strk20.json) and committed [`transaction-index.json`](verification/mainnet/transaction-index.json) currently agree on the following accepted Starknet Mainnet pool interactions. The list is not a ceiling: additional canonically unique transactions can be appended over time.

| Transaction | Block | Receipt checks | Public artifacts |
|---|---:|---|---|
| `0x02e991…1f720` | 13,786,473 | `SUCCEEDED` · `ACCEPTED_ON_L2` · pool event | [Voyager](https://voyager.online/tx/0x02e9918193a344303b170839bc1ab5737758e8306887cfb12c899ea2c481f720) · [raw receipt](verification/mainnet/receipts/0x02e9918193a344303b170839bc1ab5737758e8306887cfb12c899ea2c481f720.json) |
| `0x05f623…11a0cd` | 13,788,410 | `SUCCEEDED` · `ACCEPTED_ON_L2` · pool event | [Voyager](https://voyager.online/tx/0x05f6231da1b66f28964af7ac872ea85a3b1310516c90cc10cf2b9f57c011a0cd) · [raw receipt](verification/mainnet/receipts/0x05f6231da1b66f28964af7ac872ea85a3b1310516c90cc10cf2b9f57c011a0cd.json) |
| `0x036e91…8da3` | 13,788,382 | `SUCCEEDED` · `ACCEPTED_ON_L2` · pool event | [Voyager](https://voyager.online/tx/0x036e91f666a49e95c7b125a9d711eaf425c4bd1a1c8fcad98a503d83dbaf8da3) · [raw receipt](verification/mainnet/receipts/0x036e91f666a49e95c7b125a9d711eaf425c4bd1a1c8fcad98a503d83dbaf8da3.json) |

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
Re-probe wallet + account + SN_MAIN + API + balances
        ↓
Validate token from wallet response, raw amount, recipient, and balance
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
- action count, calldata length, addresses, amounts, and felt range are bounded before wallet access;
- malformed prepare and submit responses are rejected;
- proof fields are validated at the bridge boundary but are never returned to, retained by, or rendered in the UI;
- submission has a single-flight mutex and no automatic transaction retry;
- Lacuna never invents a fee estimate—the final fee must be reviewed in the wallet;
- receipt polling is bounded and cannot upgrade a failed or wrong-pool receipt to verified.

## Wallet capability semantics

The Wallet Doctor performs exactly these user-initiated calls:

```text
wallet_requestAccounts
wallet_requestChainId
wallet_supportedWalletApi
wallet_strk20Balances({ tokens: [], api_version: "0.10.3" })
```

A valid balance response—or structured error `118` (`NOT_REGISTERED`)—proves only `wallet_strk20Balances`. It does **not** prove prepare or submit support. `wallet_strk20PrepareInvoke` is credited only after a successful simulation; `wallet_strk20InvokeTransaction` is credited only after a consented call returns a valid Starknet transaction hash. Unsupported and inconclusive results remain separate.

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

No analytics SDK, application backend, database, hosted wallet, hosted prover, cloud compiler, external font host, or unnecessary protocol dependency is included.

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
- an injected Starknet wallet only for runtime wallet checks or deliberate Mainnet execution.

```bash
git clone https://github.com/dexarxbt/Lacuna.git
cd Lacuna
npm ci --ignore-scripts
npm run dev
```

Open the Vite URL printed by the terminal. Wallet discovery does not occur until **Check wallet** is clicked.

## Verification and CI

Run the same deterministic gate as CI:

```bash
npm run verify
```

This command:

1. type-checks every workspace;
2. runs all workspace tests;
3. checks exact manifest/evidence consistency;
4. builds the production web application.

Focused commands:

```bash
npm run typecheck
npm test
npm run check:manifest
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
- Lacuna has no seed-phrase, private-key, viewing-key, raw-note, or proof input.

This is unaudited sprint software. Use a dedicated wallet, fund only the intended amount plus fees, verify `SN_MAIN`, and reject any unexpected wallet prompt. Read [`SECURITY.md`](SECURITY.md) and [`docs/privacy-boundaries.md`](docs/privacy-boundaries.md) before live use.

## Limitations and submission status

- Arbitrary private invoke remains disabled because no trusted helper address, code-hash allowlist, ABI, or deterministic calldata encoder is configured.
- Recipient registration and note maturity remain wallet/protocol-enforced at simulation time.
- The UI has no trusted pre-approval fee estimate; the wallet is the final fee boundary.
- Public verification uses one configured RPC by default and does not verify a state proof.
- Operation labels in existing committed evidence remain `unclassified-pool-interaction`; Lacuna does not infer intent from receipts.
- No custom contract is listed because the core product uses the Wallet API route.
- The production demo URL and accepted Mainnet evidence are present in `strk20.json`.
- The demo video is pending the author's real upload, so `demo_video` is intentionally absent rather than fabricated.

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
