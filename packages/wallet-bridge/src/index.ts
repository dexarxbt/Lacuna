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

export type WalletApiStatus = 'supported' | 'outdated' | 'unreported'
export type Strk20SupportStatus = 'supported' | 'unsupported' | 'indeterminate'
export type WalletCapabilityIssue =
  | 'no-account'
  | 'wrong-network'
  | 'api-too-old'
  | 'api-unreported'
  | 'strk20-unsupported'
  | 'strk20-check-failed'
  | 'not-registered'

export type WalletCapabilityReport = {
  walletId: string
  walletName: string
  account: string | null
  chainId: string | null
  apiVersions: string[]
  apiVersionStatus: WalletApiStatus
  meetsRequiredApi: boolean
  strk20Status: Strk20SupportStatus
  strk20Supported: boolean
  registered: boolean | null
  balances: Array<{ token: string; balance: string }>
  issues: WalletCapabilityIssue[]
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

type NormalizedRpcError = {
  code?: number
  message: string
  ambiguous: boolean
}

function parseRpcCode(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value)
  return undefined
}

type RpcErrorMeaning =
  | 'not-registered'
  | 'api-version-unsupported'
  | 'method-unsupported'
  | 'user-refused'
  | 'invalid-request'

function rpcCodeMeaning(code: number | undefined): RpcErrorMeaning | undefined {
  if (code === 118) return 'not-registered'
  if (code === 162) return 'api-version-unsupported'
  if (code === -32601 || code === 4200) return 'method-unsupported'
  if (code === 113) return 'user-refused'
  if (code === 114) return 'invalid-request'
  return undefined
}

function rpcMessageMeaning(message: string): RpcErrorMeaning | undefined {
  const normalized = message.trim()
  if (/^(method not found|method not supported|unsupported method|not implemented)$/i.test(normalized)) {
    return 'method-unsupported'
  }
  if (/\bAPI_VERSION_NOT_SUPPORTED\b/i.test(normalized)) return 'api-version-unsupported'
  if (/\b(USER_REFUSED|user (rejected|refused|denied))\b/i.test(normalized)) return 'user-refused'
  if (/\bINVALID_REQUEST\b/i.test(normalized)) return 'invalid-request'
  return undefined
}

function normalizeRpcError(error: unknown): NormalizedRpcError {
  const root = asRecord(error)
  if (!root) {
    return { message: error instanceof Error ? error.message : String(error), ambiguous: false }
  }

  const records = [root, asRecord(root.error), asRecord(root.data), asRecord(root.cause)]
    .filter((value): value is Record<string, unknown> => value !== null)
  const candidates = records.map((record) => ({
    code: parseRpcCode(record.code),
    message: typeof record.message === 'string' ? record.message : '',
  }))
  const codes = [...new Set(candidates.flatMap(({ code }) => code === undefined ? [] : [code]))]
  const messages = [...new Set(candidates.map(({ message }) => message).filter(Boolean))]
  const meanings = new Set<RpcErrorMeaning>()

  for (const candidate of candidates) {
    const codeMeaning = rpcCodeMeaning(candidate.code)
    const messageMeaning = rpcMessageMeaning(candidate.message)
    if (codeMeaning) meanings.add(codeMeaning)
    if (messageMeaning) meanings.add(messageMeaning)
  }

  // JSON-RPC -32603 is commonly a generic outer wrapper. It may add diagnostics,
  // but it must not erase a more specific structured Wallet API error such as 118.
  const unknownSpecificCodes = codes.filter((code) => rpcCodeMeaning(code) === undefined && code !== -32603)
  const ambiguous = meanings.size > 1
    || (meanings.size > 0 && unknownSpecificCodes.length > 0)
    || (meanings.size === 0 && unknownSpecificCodes.length > 1)

  if (ambiguous) {
    return {
      message: `Conflicting wallet errors: ${messages.join(' | ') || codes.join(' | ')}`,
      ambiguous: true,
    }
  }

  const meaning = meanings.values().next().value as RpcErrorMeaning | undefined
  const semanticCodeCandidate = meaning === undefined
    ? undefined
    : candidates.find(({ code }) => rpcCodeMeaning(code) === meaning)
  const semanticMessageCandidate = meaning === undefined
    ? undefined
    : candidates.find(({ message }) => rpcMessageMeaning(message) === meaning)
  const fallbackCodedCandidate = candidates.find(({ code }) => code !== undefined && code !== -32603)
    ?? candidates.find(({ code }) => code !== undefined)

  return {
    code: semanticCodeCandidate?.code ?? fallbackCodedCandidate?.code,
    message: semanticCodeCandidate?.message
      || semanticMessageCandidate?.message
      || messages[0]
      || String(error),
    ambiguous: false,
  }
}

function rpcErrorCode(error: unknown): number | undefined {
  return normalizeRpcError(error).code
}

function errorMessage(error: unknown): string {
  return normalizeRpcError(error).message
}

function describeRpcError(error: unknown): string {
  const normalized = normalizeRpcError(error)
  return normalized.code === undefined ? normalized.message : `${normalized.message} (code ${normalized.code})`
}

