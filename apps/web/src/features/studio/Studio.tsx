import { useMemo, useState } from 'react'
import {
  analyzeRecipe,
  recipes,
  type AnalyzedStep,
  type Capability,
  type StepKind,
  type Visibility,
} from '@lacuna/recipe-engine'
import { LacunaMark } from '../../components/LacunaMark'

const previewCapabilities: Capability[] = [
  'strk20Balances',
  'strk20PrepareInvoke',
  'strk20InvokeTransaction',
]

const visibilityLabel: Record<Visibility, string> = {
  private: 'Private',
  public: 'Public',
  derived: 'Correlatable',
  'wallet-held': 'Wallet-held',
}

const stepIndex: Record<StepKind, string> = {
  register: 'RG',
  shield: 'SH',
  waitForMaturity: 'WT',
  privateTransfer: 'TX',
  privateInvoke: 'IV',
  withdraw: 'WD',
  verify: 'VR',
}

function codePreview(step: AnalyzedStep): string {
  if (step.kind === 'privateTransfer') {
    return `const actions = [
  {
    type: "transfer",
    token,
    amount,
    recipient,
  },
]

const prepared = await account
  .strk20PrepareInvoke(actions, true)

// Sign only after reviewing disclosures.
const receipt = await account
  .strk20InvokeTransaction(actions)`
  }

  if (step.kind === 'privateInvoke') {
    return `const actions = [
  { type: "transfer", token, amount: "OPEN",
    recipient: userAddress },
  { type: "invoke", contract: helperAddress,
    calldata: [token, amount,
      "\${openNoteIds[0]}"] },
]

const prepared = await account
  .strk20PrepareInvoke(actions, true)`
  }

  if (step.kind === 'withdraw') {
    return `// Withdrawal exposes destination and amount.
const actions = [
  {
    type: "transfer",
    token,
    amount,
    recipient: publicDestination,
  },
]

const prepared = await account
  .strk20PrepareInvoke(actions, true)`
  }

  if (step.kind === 'waitForMaturity') {
    return `const balances = await account
  .strk20Balances([token])

// Re-check wallet-owned note state before
// enabling the next private spend.`
  }

  if (step.kind === 'verify') {
    return `// Read the public receipt through Starknet RPC.
// Accept only succeeded transactions that emit
// an event from the verified STRK20 pool.

const evidence = await verifyReceipt({
  transactionHash,
  chainId: "SN_MAIN",
  poolAddress,
})`
  }

  return `// ${step.title} is a public account action.
// Keep signing in the wallet and show every
// public field before requesting confirmation.`
}

type InspectorTab = 'visibility' | 'checks' | 'code'

