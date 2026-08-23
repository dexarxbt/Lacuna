# Security

## Trust boundary

Lacuna must never request, receive, store, or transmit a wallet seed phrase or private key. Private notes, proofs, and transaction signatures remain inside a supported wallet. The web application may construct intents, inspect capabilities, prepare calls, and display public receipts.

## Safe use

- Verify that the wallet is connected to the intended Starknet network.
- Review the pool address, public disclosures, and estimated fee before signing.
- Use a dedicated wallet with only the funds required for the intended operation.
- Do not place secrets in environment files, browser storage, issue reports, or screenshots.

## Reporting a vulnerability

Do not disclose an exploitable issue in a public GitHub issue. Contact the maintainer through the contact information on the GitHub profile and include a minimal reproduction without wallet secrets.

No security claim should be inferred from work-in-progress functionality. Supported behavior and known privacy limitations will be documented alongside each integration.
