import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareVersions,
  discoverInjectedWallets,
  isUnknownWalletError,
  prepareInvoke,
  probeWallet,
  submitInvoke,
  validateActions,
  walletErrorCode,
  type InjectedWallet,
  type Strk20Action,
  type WalletRequest,
} from '../src/index.ts'

const token = '0x123' as const
const recipient = '0x456' as const
const transfer: Strk20Action[] = [{ type: 'transfer', token, amount: '0x1', recipient }]

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

test('private invoke is rejected before prepare or submit reaches the wallet', async () => {
  const invoke: Strk20Action[] = [{ type: 'invoke', contract: '0x1', calldata: [] }]
  const doubleInvoke: Strk20Action[] = [
    ...invoke,
    { type: 'invoke', contract: '0x2', calldata: [] },
  ]
  let requestCount = 0
  const wallet = mockWallet(() => {
    requestCount += 1
    throw new Error('Wallet must not be reached.')
  })
  const consent = {
    networkConfirmed: true as const,
    disclosuresConfirmed: true as const,
    feeConfirmed: true as const,
  }

  assert.match(validateActions(invoke).join(' '), /Arbitrary private invoke is unavailable/)
  assert.match(validateActions(doubleInvoke).join(' '), /only one external invoke/)
  await assert.rejects(prepareInvoke(wallet, invoke), /Arbitrary private invoke is unavailable/)
  await assert.rejects(submitInvoke(wallet, invoke, consent), /Arbitrary private invoke is unavailable/)
  assert.equal(requestCount, 0)
})

test('keeps unknown probe failures indeterminate and visible', async () => {
  assert.equal(isUnknownWalletError({ code: 163, message: 'An error occurred (UNKNOWN_ERROR)' }), true)
  assert.equal(walletErrorCode({ code: 163, message: 'An error occurred (UNKNOWN_ERROR)' }), 163)
  assert.equal(isUnknownWalletError(new Error('An error occurred (UNKNOWN_ERROR)')), true)
  assert.equal(walletErrorCode(new Error('An error occurred (UNKNOWN_ERROR)')), undefined)
  assert.equal(isUnknownWalletError({ code: 119, message: 'INSUFFICIENT_PRIVATE_BALANCE' }), false)

  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') throw { code: 163, message: 'Version lookup failed' }
    if (call.type === 'wallet_strk20Balances') {
      throw { error: { code: '163', message: 'Privacy service unavailable' } }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'indeterminate')
  assert.equal(report.strk20Supported, false)
  assert.equal(report.apiVersionStatus, 'unreported')
  assert.deepEqual(report.issues, ['api-unreported', 'strk20-check-failed'])
  assert.match(report.detail, /Version lookup failed \(code 163\)/)
  assert.match(report.detail, /Privacy service unavailable \(code 163\)/)
})

test('marks only an explicit missing method as unsupported', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') {
      throw { error: { code: '-32601', message: 'Method not found' } }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'unsupported')
  assert.deepEqual(report.issues, ['strk20-unsupported'])
  assert.match(report.detail, /Method not found \(code -32601\)/)
})

test('does not accept a malformed balance response as support', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') return { balances: [] }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'indeterminate')
  assert.equal(report.registered, null)
  assert.deepEqual(report.issues, ['strk20-check-failed'])
  assert.match(report.detail, /invalid response/)
})

test('infers required API compatibility from a successful STRK20 response', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') throw { code: 163, message: 'Unavailable' }
    if (call.type === 'wallet_strk20Balances') return []
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'supported')
  assert.equal(report.meetsRequiredApi, true)
  assert.equal(report.apiVersionStatus, 'supported')
  assert.deepEqual(report.issues, [])
  assert.match(report.detail, /inferred from the successful STRK20 response/)
})

