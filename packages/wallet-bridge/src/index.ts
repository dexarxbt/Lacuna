export const REQUIRED_WALLET_API = '0.10.3' as const
export const STARKNET_MAINNET_CHAIN_ID = 'SN_MAIN' as const
export const STARKNET_MAINNET_CHAIN_ID_HEX = '0x534e5f4d41494e' as const

export type Address = `0x${string}`
export type Felt = string

export type Strk20Action =
  | { type: 'deposit'; token: Address; amount: Felt }
  | { type: 'withdraw'; token: Address; amount: Felt; recipient: Address }
  | { type: 'transfer'; token: Address; amount: Felt | 'OPEN'; recipient: Address }
  | { type: 'invoke'; contract: Address; calldata: string[] }

export type WalletRequest = {
  type: string
  params?: unknown
}

export type InjectedWallet = {
  id: string
  name: string
  version?: string
  icon?: string | { dark: string; light: string }
  request(call: WalletRequest): Promise<unknown>
}

export type WalletCapabilityReport = {
  walletId: string
  walletName: string
  account: string | null
  chainId: string | null
  apiVersions: string[]
  meetsRequiredApi: boolean
  strk20Supported: boolean
  registered: boolean | null
  balances: Array<{ token: string; balance: string }>
  issues: Array<'no-account' | 'wrong-network' | 'api-too-old' | 'strk20-unsupported' | 'not-registered'>
  detail: string
}

export type ExecutionConsent = {
  networkConfirmed: true
  disclosuresConfirmed: true
  feeConfirmed: true
}

export type PreparedInvoke = {
  call: {
    contract_address: string
    entry_point: string
    calldata?: string[]
  }
  proof: {
    data: string
    output: string[]
    proof_facts: string[]
  }
}

export type SubmittedInvoke = { transaction_hash: string }

type RpcError = Error & { code?: number }

const ADDRESS_PATTERN = /^0x[0-9a-f]+$/i
const AMOUNT_PATTERN = /^(0x[0-9a-f]+|\d+)$/i

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function rpcErrorCode(error: unknown): number | undefined {
  return asRecord(error)?.code as number | undefined
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  const message = asRecord(error)?.message
  return typeof message === 'string' ? message : String(error)
}

function normalizeChainId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value === STARKNET_MAINNET_CHAIN_ID_HEX) return STARKNET_MAINNET_CHAIN_ID
  return value
}

function parseVersion(version: string): number[] {
  return version.split('.').map((part) => Number.parseInt(part, 10) || 0)
}

export function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left)
  const rightParts = parseVersion(right)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function isInjectedWallet(value: unknown): value is InjectedWallet {
  const candidate = asRecord(value)
  return candidate !== null
    && typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.request === 'function'
}

export function discoverInjectedWallets(scope: Record<string, unknown>): InjectedWallet[] {
  const keys = ['starknet', ...Object.keys(scope).filter((key) => key.startsWith('starknet_'))]
  const wallets = new Map<string, InjectedWallet>()

  for (const key of keys) {
    try {
      const candidate = scope[key]
      if (isInjectedWallet(candidate)) wallets.set(candidate.id, candidate)
    } catch {
      // Browser extensions may expose getters that throw while locked.
    }
  }

  return [...wallets.values()]
}

async function requestStrings(wallet: InjectedWallet, type: string, params?: unknown): Promise<string[]> {
  const value = await wallet.request({ type, ...(params === undefined ? {} : { params }) })
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function parseBalances(value: unknown): Array<{ token: string; balance: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const record = asRecord(entry)
    return record && typeof record.token === 'string' && typeof record.balance === 'string'
      ? [{ token: record.token, balance: record.balance }]
      : []
  })
}

