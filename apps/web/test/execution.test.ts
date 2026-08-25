import assert from 'node:assert/strict'
import test from 'node:test'
import {
  STRK20_MAINNET_POOL,
  type TransactionEvidence,
} from '@lacuna/evidence-model'
import type {
  InjectedWallet,
  WalletCapabilityReport,
} from '@lacuna/wallet-bridge'
import {
  createExecutionSnapshot,
  draftMatchesSnapshot,
  sessionMatchesSnapshot,
  type ExecutionDraft,
} from '../src/features/studio/execution.ts'
import {
  createBrowserRpc,
  verifySubmittedTransaction,
  type RpcTransport,
} from '../src/features/studio/mainnetReceipt.ts'
import {
  createWalletSession,
  markExecutionCapabilityProven,
  provenRecipeCapabilities,
} from '../src/features/wallet-doctor/walletSession.ts'

const token = '0x123'
const account = '0xabc'
const recipient = '0x456'
const wallet: InjectedWallet = {
  id: 'execution-wallet',
  name: 'Execution Wallet',
  async request() { throw new Error('not called') },
}

function report(overrides: Partial<WalletCapabilityReport> = {}): WalletCapabilityReport {
  return {
    walletId: wallet.id,
    walletName: wallet.name,
    account,
    chainId: 'SN_MAIN',
    apiVersions: ['0.10.3'],
    apiVersionStatus: 'supported',
    meetsRequiredApi: true,
    strk20Status: 'supported',
    strk20Supported: true,
    registered: true,
    balances: [{ token, balance: '100' }],
    issues: [],
    detail: 'Ready',
    ...overrides,
  }
}

const draft: ExecutionDraft = {
  kind: 'transfer',
  token,
  amount: '25',
  recipient,
}

function receipt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    transaction_hash: '0x789',
    execution_status: 'SUCCEEDED',
    finality_status: 'ACCEPTED_ON_L2',
    block_number: 123,
    actual_fee: { amount: '0x10', unit: 'FRI' },
    events: [{ from_address: STRK20_MAINNET_POOL }],
    ...overrides,
  }
}

test('creates an immutable action snapshot only from fresh wallet-reported balances', () => {
  const session = createWalletSession(wallet, report())
  const result = createExecutionSnapshot(session, draft)
  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.ok(Object.isFrozen(result.snapshot))
  assert.ok(Object.isFrozen(result.snapshot.action))
  assert.ok(Object.isFrozen(result.snapshot.actions))
  assert.equal(result.snapshot.action.type === 'transfer' ? result.snapshot.action.amount : '', '0x19')
  assert.equal(draftMatchesSnapshot(draft, result.snapshot), true)
  assert.equal(draftMatchesSnapshot({ ...draft, amount: '26' }, result.snapshot), false)
  assert.equal(sessionMatchesSnapshot(session, result.snapshot), true)
  assert.equal(sessionMatchesSnapshot(createWalletSession(wallet, report({ account: '0xdef' })), result.snapshot), false)
})

test('blocks snapshots for unknown tokens, excess amounts, and non-mainnet sessions', () => {
  const unknownToken = createExecutionSnapshot(createWalletSession(wallet, report()), {
    ...draft,
    token: '0x999',
  })
  const excess = createExecutionSnapshot(createWalletSession(wallet, report()), {
    ...draft,
    amount: '101',
  })
  const wrongNetwork = createExecutionSnapshot(createWalletSession(wallet, report({ chainId: 'SN_SEPOLIA' })), draft)

  assert.equal(unknownToken.ok, false)
  assert.match(unknownToken.ok ? '' : unknownToken.errors.join(' '), /wallet balance probe/)
  assert.equal(excess.ok, false)
  assert.match(excess.ok ? '' : excess.errors.join(' '), /exceeds/)
  assert.equal(wrongNetwork.ok, false)
  assert.match(wrongNetwork.ok ? '' : wrongNetwork.errors.join(' '), /Mainnet/)
})

test('credits prepare and submit capabilities only after explicit successes', () => {
  const session = createWalletSession(wallet, report())
  assert.deepEqual(provenRecipeCapabilities(session), ['strk20Balances'])

  const prepared = markExecutionCapabilityProven(session, 'strk20PrepareInvoke')
  assert.deepEqual(provenRecipeCapabilities(prepared), ['strk20Balances', 'strk20PrepareInvoke'])

  const submitted = markExecutionCapabilityProven(prepared, 'strk20InvokeTransaction')
  assert.deepEqual(provenRecipeCapabilities(submitted), [
    'strk20Balances',
    'strk20PrepareInvoke',
    'strk20InvokeTransaction',
  ])
})

test('verifies a submitted hash only after Mainnet receipt checks pass', async () => {
  const calls: string[] = []
  let receiptCalls = 0
  const rpc: RpcTransport = async (method) => {
    calls.push(method)
    if (method === 'starknet_chainId') return '0x534e5f4d41494e'
    receiptCalls += 1
    if (receiptCalls === 1) throw new Error('Transaction hash not found')
    return receipt()
  }

  const result = await verifySubmittedTransaction(
    '0x789',
    'private-transfer',
    rpc,
    { attempts: 2, delayMilliseconds: 0 },
  )

  assert.equal(result.status, 'verified')
  assert.equal(result.attempts, 2)
  assert.equal(result.evidence?.operation, 'private-transfer')
  assert.deepEqual(calls, [
    'starknet_chainId',
    'starknet_getTransactionReceipt',
    'starknet_getTransactionReceipt',
  ])
})

test('rejects non-mainnet RPC and never upgrades an accepted invalid receipt', async () => {
  const wrongNetwork: RpcTransport = async () => 'SN_SEPOLIA'
  await assert.rejects(
    verifySubmittedTransaction('0x789', 'withdraw', wrongNetwork, { attempts: 1 }),
    /not Starknet Mainnet/,
  )

  let receiptCalls = 0
  const invalidReceipt: RpcTransport = async (method) => {
    if (method === 'starknet_chainId') return 'SN_MAIN'
    receiptCalls += 1
    return receipt({ events: [{ from_address: '0x1' }] })
  }
  const result = await verifySubmittedTransaction(
    '0x789',
    'withdraw',
    invalidReceipt,
    { attempts: 4, delayMilliseconds: 0 },
  )

  assert.equal(result.status, 'unverified')
  assert.equal(result.attempts, 1)
  assert.equal(receiptCalls, 1)
  assert.match(result.errors.join(' '), /No STRK20 pool event/)
  assert.equal((result.evidence as TransactionEvidence).operation, 'withdraw')
})


test('bounds each browser RPC request timeout', () => {
  assert.throws(() => createBrowserRpc('https://example.invalid', fetch, 999), /between 1000 and 30000/)
  assert.throws(() => createBrowserRpc('https://example.invalid', fetch, 30_001), /between 1000 and 30000/)
})
