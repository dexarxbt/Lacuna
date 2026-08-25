import {
  evidenceSummary,
  formatEvidenceOperation,
  rawReceiptUrl,
  shortenTransactionHash,
  verifiedTransactions,
} from '../evidence'

const checkLabels = {
  'receipt-hash-matches': 'Receipt hash matched',
  'receipt-succeeded': 'Execution succeeded',
  'touched-pool': 'Verified pool event',
  'block-confirmed': 'Accepted block',
} as const

export function EvidenceLedger() {
  return (
    <section
      aria-labelledby="transactions-title"
      className="landing-section landing-transactions wrap"
      id="transactions"
    >
      <div className="landing-section-heading landing-reveal">
        <p className="landing-kicker">APPEND-ONLY MAINNET EVIDENCE</p>
        <h2 id="transactions-title">Transactions</h2>
        <p>
          Every row is parsed from the committed evidence index at build time. Each receipt
          must return the requested hash, include valid actual-fee metadata, succeed, emit an
          event from the verified STRK20 pool, and reach an accepted Starknet block.
        </p>
      </div>

      <div className="transaction-ledger-summary landing-reveal">
        <div>
          <span>VERIFIED RECEIPTS</span>
          <strong>{evidenceSummary.verifiedCount}</strong>
        </div>
        <p className="status-ready">
          <i aria-hidden="true" />
          Verified evidence · append-only
        </p>
      </div>

      <ol aria-label="Verified Mainnet transactions" className="transaction-ledger-list">
        {verifiedTransactions.map((transaction, index) => (
          <li className="transaction-ledger-item landing-reveal" key={transaction.transactionHash}>
            <header>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <p>{formatEvidenceOperation(transaction.operation)}</p>
                <code title={transaction.transactionHash}>
                  {shortenTransactionHash(transaction.transactionHash)}
                </code>
              </div>
              <div className="transaction-ledger-links">
                <a href={transaction.explorerUrl} rel="noreferrer" target="_blank">
                  Voyager <span aria-hidden="true">↗</span>
                </a>
                <a href={rawReceiptUrl(transaction.transactionHash)} rel="noreferrer" target="_blank">
                  Raw receipt <span aria-hidden="true">↗</span>
                </a>
              </div>
            </header>

            <dl>
              <div><dt>Network</dt><dd>{transaction.chainId}</dd></div>
              <div><dt>Block</dt><dd>{transaction.blockNumber}</dd></div>
              <div><dt>Actual fee</dt><dd>{transaction.actualFee.amount} {transaction.actualFee.unit}</dd></div>
              <div><dt>Verified</dt><dd>{new Date(transaction.verifiedAt).toISOString().slice(0, 10)}</dd></div>
            </dl>

            <ul aria-label={`Checks for transaction ${transaction.transactionHash}`}>
              {transaction.checks.map((check) => (
                <li key={check.name} title={check.detail}>
                  <i aria-hidden="true" /> {checkLabels[check.name]}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="transaction-ledger-source landing-reveal">
        Source of truth:{' '}
        <a
          href="https://github.com/dexarxbt/Lacuna/blob/main/verification/mainnet/transaction-index.json"
          rel="noreferrer"
          target="_blank"
        >
          committed transaction index <span aria-hidden="true">↗</span>
        </a>
      </p>
    </section>
  )
}