test('recognizes nested numeric-string not-registered errors', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') {
      throw { data: { code: '118', message: 'An error occurred (NOT_REGISTERED)' } }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'supported')
  assert.equal(report.registered, false)
  assert.deepEqual(report.issues, ['not-registered'])
})

test('rejects invalid balance entries instead of proving support', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') return [{ token: 'not-an-address', balance: 'NaN' }]
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'indeterminate')
  assert.deepEqual(report.issues, ['strk20-check-failed'])
})

test('keeps conflicting nested wallet errors indeterminate', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') {
      throw {
        message: 'Method not found',
        data: { code: 118, message: 'An error occurred (NOT_REGISTERED)' },
      }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'indeterminate')
  assert.equal(report.registered, null)
  assert.deepEqual(report.issues, ['strk20-check-failed'])
  assert.match(report.detail, /Conflicting wallet errors/)
})

test('does not let a balance response override an explicitly old API', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.9.0']
    if (call.type === 'wallet_strk20Balances') return []
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'supported')
  assert.equal(report.meetsRequiredApi, false)
  assert.equal(report.apiVersionStatus, 'outdated')
  assert.deepEqual(report.issues, ['api-too-old'])
})

test('not-registered does not infer an unreported API version', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') throw { code: 163, message: 'Unavailable' }
    if (call.type === 'wallet_strk20Balances') throw { code: 118, message: 'An error occurred (NOT_REGISTERED)' }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'supported')
  assert.equal(report.meetsRequiredApi, false)
  assert.equal(report.apiVersionStatus, 'unreported')
  assert.deepEqual(report.issues, ['api-unreported', 'not-registered'])
})

test('reports API version rejection as outdated and capability as incomplete', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') {
      throw { code: 162, message: 'An error occurred (API_VERSION_NOT_SUPPORTED)' }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.meetsRequiredApi, false)
  assert.equal(report.apiVersionStatus, 'outdated')
  assert.equal(report.strk20Status, 'indeterminate')
  assert.deepEqual(report.issues, ['api-too-old', 'strk20-check-failed'])
})

test('does not classify an unrelated not-implemented message as missing STRK20', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') throw new Error('Account recovery is not implemented')
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'indeterminate')
  assert.deepEqual(report.issues, ['strk20-check-failed'])
})

test('keeps root-coded equal-code message conflicts indeterminate', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') {
      throw {
        code: 118,
        message: 'An error occurred (NOT_REGISTERED)',
        data: { code: 118, message: 'Method not found' },
      }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'indeterminate')
  assert.equal(report.registered, null)
  assert.deepEqual(report.issues, ['strk20-check-failed'])
  assert.match(report.detail, /Conflicting wallet errors/)
})


test('keeps explicit not-registered through a generic server wrapper', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3', '0.7.2']
    if (call.type === 'wallet_strk20Balances') {
      throw {
        code: 118,
        message: 'An error occurred (NOT_REGISTERED)',
        data: { code: -32603, message: 'Internal server error' },
      }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.apiVersionStatus, 'supported')
  assert.equal(report.strk20Status, 'supported')
  assert.equal(report.registered, false)
  assert.deepEqual(report.issues, ['not-registered'])
  assert.doesNotMatch(report.detail, /Conflicting wallet errors/)
})

test('recognizes nested not-registered behind a generic root wrapper', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') {
      throw {
        code: -32603,
        message: 'Internal server error',
        error: { code: '118', message: 'An error occurred (NOT_REGISTERED)' },
      }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'supported')
  assert.equal(report.registered, false)
  assert.deepEqual(report.issues, ['not-registered'])
})

test('does not trust free-form not-registered text without code 118', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') {
      throw {
        message: 'An error occurred (NOT_REGISTERED)',
        data: { message: 'Internal server error' },
      }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'indeterminate')
  assert.equal(report.registered, null)
  assert.deepEqual(report.issues, ['strk20-check-failed'])
})

