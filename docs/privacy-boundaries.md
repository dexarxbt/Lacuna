# Privacy boundaries

Lacuna explains STRK20 privacy; it does not enlarge the protocol's anonymity set or hide public transaction edges.

## Visibility model

| Operation | Public | Private or wallet-held | Correlation risk |
|---|---|---|---|
| Registration | Account address and public viewing key | Private viewing key | Registration timing |
| Shielding | Depositor, token, amount, and timing | The future note's private spending history | A distinctive deposit followed quickly by activity |
| Note-to-note transfer | Pool transaction and timing | Sender, recipient, token, amount, notes, and proof material | Timing and off-chain context |
| Private invoke | Helper contract, downstream calls, moved amounts, and timing | Initiating wallet and private note history | Distinctive amounts or call timing |
| Withdrawal | Destination, token, amount, and timing | Which deposit and private path funded it | A distinctive exit may correlate with prior activity |
| Receipt verification | Hash, relayer, fee, block, status, and pool events | Initiating wallet for a private transaction | External metadata not controlled by Lacuna |

## Capability-doctor disclosure

The capability doctor is read-only with respect to transactions, but it is not privacy-neutral. After explicit user approval, the page receives the selected wallet identity, account address, network, reported Wallet API versions, and STRK20 token identifiers and shielded balances. The interface displays the account and an asset count and retains the probe result only in page memory until refresh or navigation. Lacuna has no backend or analytics pipeline, so it does not transmit this state to an application server; the injected wallet and its own infrastructure remain outside Lacuna's control.

## What Lacuna guarantees

- The recipe analyzer labels known public, private, wallet-held, and correlatable fields.
- Invalid graph conditions are surfaced before a wallet request.
- A private transaction cannot contain more than one external invoke.
- Wallet support is checked using a balances method that is transaction-read-only but exposes the returned wallet state to the page.
- Simulated preparation does not return a submittable proof.
- The submitting adapter refuses execution without explicit network, disclosure, and fee confirmation.
- Evidence records enter the verified index only after public receipt checks pass.

## What Lacuna does not guarantee

- That a connected wallet is free from defects.
- That an anonymizer contract is audited or safe.
- That timing, amounts, browser metadata, RPC traffic, or off-chain behavior cannot be correlated.
- That shielding or withdrawal is private; both have public ERC-20 legs.
- That private DeFi hides amount or timing.
- That a transaction will be accepted, affordable, or mature when requested.
- That the current studio can submit transactions. Execution stays locked until action inputs, simulation, fee review, and recovery states are complete.

## Secret handling

Lacuna has no seed-phrase, private-key, viewing-key, or proof input. Do not paste secrets into browser developer tools, issue reports, screenshots, environment files, or chat. Wallet recovery material must remain offline and under the user's sole control.

## Sources

- [STRK20 mainnet day-zero guidance](https://github.com/starkience/strk20-hackathon/blob/main/docs/MAINNET-DAY-0.md)
- [STRK20 Wallet API overview](https://strk20-by-example.org/starknet-wallet-api/overview)
- [Private DeFi flow](https://strk20-by-example.org/starknet-wallet-api/private-defi)

Source material was rephrased to preserve licensing and attribution requirements.