function isUnsupportedMethod(error: unknown): boolean {
  const normalized = normalizeRpcError(error)
  if (normalized.ambiguous) return false
  if (normalized.code === -32601 || normalized.code === 4200) return true
  const namesBalanceMethod = /wallet_strk20Balances|strk20[\s_-]*balance/i.test(normalized.message)
  const reportsUnavailable = /not found|not supported|unsupported|not implemented/i.test(normalized.message)
  return namesBalanceMethod && reportsUnavailable
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

function parseBalances(value: unknown): Array<{ token: string; balance: string }> | null {
  if (!Array.isArray(value)) return null
  const balances: Array<{ token: string; balance: string }> = []
  for (const entry of value) {
    const record = asRecord(entry)
    if (
      !record
      || typeof record.token !== 'string'
      || !ADDRESS_PATTERN.test(record.token)
      || typeof record.balance !== 'string'
      || !AMOUNT_PATTERN.test(record.balance)
    ) return null
    balances.push({ token: record.token, balance: record.balance })
  }
  return balances
}

export async function probeWallet(wallet: InjectedWallet, requestAccount = true): Promise<WalletCapabilityReport> {
  let account: string | null = null
  let chainId: string | null = null
  let apiVersions: string[] = []
  let strk20Status: Strk20SupportStatus = 'indeterminate'
  let balanceResponseSucceeded = false
  let registered: boolean | null = null
  let balances: Array<{ token: string; balance: string }> = []
  let balanceFailureCode: number | undefined
  const details: string[] = []

  if (requestAccount) {
    try {
      account = (await requestStrings(wallet, 'wallet_requestAccounts'))[0] ?? null
      if (!account) details.push('The wallet returned no active account.')
    } catch (error) {
      details.push(`Account access failed: ${describeRpcError(error)}`)
    }
  }

  try {
    chainId = normalizeChainId(await wallet.request({ type: 'wallet_requestChainId' }))
    if (!chainId) details.push('The wallet returned an invalid network response.')
  } catch (error) {
    details.push(`Network detection failed: ${describeRpcError(error)}`)
  }

  try {
    const value = await wallet.request({ type: 'wallet_supportedWalletApi' })
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      apiVersions = value
    } else {
      details.push('Wallet API version lookup returned an invalid response.')
    }
  } catch (error) {
    details.push(`Wallet API version lookup failed: ${describeRpcError(error)}`)
  }

  try {
    const value = await wallet.request({
      type: 'wallet_strk20Balances',
      params: { tokens: [], api_version: REQUIRED_WALLET_API },
    })
    const parsedBalances = parseBalances(value)
    if (parsedBalances === null) {
      details.push('The STRK20 balance method returned an invalid response.')
    } else {
      balances = parsedBalances
      balanceResponseSucceeded = true
      strk20Status = 'supported'
      registered = true
      details.push('The wallet answered the read-only STRK20 balance probe.')
    }
  } catch (error) {
    balanceFailureCode = rpcErrorCode(error)
    if (balanceFailureCode === 118) {
      strk20Status = 'supported'
      registered = false
      details.push('STRK20 is supported, but this account is not registered with the pool.')
    } else if (isUnsupportedMethod(error)) {
      strk20Status = 'unsupported'
      details.push(`The wallet does not expose the STRK20 balance method: ${describeRpcError(error)}`)
    } else {
      details.push(`The STRK20 balance check could not complete: ${describeRpcError(error)}`)
    }
  }

  const advertisedApiSupport = apiVersions.some((version) => compareVersions(version, REQUIRED_WALLET_API) >= 0)
  const inferredApiSupport = apiVersions.length === 0 && balanceResponseSucceeded
  const apiVersionRejected = balanceFailureCode === 162
  const meetsRequiredApi = !apiVersionRejected && (advertisedApiSupport || inferredApiSupport)
  const apiVersionStatus: WalletApiStatus = apiVersionRejected
    ? 'outdated'
    : meetsRequiredApi
      ? 'supported'
      : apiVersions.length > 0
        ? 'outdated'
        : 'unreported'
  const issues: WalletCapabilityIssue[] = []
  if (requestAccount && !account) issues.push('no-account')
  if (chainId !== STARKNET_MAINNET_CHAIN_ID) issues.push('wrong-network')
  if (apiVersionStatus === 'outdated') issues.push('api-too-old')
  if (apiVersionStatus === 'unreported') issues.push('api-unreported')
  if (strk20Status === 'unsupported') issues.push('strk20-unsupported')
  if (strk20Status === 'indeterminate') issues.push('strk20-check-failed')
  if (registered === false) issues.push('not-registered')

  if (inferredApiSupport) {
    details.push(`Compatibility with Wallet API ${REQUIRED_WALLET_API} was inferred from the successful STRK20 response.`)
  }

  return {
    walletId: wallet.id,
    walletName: wallet.name,
    account,
    chainId,
    apiVersions,
    apiVersionStatus,
    meetsRequiredApi,
    strk20Status,
    strk20Supported: strk20Status === 'supported',
    registered,
    balances,
    issues,
    detail: details.join(' '),
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
