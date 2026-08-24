# Mainnet verification

Lacuna separates a syntactically valid draft submission from publicly re-checkable mainnet receipt evidence. The CLI validates responses from one configured public RPC; it does not obtain a state proof or corroborate responses across independent providers.

## Verified network values

```text
Chain ID: SN_MAIN
RPC: https://rpc.starknet.lava.build
Pool: 0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
```

The RPC URL can be replaced for verification with `LACUNA_RPC_URL`; the CLI rejects a provider that does not report Starknet Mainnet. The configured provider remains a trust dependency: the CLI records its receipt response but does not verify a Starknet state proof, authenticate provider output, or compare multiple providers. Transaction hashes and raw receipts are committed so reviewers can re-check them through another provider.

## Draft validation

```bash
npm run check:manifest
```

This checks JSON shape, unique Starknet hashes and addresses, HTTPS links, and exact consistency with `verification/mainnet/transaction-index.json`. It intentionally permits an empty or partial transaction list while the product is under development, but each listed hash must have matching schema-valid evidence with every required check passed, and stale index records are rejected. Demo and video URLs can be published independently as they become available.

## Final chain verification

After placing at least three transaction hashes in root `strk20.json`:

```bash
npm run verify:mainnet -- --write
```

For each hash, the CLI requires:

- `execution_status` equal to `SUCCEEDED`;
- finality accepted on L1 or L2;
- a concrete block number;
- at least one receipt event emitted by the verified STRK20 pool.

Only an all-passing verification run can write outputs. A failed result causes the writer to refuse the entire set. Each successful write replaces the receipt directory and index, preventing rejected or obsolete receipts from remaining in the verified artifact namespace. Outputs are written to:

```text
verification/mainnet/receipts/<transaction-hash>.json
verification/mainnet/transaction-index.json
```

The index records the transaction hash, pool, chain, raw fee amount and unit, block, verification time, explorer URL, and individual verification checks. It labels the operation `unclassified-pool-interaction` until the developer assigns a more precise operation from reviewed intent data; the verifier does not invent transaction meaning from a receipt.

## Submission manifest

The official root file remains intentionally small:

```json
{
  "transactions": ["0x...", "0x...", "0x..."],
  "contracts": [],
  "demo_video": "https://...",
  "demo_url": "https://..."
}
```

Do not list a custom contract unless submitted pool transactions also carry an event from that contract. Never place wallet addresses, keys, notes, proofs, or private recipe inputs in evidence files.
