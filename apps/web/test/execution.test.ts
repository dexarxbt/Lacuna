import assert from 'node:assert/strict'
import test from 'node:test'
import {
  STRK20_MAINNET_POOL,
  type TransactionEvidence,
} from '@lacuna/evidence-model'
import {
  prepareInvoke,
  submitInvoke,
  type InjectedWallet,
  type WalletCapabilityReport,
  type WalletRequest,
} from '@lacuna/wallet-bridge'
import {
  createExecutionSnapshot,
  draftMatchesSnapshot,
  formatTokenAmount,
  getTokenAmountMetadata,
  parseTokenAmount,
  recipientCheckIsCurrent,
  recipientIsReady,
  sessionMatchesSnapshot,
  walletActionErrorMessage,
  type ExecutionDraft,
} from '../src/features/studio/execution.ts'
import {
  checkStrk20RecipientRegistration,
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
const strkToken = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
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
  const strkMetadata = getTokenAmountMetadata(strkToken)
  assert.deepEqual(strkMetadata, { symbol: 'STRK', decimals: 18 })
  assert.equal(parseTokenAmount('1', 18), '1000000000000000000')
  assert.equal(parseTokenAmount('0.5', 18), '500000000000000000')
  assert.equal(parseTokenAmount('0.0000000000000000001', 18), null)
  assert.equal(strkMetadata && formatTokenAmount('0xd02ab486cedc0000', strkMetadata), '15 STRK')

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

test('sends the same converted STRK amount for transfer and withdrawal prepare and submit', async () => {
  const requests: WalletRequest[] = []
  const executionWallet: InjectedWallet = {
    id: 'strk-execution-wallet',
    name: 'STRK Execution Wallet',
    async request(call) {
      requests.push(call)
      if (call.type === 'wallet_strk20PrepareInvoke') {
        return {
          call: { contract_address: '0x1', entry_point: 'apply_actions', calldata: [] },
          proof: { data: '', output: [], proof_facts: [] },
        }
      }
      if (call.type === 'wallet_strk20InvokeTransaction') return { transaction_hash: '0x789' }
      throw new Error(`Unexpected request: ${call.type}`)
    },
  }
  const rawAmount = parseTokenAmount('0.5', 18)
  assert.equal(rawAmount, '500000000000000000')
  const session = createWalletSession(executionWallet, report({
    walletId: executionWallet.id,
    walletName: executionWallet.name,
    balances: [{ token: strkToken, balance: '0xd02ab486cedc0000' }],
  }))

  for (const kind of ['transfer', 'withdraw'] as const) {
    const snapshotResult = createExecutionSnapshot(session, {
      kind,
      token: strkToken,
      amount: rawAmount,
      recipient,
    })
    assert.equal(snapshotResult.ok, true)
    if (!snapshotResult.ok) continue

    const expectedAction = {
      type: kind,
      token: strkToken,
      amount: '0x6f05b59d3b20000',
      recipient,
    }
    assert.deepEqual(snapshotResult.snapshot.action, expectedAction)
    await prepareInvoke(executionWallet, snapshotResult.snapshot.actions)
    await submitInvoke(executionWallet, snapshotResult.snapshot.actions, {
      networkConfirmed: true,
      disclosuresConfirmed: true,
      feeConfirmed: true,
    })

    const [prepareRequest, submitRequest] = requests.slice(-2)
    assert.deepEqual(prepareRequest, {
      type: 'wallet_strk20PrepareInvoke',
      params: { actions: [expectedAction], simulate: true, api_version: '0.10.3' },
    })
    assert.deepEqual(submitRequest, {
      type: 'wallet_strk20InvokeTransaction',
      params: { actions: [expectedAction], api_version: '0.10.3' },
    })
  }
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


test('checks recipient registration only after explicit public RPC disclosure consent', async () => {
  const calls: Array<{ method: string; params: unknown }> = []
  const registrationRpc: RpcTransport = async (method, params) => {
    calls.push({ method, params })
    if (method === 'starknet_chainId') return 'SN_MAIN'
    if (method === 'starknet_call') return ['0x123']
    throw new Error(`Unexpected method: ${method}`)
  }

  await assert.rejects(
    checkStrk20RecipientRegistration(recipient, registrationRpc, {
      recipientDisclosureConfirmed: false,
    }),
    /public RPC disclosure was not confirmed/,
  )
  assert.equal(calls.length, 0)

  await assert.rejects(
    checkStrk20RecipientRegistration('not-an-address', registrationRpc, {
      recipientDisclosureConfirmed: true,
    }),
    /non-zero Starknet hex address/,
  )
  assert.equal(calls.length, 0)

  const registered = await checkStrk20RecipientRegistration(recipient, registrationRpc, {
    recipientDisclosureConfirmed: true,
  })
  assert.deepEqual(registered, { registered: true })
  assert.deepEqual(calls, [
    { method: 'starknet_chainId', params: {} },
    {
      method: 'starknet_call',
      params: {
        request: {
          contract_address: STRK20_MAINNET_POOL,
          entry_point_selector: '0x1a35984e05126dbecb7c3bb9929e7dd9106d460c59b1633739a5c733a5fb13b',
          calldata: [recipient],
        },
        block_id: 'latest',
      },
    },
  ])
})

test('distinguishes unregistered recipients and rejects unsafe registration responses', async () => {
  const unregisteredRpc: RpcTransport = async (method) => (
    method === 'starknet_chainId' ? '0x534e5f4d41494e' : ['0x0']
  )
  const unregistered = await checkStrk20RecipientRegistration(recipient, unregisteredRpc, {
    recipientDisclosureConfirmed: true,
  })
  assert.deepEqual(unregistered, { registered: false })

  let wrongNetworkCalls = 0
  const wrongNetworkRpc: RpcTransport = async () => {
    wrongNetworkCalls += 1
    return 'SN_SEPOLIA'
  }
  await assert.rejects(
    checkStrk20RecipientRegistration(recipient, wrongNetworkRpc, {
      recipientDisclosureConfirmed: true,
    }),
    /not Starknet Mainnet/,
  )
  assert.equal(wrongNetworkCalls, 1)

  const malformedRpc: RpcTransport = async (method) => (
    method === 'starknet_chainId' ? 'SN_MAIN' : ['0x1', '0x2']
  )
  await assert.rejects(
    checkStrk20RecipientRegistration(recipient, malformedRpc, {
      recipientDisclosureConfirmed: true,
    }),
    /malformed STRK20 registration response/,
  )
})

test('makes an explicit unregistered result authoritative while withdrawal stays unaffected', () => {
  assert.equal(recipientIsReady('transfer', false, 'unchecked'), false)
  assert.equal(recipientIsReady('transfer', true, 'unchecked'), true)
  assert.equal(recipientIsReady('transfer', false, 'registered'), true)
  assert.equal(recipientIsReady('transfer', true, 'unregistered'), false)
  assert.equal(recipientIsReady('withdraw', false, 'unregistered'), true)
  assert.equal(recipientCheckIsCurrent(3, 3, false), true)
  assert.equal(recipientCheckIsCurrent(3, 4, false), false)
  assert.equal(recipientCheckIsCurrent(3, 3, true), false)
})

test('attributes generic wallet failures to the exact prepare or submit stage', () => {
  const unknown = { code: 163, message: 'An error occurred (UNKNOWN_ERROR)' }
  const prepareMessage = walletActionErrorMessage(unknown, 'transfer', 'prepare')
  const postPrepareMessage = walletActionErrorMessage(
    new Error('Wallet session changed after preparation.'),
    'transfer',
    'post-prepare',
  )
  const submitMessage = walletActionErrorMessage(unknown, 'transfer', 'submit')

  assert.match(prepareMessage, /^wallet_strk20PrepareInvoke failed:/)
  assert.match(postPrepareMessage, /^Post-prepare session validation failed:/)
  assert.doesNotMatch(postPrepareMessage, /^wallet_strk20PrepareInvoke failed:/)
  assert.match(submitMessage, /^wallet_strk20InvokeTransaction failed:/)
  assert.match(prepareMessage, /confirm the recipient is registered with STRK20/)
})

test('documents the exact STRK20 note-maturity recovery checks', async () => {
  const { readFile } = await import('node:fs/promises')
  const execution = await readFile(
    new URL('../src/features/studio/execution.ts', import.meta.url),
    'utf8',
  )
  const component = await readFile(
    new URL('../src/features/studio/ExecutionPanel.tsx', import.meta.url),
    'utf8',
  )

  assert.match(
    execution,
    /Wait at least 10 Starknet blocks after the latest shield, receive, or change note, and confirm the recipient is registered with STRK20\./,
  )
  assert.match(
    execution,
    /Wait at least 10 Starknet blocks after the latest shield, receive, or change note, and confirm the public destination is a valid Starknet account\./,
  )
  assert.match(component, /I consent to disclose this recipient address to https:\/\/rpc\.starknet\.lava\.build/)
  assert.match(component, /disabled=\{!session \|\| balances\.length === 0 \|\| !recipientReady \|\| busy !== null\}/)
})