export type StepKind =
  | 'register'
  | 'shield'
  | 'waitForMaturity'
  | 'privateTransfer'
  | 'privateInvoke'
  | 'withdraw'
  | 'verify'

export type Visibility = 'private' | 'public' | 'derived' | 'wallet-held'
export type Capability = 'strk20Balances' | 'strk20PrepareInvoke' | 'strk20InvokeTransaction'
export type DiagnosticSeverity = 'error' | 'warning' | 'info'

export type Disclosure = {
  subject: string
  visibility: Visibility
  explanation: string
}

export type RecipeStep = {
  id: string
  kind: StepKind
  label?: string
  transactionGroup?: string
}

export type Recipe = {
  id: string
  name: string
  description: string
  steps: RecipeStep[]
}

export type AnalysisContext = {
  capabilities: Capability[]
  recipientRegistered?: boolean
}

export type Diagnostic = {
  code:
    | 'duplicate-step-id'
    | 'missing-capability'
    | 'recipient-not-registered'
    | 'missing-private-balance'
    | 'note-not-mature'
    | 'orphan-maturity-wait'
    | 'multiple-external-invokes'
    | 'unsupported-private-invoke'
    | 'nothing-to-verify'
  severity: DiagnosticSeverity
  stepId: string
  message: string
}

export type AnalyzedStep = RecipeStep & {
  title: string
  summary: string
  disclosures: Disclosure[]
  requiredCapabilities: Capability[]
  diagnostics: Diagnostic[]
}

export type RecipeAnalysis = {
  recipe: Recipe
  steps: AnalyzedStep[]
  diagnostics: Diagnostic[]
  isExecutable: boolean
  disclosureCounts: Record<Visibility, number>
  requiredCapabilities: Capability[]
}

type StepDefinition = {
  title: string
  summary: string
  requiredCapabilities: Capability[]
  disclosures: Disclosure[]
}

const stepDefinitions: Record<StepKind, StepDefinition> = {
  register: {
    title: 'Register recipient',
    summary: 'Publish the viewing key required to receive encrypted notes.',
    requiredCapabilities: [],
    disclosures: [
      { subject: 'Wallet address', visibility: 'public', explanation: 'Registration is an ordinary public Starknet transaction.' },
      { subject: 'Public viewing key', visibility: 'public', explanation: 'Relayers use this key to encrypt notes for the recipient.' },
      { subject: 'Private viewing key', visibility: 'wallet-held', explanation: 'The private half is derived and must never leave the wallet.' },
    ],
  },
  shield: {
    title: 'Shield assets',
    summary: 'Deposit public ERC-20 value into the STRK20 pool as an encrypted note.',
    requiredCapabilities: [],
    disclosures: [
      { subject: 'Depositor address', visibility: 'public', explanation: 'The deposit event identifies the shielding account.' },
      { subject: 'Token and amount', visibility: 'public', explanation: 'Shielding does not hide the deposited asset or amount.' },
      { subject: 'Future private spend', visibility: 'private', explanation: 'Subsequent note-to-note activity is not linked publicly to this deposit.' },
    ],
  },
  waitForMaturity: {
    title: 'Wait for maturity',
    summary: 'Hold execution until the newest note has enough confirmations to spend.',
    requiredCapabilities: ['strk20Balances'],
    disclosures: [
      { subject: 'Observed timing', visibility: 'derived', explanation: 'Waiting patterns may be correlated with nearby public activity.' },
      { subject: 'Note inventory', visibility: 'wallet-held', explanation: 'Private note discovery and balance state stay inside the wallet.' },
    ],
  },
  privateTransfer: {
    title: 'Private transfer',
    summary: 'Spend a mature note and create an encrypted note for a registered recipient.',
    requiredCapabilities: ['strk20PrepareInvoke', 'strk20InvokeTransaction'],
    disclosures: [
      { subject: 'Sender and recipient', visibility: 'private', explanation: 'The pool emits no public link between either party.' },
      { subject: 'Token and amount', visibility: 'private', explanation: 'A note-to-note transfer does not publish the transferred value.' },
      { subject: 'Pool activity and timing', visibility: 'public', explanation: 'A relayed pool transaction and its inclusion time remain observable.' },
      { subject: 'Notes and proof', visibility: 'wallet-held', explanation: 'The wallet discovers notes, builds the proof, and signs.' },
    ],
  },
  privateInvoke: {
    title: 'Private contract invoke',
    summary: 'Route a private action through one external anonymizer helper.',
    requiredCapabilities: ['strk20PrepareInvoke', 'strk20InvokeTransaction'],
    disclosures: [
      { subject: 'Initiating wallet', visibility: 'private', explanation: 'Shared relayers break the public sender link.' },
      { subject: 'Helper and downstream calls', visibility: 'public', explanation: 'The anonymizer and contracts it calls are visible on-chain.' },
      { subject: 'Moved amounts and timing', visibility: 'public', explanation: 'Private DeFi does not hide public venue amounts or timing.' },
      { subject: 'Wallet-to-action correlation', visibility: 'derived', explanation: 'Distinctive amounts or timing can weaken anonymity.' },
    ],
  },
  withdraw: {
    title: 'Withdraw assets',
    summary: 'Move a mature private note back to a public Starknet balance.',
    requiredCapabilities: ['strk20PrepareInvoke', 'strk20InvokeTransaction'],
    disclosures: [
      { subject: 'Destination, token, and amount', visibility: 'public', explanation: 'The withdrawal edge is intentionally transparent.' },
      { subject: 'Source deposit and private history', visibility: 'private', explanation: 'The withdrawal does not reveal which deposit funded it.' },
      { subject: 'Transaction timing', visibility: 'public', explanation: 'Settlement time is visible and may enable correlation.' },
    ],
  },
  verify: {
    title: 'Verify receipt',
    summary: 'Confirm successful settlement and preserve public evidence.',
    requiredCapabilities: [],
    disclosures: [
      { subject: 'Transaction hash and receipt', visibility: 'public', explanation: 'Verification relies on public Starknet data.' },
      { subject: 'Relayer address and fee', visibility: 'public', explanation: 'The on-chain sender is a rotating relayer, not the private user.' },
      { subject: 'Private wallet identity', visibility: 'private', explanation: 'A private action receipt does not identify the initiating wallet.' },
    ],
  },
}