export function Studio() {
  const [activeRecipeId, setActiveRecipeId] = useState(recipes[0].id)
  const [selectedStepId, setSelectedStepId] = useState(recipes[0].steps[0].id)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('visibility')

  const activeRecipe = recipes.find(({ id }) => id === activeRecipeId) ?? recipes[0]
  const analysis = useMemo(
    () => analyzeRecipe(activeRecipe, { capabilities: previewCapabilities }),
    [activeRecipe],
  )
  const selectedStep = analysis.steps.find(({ id }) => id === selectedStepId) ?? analysis.steps[0]

  function selectRecipe(recipeId: string) {
    const nextRecipe = recipes.find(({ id }) => id === recipeId) ?? recipes[0]
    setActiveRecipeId(nextRecipe.id)
    setSelectedStepId(nextRecipe.steps[0].id)
    setInspectorTab('visibility')
  }

  return (
    <section className="studio-section wrap" id="studio">
      <div className="studio-intro">
        <p className="kicker">02 / THE STUDIO</p>
        <div>
          <h2>Trace the boundary before anything signs.</h2>
          <p>Select an action to inspect its disclosures, protocol checks, wallet requirements, and generated integration shape.</p>
        </div>
      </div>

      <div className="studio-window interactive-studio">
        <div className="studio-topbar">
          <div className="mini-brand"><LacunaMark /><span>{activeRecipe.id}</span></div>
          <div className="network"><i /> SN_MAIN · PROTOCOL PREVIEW</div>
          <button className="preview-status" type="button" disabled>Wallet not connected</button>
        </div>

        <div className="studio-body interactive-body">
          <aside className="recipe-rail">
            <span className="panel-label">PRIVACY RECIPES</span>
            <div className="studio-recipe-list">
              {recipes.map((recipe, index) => (
                <button
                  className={recipe.id === activeRecipe.id ? 'active' : undefined}
                  key={recipe.id}
                  onClick={() => selectRecipe(recipe.id)}
                  type="button"
                >
                  <i />
                  <span><b>0{index + 1}</b>{recipe.name}</span>
                </button>
              ))}
            </div>
            <div className="recipe-health">
              <span className={analysis.isExecutable ? 'health-dot ready' : 'health-dot'} />
              <div><b>{analysis.isExecutable ? 'Recipe valid' : 'Action required'}</b><small>{analysis.steps.length} protocol stages</small></div>
            </div>
          </aside>

          <div className="recipe-canvas" aria-label={`${activeRecipe.name} action graph`}>
            <div className="graph-grid" />
            <div className="canvas-caption">
              <span>{activeRecipe.name}</span>
              <p>{activeRecipe.description}</p>
            </div>
            <div className="flow-track">
              {analysis.steps.map((step, index) => (
                <div className="flow-stage" key={step.id}>
                  <button
                    className={`recipe-node ${step.id === selectedStep.id ? 'selected' : ''}`}
                    onClick={() => setSelectedStepId(step.id)}
                    type="button"
                  >
                    <span>{stepIndex[step.kind]}</span>
                    <small>0{index + 1} / {step.kind.replace(/([A-Z])/g, ' $1').toUpperCase()}</small>
                    <strong>{step.title}</strong>
                    <em>{step.disclosures.filter(({ visibility }) => visibility === 'public').length} public fields</em>
                  </button>
                  {index < analysis.steps.length - 1 && <div className="node-connector"><i /></div>}
                </div>
              ))}
            </div>
            <div className="canvas-legend">
              <span><i className="private-dot" /> protected</span>
              <span><i className="public-dot" /> public edge</span>
              <span><i className="derived-dot" /> correlatable</span>
            </div>
          </div>

          <aside className="inspector" id="boundary">
            <div className="inspector-heading">
              <span className="panel-label">ACTION INSPECTOR</span>
              <span className="step-code">{stepIndex[selectedStep.kind]}</span>
            </div>
            <h3>{selectedStep.title}</h3>
            <p>{selectedStep.summary}</p>

            <div className="inspector-tabs" role="tablist" aria-label="Action details">
              {(['visibility', 'checks', 'code'] as const).map((tab) => (
                <button
                  aria-selected={inspectorTab === tab}
                  className={inspectorTab === tab ? 'active' : undefined}
                  key={tab}
                  onClick={() => setInspectorTab(tab)}
                  role="tab"
                  type="button"
                >{tab}</button>
              ))}
            </div>

            {inspectorTab === 'visibility' && (
              <div className="disclosure-list detailed">
                {selectedStep.disclosures.map((item) => (
                  <div className="disclosure-row" key={`${item.subject}-${item.visibility}`}>
                    <span>{item.subject}<small>{item.explanation}</small></span>
                    <strong className={item.visibility}>{visibilityLabel[item.visibility]}</strong>
                  </div>
                ))}
              </div>
            )}

            {inspectorTab === 'checks' && (
              <div className="check-list">
                {selectedStep.requiredCapabilities.length > 0 ? selectedStep.requiredCapabilities.map((capability) => (
                  <div key={capability}><i className="check-pass" /><span>{capability}<small>Required wallet method</small></span></div>
                )) : <div><i className="check-pass" /><span>Standard wallet action<small>No STRK20 extension method required</small></span></div>}
                {selectedStep.diagnostics.length === 0 ? (
                  <div><i className="check-pass" /><span>Protocol constraints passed<small>No blocking issue in this recipe</small></span></div>
                ) : selectedStep.diagnostics.map((item) => (
                  <div key={item.code}><i className="check-fail" /><span>{item.message}<small>{item.code}</small></span></div>
                ))}
              </div>
            )}

            {inspectorTab === 'code' && (
              <pre className="code-preview"><code>{codePreview(selectedStep)}</code></pre>
            )}
          </aside>
        </div>

        <div className="studio-footerbar">
          <div className="disclosure-counts">
            <span><i className="private-dot" /> {analysis.disclosureCounts.private} private</span>
            <span><i className="public-dot" /> {analysis.disclosureCounts.public} public</span>
            <span><i className="derived-dot" /> {analysis.disclosureCounts.derived} correlatable</span>
          </div>
          <div className="execution-gate"><i /> Preview only · wallet execution remains disabled</div>
        </div>
      </div>
    </section>
  )
}