export async function probeWallet(wallet: InjectedWallet, requestAccount = true): Promise<WalletCapabilityReport> {
  let account: string | null = null
  let chainId: string | null = null
  let apiVersions: string[] = []
  let strk20Supported = false
  let registered: boolean | null = null
  let balances: Array<{ token: string; balance: string }> = []
  let detail = ''

  if (requestAccount) {
    try {
      account = (await requestStrings(wallet, 'wallet_requestAccounts'))[0] ?? null
    } catch (error) {
      detail = `Account access failed: ${errorMessage(error)}`
    }
  }

  try {
    chainId = normalizeChainId(await wallet.request({ type: 'wallet_requestChainId' }))
  } catch (error) {
    detail ||= `Network detection failed: ${errorMessage(error)}`
  }

  try {
    apiVersions = await requestStrings(wallet, 'wallet_supportedWalletApi')
  } catch {
    apiVersions = []
  }

  try {
    const value = await wallet.request({
      type: 'wallet_strk20Balances',
      params: { tokens: [], api_version: REQUIRED_WALLET_API },
    })
    balances = parseBalances(value)
    strk20Supported = true
    registered = true
    detail = 'The wallet answered the read-only STRK20 balance probe.'
  } catch (error) {
    if (rpcErrorCode(error) === 118) {
      strk20Supported = true
      registered = false
      detail = 'STRK20 is supported, but this account is not registered with the pool.'
    } else {
      detail ||= `The wallet rejected the STRK20 capability probe: ${errorMessage(error)}`
    }
  }

  const meetsRequiredApi = apiVersions.some((version) => compareVersions(version, REQUIRED_WALLET_API) >= 0)
  const issues: WalletCapabilityReport['issues'] = []
  if (requestAccount && !account) issues.push('no-account')
  if (chainId !== STARKNET_MAINNET_CHAIN_ID) issues.push('wrong-network')
  if (!meetsRequiredApi) issues.push('api-too-old')
  if (!strk20Supported) issues.push('strk20-unsupported')
  if (registered === false) issues.push('not-registered')

  return {
    walletId: wallet.id,
    walletName: wallet.name,
    account,
    chainId,
    apiVersions,
    meetsRequiredApi,
    strk20Supported,
    registered,
    balances,
    issues,
    detail,
  }
}

function assertAddress(value: string, label: string): asserts value is Address {
  if (!ADDRESS_PATTERN.test(value)) throw new Error(`${label} must be a Starknet hex address.`)
}

function assertAmount(value: string, label: string): void {
  if (!AMOUNT_PATTERN.test(value) || BigInt(value) <= 0n) throw new Error(`${label} must be a positive felt amount.`)
}

export function validateActions(actions: Strk20Action[]): string[] {
  const errors: string[] = []
  if (actions.length === 0) errors.push('At least one STRK20 action is required.')
  if (actions.filter(({ type }) => type === 'invoke').length > 1) {
    errors.push('A private transaction can contain only one external invoke.')
  }

  actions.forEach((action, index) => {
    try {
      if (action.type === 'invoke') {
        assertAddress(action.contract, `Action ${index + 1} contract`)
      } else {
        assertAddress(action.token, `Action ${index + 1} token`)
        if (action.amount !== 'OPEN') assertAmount(action.amount, `Action ${index + 1} amount`)
        if (action.type === 'withdraw' || action.type === 'transfer') {
          assertAddress(action.recipient, `Action ${index + 1} recipient`)
        }
      }
    } catch (error) {
      errors.push(errorMessage(error))
    }
  })

  return errors
}

function assertValidActions(actions: Strk20Action[]): void {
  const errors = validateActions(actions)
  if (errors.length > 0) throw new Error(errors.join(' '))
}

export async function prepareInvoke(
  wallet: InjectedWallet,
  actions: Strk20Action[],
): Promise<PreparedInvoke> {
  assertValidActions(actions)
  return await wallet.request({
    type: 'wallet_strk20PrepareInvoke',
    params: { actions, simulate: true, api_version: REQUIRED_WALLET_API },
  }) as PreparedInvoke
}

function hasConsent(value: Partial<ExecutionConsent>): value is ExecutionConsent {
  return value.networkConfirmed === true
    && value.disclosuresConfirmed === true
    && value.feeConfirmed === true
}

export async function submitInvoke(
  wallet: InjectedWallet,
  actions: Strk20Action[],
  consent: Partial<ExecutionConsent>,
): Promise<SubmittedInvoke> {
  assertValidActions(actions)
  if (!hasConsent(consent)) {
    throw new Error('Execution requires explicit network, disclosure, and fee confirmation.')
  }

  return await wallet.request({
    type: 'wallet_strk20InvokeTransaction',
    params: { actions, api_version: REQUIRED_WALLET_API },
  }) as SubmittedInvoke
}

export function isUserRejection(error: unknown): boolean {
  return rpcErrorCode(error) === 113
}

export type { RpcError }