function diagnostic(
  code: Diagnostic['code'],
  severity: DiagnosticSeverity,
  stepId: string,
  message: string,
): Diagnostic {
  return { code, severity, stepId, message }
}

export function analyzeRecipe(recipe: Recipe, context: AnalysisContext): RecipeAnalysis {
  const availableCapabilities = new Set(context.capabilities)
  const seenIds = new Set<string>()
  const invokeCountByGroup = new Map<string, number>()
  const allDiagnostics: Diagnostic[] = []
  const requiredCapabilities = new Set<Capability>()
  let recipientRegistered = context.recipientRegistered ?? false
  let hasPrivateBalance = false
  let noteMature = false
  let hasTransaction = false

  const steps = recipe.steps.map((step): AnalyzedStep => {
    const definition = stepDefinitions[step.kind]
    const stepDiagnostics: Diagnostic[] = []

    if (seenIds.has(step.id)) {
      stepDiagnostics.push(diagnostic('duplicate-step-id', 'error', step.id, `Step id “${step.id}” must be unique.`))
    }
    seenIds.add(step.id)

    for (const capability of definition.requiredCapabilities) {
      requiredCapabilities.add(capability)
      if (!availableCapabilities.has(capability)) {
        stepDiagnostics.push(diagnostic('missing-capability', 'error', step.id, `The connected wallet must support ${capability}.`))
      }
    }

    if (step.kind === 'register') {
      recipientRegistered = true
      hasTransaction = true
    }

    if (step.kind === 'shield') {
      hasPrivateBalance = true
      noteMature = false
      hasTransaction = true
    }

    if (step.kind === 'waitForMaturity') {
      if (!hasPrivateBalance) {
        stepDiagnostics.push(diagnostic('orphan-maturity-wait', 'warning', step.id, 'There is no private note to mature yet.'))
      } else {
        noteMature = true
      }
    }

    if (step.kind === 'privateTransfer') {
      if (!recipientRegistered) {
        stepDiagnostics.push(diagnostic('recipient-not-registered', 'error', step.id, 'Register the recipient before sending a private note.'))
      }
      if (!hasPrivateBalance) {
        stepDiagnostics.push(diagnostic('missing-private-balance', 'error', step.id, 'Shield assets before creating a private transfer.'))
      } else if (!noteMature) {
        stepDiagnostics.push(diagnostic('note-not-mature', 'error', step.id, 'Wait for the input note to mature before spending it.'))
      }
      noteMature = false
      hasTransaction = true
    }

    if (step.kind === 'privateInvoke') {
      stepDiagnostics.push(diagnostic(
        'unsupported-private-invoke',
        'error',
        step.id,
        'Arbitrary private invoke is unavailable without a trusted helper allowlist, code-hash policy, and deterministic calldata encoder.',
      ))
      if (!hasPrivateBalance) {
        stepDiagnostics.push(diagnostic('missing-private-balance', 'error', step.id, 'Shield assets before invoking a private action.'))
      } else if (!noteMature) {
        stepDiagnostics.push(diagnostic('note-not-mature', 'error', step.id, 'Wait for the input note to mature before invoking a contract.'))
      }
      const group = step.transactionGroup ?? step.id
      const invokeCount = (invokeCountByGroup.get(group) ?? 0) + 1
      invokeCountByGroup.set(group, invokeCount)
      if (invokeCount > 1) {
        stepDiagnostics.push(diagnostic('multiple-external-invokes', 'error', step.id, 'A private transaction can contain only one external privacy invoke.'))
      }
      noteMature = false
      hasTransaction = true
    }

    if (step.kind === 'withdraw') {
      if (!hasPrivateBalance) {
        stepDiagnostics.push(diagnostic('missing-private-balance', 'error', step.id, 'There is no private balance to withdraw.'))
      } else if (!noteMature) {
        stepDiagnostics.push(diagnostic('note-not-mature', 'error', step.id, 'Wait for the input note to mature before withdrawing.'))
      }
      hasPrivateBalance = false
      noteMature = false
      hasTransaction = true
    }

    if (step.kind === 'verify' && !hasTransaction) {
      stepDiagnostics.push(diagnostic('nothing-to-verify', 'warning', step.id, 'Add a transaction before receipt verification.'))
    }

    allDiagnostics.push(...stepDiagnostics)
    return {
      ...step,
      title: step.label ?? definition.title,
      summary: definition.summary,
      disclosures: definition.disclosures,
      requiredCapabilities: definition.requiredCapabilities,
      diagnostics: stepDiagnostics,
    }
  })

  const disclosureCounts: Record<Visibility, number> = {
    private: 0,
    public: 0,
    derived: 0,
    'wallet-held': 0,
  }

  for (const step of steps) {
    for (const disclosure of step.disclosures) {
      disclosureCounts[disclosure.visibility] += 1
    }
  }

  return {
    recipe,
    steps,
    diagnostics: allDiagnostics,
    isExecutable: !allDiagnostics.some(({ severity }) => severity === 'error'),
    disclosureCounts,
    requiredCapabilities: [...requiredCapabilities],
  }
}

