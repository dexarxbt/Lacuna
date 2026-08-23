import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareVersions,
  discoverInjectedWallets,
  prepareInvoke,
  probeWallet,
  submitInvoke,
  validateActions,
  type InjectedWallet,
  type Strk20Action,
  type WalletRequest,
} from '../src/index.ts'

const token = '0x123' as const
const recipient = '0x456' as const
const transfer: Strk20Action[] = [{ type: 'transfer', token, amount: '1', recipient }]

function mockWallet(handler: (call: WalletRequest) => unknown): InjectedWallet {
  return {
    id: 'mock',
    name: 'Mock wallet',
    request: async (call) => handler(call),
  }
}

test('discovers injected Starknet wallets once', () => {
  const wallet = mockWallet(() => [])
  const wallets = discoverInjectedWallets({ starknet: wallet, starknet_mock: wallet, other: {} })
  assert.deepEqual(wallets, [wallet])
})

test('compares wallet API versions numerically', () => {
  assert.equal(compareVersions('0.10.3', '0.10.3'), 0)
  assert.equal(compareVersions('0.10.4', '0.10.3'), 1)
  assert.equal(compareVersions('0.9.9', '0.10.3'), -1)
})

test('probes mainnet and STRK20 support without reading secrets', async () => {
  const calls: WalletRequest[] = []
  const wallet = mockWallet((call) => {
    calls.push(call)
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return '0x534e5f4d41494e'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') return [{ token, balance: '10' }]
    throw new Error('Unexpected call')
  })

  const report = await probeWallet(wallet)

  assert.equal(report.strk20Supported, true)
  assert.equal(report.registered, true)
  assert.equal(report.chainId, 'SN_MAIN')
  assert.deepEqual(report.issues, [])
  assert.deepEqual(calls.at(-1)?.params, { tokens: [], api_version: '0.10.3' })
})

test('not-registered still proves that the STRK20 method exists', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') throw { code: 118, message: 'NOT_REGISTERED' }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Supported, true)
  assert.equal(report.registered, false)
  assert.deepEqual(report.issues, ['not-registered'])
})

test('prepare always requests a non-submittable simulation', async () => {
  let request: WalletRequest | undefined
  const wallet = mockWallet((call) => {
    request = call
    return { call: { contract_address: '0x1', entry_point: 'x' }, proof: { data: '', output: [], proof_facts: [] } }
  })

  await prepareInvoke(wallet, transfer)
  assert.equal(request?.type, 'wallet_strk20PrepareInvoke')
  assert.deepEqual(request?.params, { actions: transfer, simulate: true, api_version: '0.10.3' })
})

test('submission is blocked until every review gate is confirmed', async () => {
  let submitted = false
  const wallet = mockWallet(() => {
    submitted = true
    return { transaction_hash: '0xabc' }
  })

  await assert.rejects(
    submitInvoke(wallet, transfer, { networkConfirmed: true }),
    /explicit network, disclosure, and fee confirmation/,
  )
  assert.equal(submitted, false)

  const result = await submitInvoke(wallet, transfer, {
    networkConfirmed: true,
    disclosuresConfirmed: true,
    feeConfirmed: true,
  })
  assert.equal(result.transaction_hash, '0xabc')
})

test('invalid actions fail before reaching a wallet', async () => {
  const actions: Strk20Action[] = [
    { type: 'invoke', contract: '0x1', calldata: [] },
    { type: 'invoke', contract: '0x2', calldata: [] },
  ]
  assert.match(validateActions(actions).join(' '), /only one external invoke/)
})
