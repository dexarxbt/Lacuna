# Wallet compatibility

Lacuna does not hard-code “supported” wallet brands. Runtime method evidence is authoritative because Wallet API support can change independently of a wallet name or advertised version.

## Required execution conditions

A wallet can execute Lacuna's transfer/withdraw path only when it:

1. exposes an injected Starknet provider;
2. grants an account through `wallet_requestAccounts`;
3. reports `SN_MAIN` through `wallet_requestChainId`;
4. proves Wallet API `0.10.3` compatibility;
5. answers `wallet_strk20Balances` with a valid array or structured `NOT_REGISTERED` result;
6. has a registered selected account and sufficient wallet-reported private balance;
7. successfully handles the exact `wallet_strk20PrepareInvoke` simulation;
8. receives explicit user consent and wallet approval before `wallet_strk20InvokeTransaction`.

The first six conditions permit constructing a simulation request. A successful read does not imply prepare or submit support.

## Wallet Doctor

The Doctor starts only after the user clicks **Check wallet** and chooses an injected provider. It calls:

```text
wallet_requestAccounts
wallet_requestChainId
wallet_supportedWalletApi
wallet_strk20Balances({ tokens: [], api_version: "0.10.3" })
```

It is read-only with respect to transactions, not privacy-neutral. After wallet approval, the page receives wallet identity, account, network, reported API versions, token identifiers, and private balance values. Wallet Doctor shows the account and number of wallet-reported token entries. The execution selector displays shortened token identifiers and exact wallet-reported private balances, which remain local but are visible on screen and can appear in screenshots or recordings. This state remains in page memory and has no Lacuna backend or analytics destination.

## Method evidence matrix

| Method | When Lacuna marks it proven | What does not prove it |
|---|---|---|
| `wallet_strk20Balances` | Valid balance array, or structured code `118` (`NOT_REGISTERED`) | Wallet brand, API version alone, malformed response, generic failure |
| `wallet_strk20PrepareInvoke` | A successful user-requested `simulate: true` call with a strictly valid response | Balance support, function presence, advertised API version |
| `wallet_strk20InvokeTransaction` | A consented call returns a valid Starknet transaction hash | Prepare success, a harmless feature probe, inferred support |

The UI uses **proven**, **unavailable**, **inconclusive**, and **not tested** deliberately. “Not tested” is not presented as unsupported.

## API-version semantics

The required version and wallet-reported versions are shown separately.

- An advertised version at or above `0.10.3` proves the version requirement.
- A valid successful balance response may infer compatibility with the requested `0.10.3` only when version lookup reports no versions.
- Structured code `118` proves the balance method exists but does not infer an unreported API version.
- Explicit old-version metadata or code `162` remains blocking.
- Missing metadata is **not reported**, not automatically **too old**.

## Error classification

- **Proven**: the relevant call returned a valid response, or the balance call returned structured code `118`.
- **Unavailable**: the provider explicitly reports that the method is missing or unsupported.
- **Inconclusive**: the provider fails for another reason, returns malformed data, or provides conflicting structured evidence.

A generic JSON-RPC wrapper does not erase a specific nested code. Free-form `NOT_REGISTERED` text without code `118` is never trusted. Conflicting actionable codes remain inconclusive. Numeric codes and diagnostic messages are retained when available.

## Simulation and submission safety

Before each simulation Lacuna re-runs account, chain, API, and balance checks. The user selects only a token returned by the wallet, enters a raw base-unit amount, and supplies a Starknet recipient/destination. The immutable snapshot is invalidated by any input or identity change.

Prepare responses are strictly parsed. Proof structure is validated at the bridge boundary but proof data is discarded; the UI receives only redacted call metadata.

Before submission, Lacuna repeats the account, chain, API, registration, token, and balance preflight and requires it to derive the same frozen fingerprint.

Submission requires:

- the exact simulated snapshot;
- the same wallet, account, and Mainnet network;
- explicit network confirmation;
- explicit disclosure confirmation;
- confirmation that the final fee will be reviewed in the wallet;
- final wallet approval.

Lacuna makes one submission request and never automatically retries it. A returned hash means submitted, not verified.

## Non-support

Arbitrary private invoke is intentionally unavailable. The repository has no trusted helper contract address, code-hash allowlist, ABI, or deterministic calldata encoder. Raw contract/calldata fields are not exposed.

The official sprint guidance names wallets for onboarding, but Lacuna still probes runtime behavior rather than assuming method support.
