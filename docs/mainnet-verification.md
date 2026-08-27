# Mainnet verification

Lacuna separates transaction submission from publicly re-checkable receipt evidence. Browser and CLI verification share one environment-neutral ruleset from `@lacuna/evidence-model`.

## Verified constants

```text
Chain ID: SN_MAIN
Default RPC: https://rpc.starknet.lava.build
STRK20 pool: 0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
```

The CLI RPC can be replaced with `LACUNA_RPC_URL`, and every CLI or browser RPC request has a finite deadline. Both clients reject a provider that does not identify as Starknet Mainnet. The provider remains a trust dependency: Lacuna does not verify a Starknet state proof, authenticate provider output, or compare multiple providers. Committed hashes and raw receipts allow independent re-checking.

## Acceptance rules

For a requested transaction hash, `verifyReceiptValue` requires:

1. a structurally valid receipt;
2. canonical equality between the required returned `transaction_hash` and requested hash;
3. valid `actual_fee` metadata with a decimal or `0x`-prefixed hexadecimal non-negative integer amount and a `WEI` or `FRI` unit;
4. `execution_status === "SUCCEEDED"`;
5. `finality_status === "ACCEPTED_ON_L1"` or `"ACCEPTED_ON_L2"`;
6. a non-negative integer block number;
7. at least one receipt event whose `from_address` canonically equals the exact STRK20 pool.

The current evidence format contains exactly four named checks:

```text
receipt-hash-matches
receipt-succeeded
touched-pool
block-confirmed
```

Unknown, duplicate, missing, or failed checks invalidate an evidence record. Explorer links must be HTTPS Voyager transaction URLs bound to the same canonical hash.

## Browser verification

After a consented wallet call returns a strictly valid hash, the UI labels it **submitted, not verified**. It then:

1. confirms the RPC chain ID;
2. polls `starknet_getTransactionReceipt` a bounded number of times;
3. applies the shared acceptance rules;
4. stops immediately when an accepted receipt fails a terminal rule;
5. labels the transaction verified only when every rule passes.

Receipt polling may be manually requested again. Transaction submission itself is never automatically retried.

## Manifest consistency

```bash
npm run check:manifest
```

This checks:

- JSON shape;
- Starknet hash/address syntax;
- canonical uniqueness, including leading-zero and case equivalents;
- HTTPS demo links when present;
- exact agreement between manifest hashes and evidence records;
- one matching raw receipt for every indexed record;
- schema validity and all-passing checks for every evidence entry;
- deterministic re-derivation of each index record from its raw receipt.

A `demo_video` field is optional while the real recording is pending. Lacuna does not publish a placeholder URL.

## CLI-enforced append-only verification

Add new canonically unique transaction hashes to root `strk20.json`, then run:

```bash
npm run verify:mainnet -- --write
```

The command:

1. validates the existing index and re-derives every indexed record from its raw receipt;
2. rejects missing, unindexed, tampered, or mismatched raw receipt artifacts;
3. separates indexed and pending manifest hashes by canonical felt identity;
4. queries only pending hashes;
5. verifies all pending receipts against Mainnet and the exact pool;
6. validates the complete next index before filesystem publication;
7. creates each new receipt at an exclusive path and never rewrites prior receipts;
8. publishes the merged index with a same-directory rename only after every new receipt is durable;
9. rejects canonical duplicates and receipt-path collisions;
10. performs no writes when every manifest hash is already indexed.

If receipt validation fails, no files are written. If a filesystem failure occurs before index publication, newly created paths are removed on the handled error path. A process interruption can leave an unindexed receipt, which the next manifest check detects and rejects; the prior index and its referenced receipts remain intact.

Outputs:

```text
verification/mainnet/transaction-index.json
verification/mainnet/receipts/<transaction-hash>.json
```

Records use `unclassified-pool-interaction` unless separately reviewed intent data supports a more precise operation. The verifier does not infer private intent from a public receipt.

## Current verified evidence

The manifest and evidence index contain six canonically unique Mainnet transactions. Every record has four passing checks, for 24 passing checks in total.

| Transaction | Block | Status |
|---|---:|---|
| [`0x02e991…1f720`](https://voyager.online/tx/0x02e9918193a344303b170839bc1ab5737758e8306887cfb12c899ea2c481f720) | 13,786,473 | `SUCCEEDED`, `ACCEPTED_ON_L2`, pool event |
| [`0x05f623…11a0cd`](https://voyager.online/tx/0x05f6231da1b66f28964af7ac872ea85a3b1310516c90cc10cf2b9f57c011a0cd) | 13,788,410 | `SUCCEEDED`, `ACCEPTED_ON_L2`, pool event |
| [`0x036e91…8da3`](https://voyager.online/tx/0x036e91f666a49e95c7b125a9d711eaf425c4bd1a1c8fcad98a503d83dbaf8da3) | 13,788,382 | `SUCCEEDED`, `ACCEPTED_ON_L2`, pool event |
| [`0x6e6469…0b5ec`](https://voyager.online/tx/0x6e64697a93ff7b71313e69ea76dae0696ca03b7b85d93d2d736bcba6190b5ec) | 13,936,911 | `SUCCEEDED`, `ACCEPTED_ON_L2`, pool event |
| [`0x031fdd…7b0f2`](https://voyager.online/tx/0x031fdd9bea8f10dee78fd63ef152586c62efa7146c415927fbb5bc1bd207b0f2) | 13,937,171 | `SUCCEEDED`, `ACCEPTED_ON_L2`, pool event |
| [`0x04dd79…931c4`](https://voyager.online/tx/0x04dd797282b7453d2780ed18935b82981c01f6602d4dd2b8e7aa7a0d1f8931c4) | 13,937,473 | `SUCCEEDED`, `ACCEPTED_ON_L2`, pool event |

This is the current CLI-managed evidence set, not a maximum. These records prove accepted interactions with the exact pool; they do not authenticate the private operation that produced each receipt.

## Submission manifest

The root manifest remains intentionally minimal:

```json
{
  "transactions": ["0x..."],
  "contracts": [],
  "demo_url": "https://lacuna-strk.vercel.app/"
}
```

Add `demo_video` only after a real HTTPS video URL exists. Do not list a custom contract unless the submitted transactions satisfy the applicable contract-evidence requirement. Never place wallet addresses, keys, notes, proofs, or private recipe inputs in evidence files.