test('keeps not-registered plus an unknown structured code inconclusive', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') {
      throw {
        code: 118,
        message: 'An error occurred (NOT_REGISTERED)',
        cause: { code: 999, message: 'Unknown provider state' },
      }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'indeterminate')
  assert.equal(report.registered, null)
  assert.deepEqual(report.issues, ['strk20-check-failed'])
  assert.match(report.detail, /Conflicting wallet errors/)
})

test('keeps a generic internal server error inconclusive on its own', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
    if (call.type === 'wallet_strk20Balances') {
      throw { code: -32603, message: 'Internal server error' }
    }
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'indeterminate')
  assert.equal(report.registered, null)
  assert.deepEqual(report.issues, ['strk20-check-failed'])
})


test('redacts proof material from validated simulation results', async () => {
  const wallet = mockWallet(() => ({
    call: { contract_address: '0x1', entry_point: 'execute', calldata: ['0x1', '2'] },
    proof: { data: 'secret-proof-data', output: ['secret-output'], proof_facts: ['secret-fact'] },
  }))

  const result = await prepareInvoke(wallet, transfer)
  assert.deepEqual(result, {
    simulated: true,
    call: { contractAddress: '0x1', entryPoint: 'execute', calldataLength: 2 },
  })
  assert.equal(JSON.stringify(result).includes('secret'), false)
})

test('rejects malformed prepare and submit responses', async () => {
  await assert.rejects(
    prepareInvoke(mockWallet(() => ({ call: {}, proof: {} })), transfer),
    /malformed STRK20 simulation response/,
  )
  await assert.rejects(
    submitInvoke(mockWallet(() => ({ transaction_hash: 'not-a-hash' })), transfer, {
      networkConfirmed: true,
      disclosuresConfirmed: true,
      feeConfirmed: true,
    }),
    /invalid Starknet transaction hash/,
  )
})

test('bounds action count, calldata, and felt values before wallet access', () => {
  const tooMany = Array.from({ length: 9 }, () => transfer[0])
  assert.match(validateActions(tooMany).join(' '), /at most 8 actions/)

  const oversizedFelt = '0x800000000000011000000000000000000000000000000000000000000000001'
  assert.match(
    validateActions([{ type: 'transfer', token, amount: oversizedFelt, recipient }]).join(' '),
    /positive felt amount/,
  )
  assert.match(
    validateActions([{ type: 'invoke', contract: '0x1', calldata: [oversizedFelt] }]).join(' '),
    /must be a Starknet felt/,
  )
})


test('rejects mixed or malformed account responses without claiming registration', async () => {
  for (const accounts of [[42, '0xabc'], ['not-an-address']]) {
    const wallet = mockWallet((call) => {
      if (call.type === 'wallet_requestAccounts') return accounts
      if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
      if (call.type === 'wallet_supportedWalletApi') return ['0.10.3']
      if (call.type === 'wallet_strk20Balances') return [{ token, balance: '10' }]
      return []
    })

    const report = await probeWallet(wallet)
    assert.equal(report.account, null)
    assert.equal(report.registered, null)
    assert.ok(report.issues.includes('no-account'))
    assert.match(report.detail, /Account access failed/)
  }
})


test('does not infer API compatibility from malformed version metadata', async () => {
  const wallet = mockWallet((call) => {
    if (call.type === 'wallet_requestAccounts') return ['0xabc']
    if (call.type === 'wallet_requestChainId') return 'SN_MAIN'
    if (call.type === 'wallet_supportedWalletApi') return ['0.10.3-preview']
    if (call.type === 'wallet_strk20Balances') return [{ token, balance: '10' }]
    return []
  })

  const report = await probeWallet(wallet)
  assert.equal(report.strk20Status, 'supported')
  assert.equal(report.meetsRequiredApi, false)
  assert.equal(report.apiVersionStatus, 'unreported')
  assert.ok(report.issues.includes('api-unreported'))
  assert.match(report.detail, /invalid response/)
})
