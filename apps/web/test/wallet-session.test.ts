import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeRecipe, recipes, type Capability } from '@lacuna/recipe-engine'
import type {
  InjectedWallet,
  Strk20SupportStatus,
  WalletCapabilityReport,
} from '@lacuna/wallet-bridge'
import {
  createWalletSession,
  provenRecipeCapabilities,
} from '../src/features/wallet-doctor/walletSession.ts'

const wallet: InjectedWallet = {
  id: 'test-wallet',
  name: 'Test Wallet',
  async request() {
    throw new Error('The pure session tests must not call the wallet.')
  },
}

function report(
  strk20Status: Strk20SupportStatus,
  registered: boolean | null = true,
): WalletCapabilityReport {
  return {
    walletId: wallet.id,
    walletName: wallet.name,
    account: '0x1234',
    chainId: 'SN_MAIN',
    apiVersions: ['0.10.3'],
    apiVersionStatus: 'supported',
    meetsRequiredApi: true,
    strk20Status,
    strk20Supported: strk20Status === 'supported',
    registered,
    balances: registered ? [{ token: '0x1', balance: '10' }] : [],
    issues: registered === false ? ['not-registered'] : [],
    detail: 'Test report',
  }
}

test('publishes only identity-matched wallet sessions', () => {
  const session = createWalletSession(wallet, report('supported'))
  assert.equal(session.wallet, wallet)
  assert.equal(session.report.walletId, wallet.id)
  assert.ok(Object.isFrozen(session))

  assert.throws(
    () => createWalletSession(wallet, { ...report('supported'), walletId: 'another-wallet' }),
    /identity does not match/,
  )
})

test('maps only proven balance-method support into recipe capabilities', () => {
  const cases: Array<{
    name: string
    session: ReturnType<typeof createWalletSession> | null
    expected: Capability[]
  }> = [
    { name: 'no session', session: null, expected: [] },
    { name: 'supported and registered', session: createWalletSession(wallet, report('supported')), expected: ['strk20Balances'] },
    { name: 'supported but unregistered', session: createWalletSession(wallet, report('supported', false)), expected: ['strk20Balances'] },
    { name: 'explicitly unsupported', session: createWalletSession(wallet, report('unsupported', null)), expected: [] },
    { name: 'indeterminate', session: createWalletSession(wallet, report('indeterminate', null)), expected: [] },
  ]

  for (const fixture of cases) {
    const capabilities = provenRecipeCapabilities(fixture.session)
    assert.deepEqual(capabilities, fixture.expected, fixture.name)
    assert.ok(!capabilities.includes('strk20PrepareInvoke'), fixture.name)
    assert.ok(!capabilities.includes('strk20InvokeTransaction'), fixture.name)
  }
})

test('connects balance evidence to maturity checks without claiming execution methods', () => {
  const recipe = recipes.find(({ id }) => id === 'shielded-transfer')
  assert.ok(recipe)

  const noWalletAnalysis = analyzeRecipe(recipe, {
    capabilities: provenRecipeCapabilities(null),
  })
  const noWalletMaturity = noWalletAnalysis.steps.find(({ id }) => id === 'mature-deposit')
  assert.ok(noWalletMaturity)
  assert.equal(
    noWalletMaturity.diagnostics.filter(({ code }) => code === 'missing-capability').length,
    1,
  )

  const balanceOnlyAnalysis = analyzeRecipe(recipe, {
    capabilities: provenRecipeCapabilities(createWalletSession(wallet, report('supported'))),
  })
  const maturity = balanceOnlyAnalysis.steps.find(({ id }) => id === 'mature-deposit')
  const transfer = balanceOnlyAnalysis.steps.find(({ id }) => id === 'send-privately')
  assert.ok(maturity)
  assert.ok(transfer)
  assert.equal(maturity.diagnostics.filter(({ code }) => code === 'missing-capability').length, 0)
  assert.equal(transfer.diagnostics.filter(({ code }) => code === 'missing-capability').length, 2)
  assert.equal(balanceOnlyAnalysis.isExecutable, false)
})