export const recipes: Recipe[] = [
  {
    id: 'shielded-transfer',
    name: 'Shielded transfer',
    description: 'Enter the pool publicly, transfer privately, and preserve a verified receipt.',
    steps: [
      { id: 'register-recipient', kind: 'register' },
      { id: 'shield-funds', kind: 'shield' },
      { id: 'mature-deposit', kind: 'waitForMaturity' },
      { id: 'send-privately', kind: 'privateTransfer' },
      { id: 'verify-transfer', kind: 'verify' },
    ],
  },
  {
    id: 'private-invoke',
    name: 'Private invoke',
    description: 'Spend a mature note through one public anonymizer without exposing the initiating wallet.',
    steps: [
      { id: 'shield-invoke-funds', kind: 'shield' },
      { id: 'mature-invoke-funds', kind: 'waitForMaturity' },
      { id: 'invoke-helper', kind: 'privateInvoke', transactionGroup: 'invoke-transaction' },
      { id: 'verify-invoke', kind: 'verify' },
    ],
  },
  {
    id: 'private-exit',
    name: 'Private exit',
    description: 'Withdraw a mature note while keeping its private origin unlinkable.',
    steps: [
      { id: 'shield-exit-funds', kind: 'shield' },
      { id: 'mature-exit-funds', kind: 'waitForMaturity' },
      { id: 'withdraw-funds', kind: 'withdraw' },
      { id: 'verify-withdrawal', kind: 'verify' },
    ],
  },
]
