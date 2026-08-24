import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  analyzeRecipe,
  recipes,
  type AnalyzedStep,
  type Capability,
  type StepKind,
  type Visibility,
} from '@lacuna/recipe-engine'
import { LacunaMark } from '../../components/LacunaMark'
import { WalletDoctor } from '../wallet-doctor/WalletDoctor'

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

const productCheckpoints = [
  { name: 'Recipe', status: 'IMPLEMENTED', tone: 'ready' },
  { name: 'Inspect', status: 'IMPLEMENTED', tone: 'ready' },
  { name: 'Validate', status: 'TESTED', tone: 'ready' },
  { name: 'Probe', status: 'READ-ONLY', tone: 'readonly' },
  { name: 'Simulate', status: 'GATED', tone: 'gated' },
  { name: 'Review', status: 'LOCKED', tone: 'locked' },
  { name: 'Verify', status: 'EVIDENCE COMMITTED', tone: 'ready' },
] as const

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
const inspectorTabs: InspectorTab[] = ['visibility', 'checks', 'code']

export function Studio() {
  const [activeRecipeId, setActiveRecipeId] = useState(recipes[0].id)
  const [selectedStepId, setSelectedStepId] = useState(recipes[0].steps[0].id)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('visibility')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

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

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % inspectorTabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + inspectorTabs.length) % inspectorTabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = inspectorTabs.length - 1
    else return

    event.preventDefault()
    setInspectorTab(inspectorTabs[nextIndex])
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <section className="studio-section wrap" id="studio" aria-labelledby="workbench-title">
      <header className="studio-intro">
        <div>
          <p className="kicker">02 / THE STUDIO</p>
          <span className="studio-intro-status"><i /> INSPECTION SURFACE</span>
        </div>
        <div>
          <h2 id="workbench-title">Trace the boundary before anything signs</h2>
          <p>Select a recipe stage to inspect its disclosures, protocol constraints, wallet requirements, and conceptual integration path.</p>
        </div>
      </header>

      <div className="checkpoint-shell" aria-labelledby="checkpoint-title">
        <div className="checkpoint-heading">
          <span className="panel-label" id="checkpoint-title">PRODUCT CHECKPOINTS</span>
          <small>Build status · not transaction progress</small>
        </div>
        <ol className="studio-checkpoints">
          {productCheckpoints.map((checkpoint, index) => (
            <li className={`checkpoint-${checkpoint.tone}`} key={checkpoint.name}>
              <span className="checkpoint-index">{String(index + 1).padStart(2, '0')}</span>
              <div><b>{checkpoint.name}</b><small>{checkpoint.status}</small></div>
            </li>
          ))}
        </ol>
      </div>

      <div className="studio-window interactive-studio">
        <div className="studio-topbar">
          <div className="mini-brand"><LacunaMark /><span>LACUNA / {activeRecipe.id}</span></div>
          <div className="studio-topbar-signals" aria-label="Workbench mode">
            <span><i className="signal-mainnet" /> SN_MAIN</span>
            <span><i className="signal-preview" /> PREVIEW MODEL</span>
          </div>
          <WalletDoctor />
        </div>

        <div className="studio-body interactive-body">
          <aside className="recipe-rail" aria-labelledby="recipe-library-title">
            <div className="rail-heading">
              <span className="panel-label" id="recipe-library-title">PRIVACY RECIPES</span>
              <small>{recipes.length} models</small>
            </div>
            <div className="studio-recipe-list">
              {recipes.map((recipe, index) => {
                const isActive = recipe.id === activeRecipe.id
                return (
                  <button
                    aria-pressed={isActive}
                    className={isActive ? 'active' : undefined}
                    key={recipe.id}
                    onClick={() => selectRecipe(recipe.id)}
                    type="button"
                  >
                    <span className="recipe-selector-mark" aria-hidden="true"><i /></span>
                    <span className="recipe-selector-copy">
                      <b>{String(index + 1).padStart(2, '0')} / {recipe.steps.length} STAGES</b>
                      <strong>{recipe.name}</strong>
                    </span>
                    <span aria-hidden="true" className="recipe-selector-arrow">→</span>
                  </button>
                )
              })}
            </div>
            <div className="recipe-health">
              <span className={analysis.isExecutable ? 'health-dot ready' : 'health-dot'} />
              <div>
                <b>{analysis.isExecutable ? 'Preview checks clear' : 'Recipe needs attention'}</b>
                <small>Runtime wallet state is checked separately</small>
              </div>
            </div>
          </aside>

          <section className="recipe-canvas" aria-labelledby="recipe-canvas-title">
            <div className="graph-grid" aria-hidden="true" />
            <div aria-hidden="true" className="canvas-depth-art">
              <span className="depth-ring depth-ring-one" />
              <span className="depth-ring depth-ring-two" />
              <span className="depth-beacon"><i /></span>
              <b>PRIVATE EXECUTION LAYER</b>
            </div>
            <header className="canvas-caption">
              <div>
                <span className="canvas-kicker">ACTIVE RECIPE</span>
                <h3 id="recipe-canvas-title">{activeRecipe.name}</h3>
              </div>
              <span className="canvas-stage-count">{analysis.steps.length} STAGES</span>
              <p>{activeRecipe.description}</p>
            </header>

            <div className="canvas-boundary-labels" aria-hidden="true">
              <span>PUBLIC INPUT</span><span>PRIVATE PATH</span><span>EVIDENCE EDGE</span>
            </div>

            <ol className="flow-track" aria-label={`${activeRecipe.name} recipe stages`}>
              {analysis.steps.map((step, index) => {
                const isSelected = step.id === selectedStep.id
                const publicCount = step.disclosures.filter(({ visibility }) => visibility === 'public').length
                return (
                  <li className="flow-stage" key={step.id}>
                    <button
                      aria-describedby={isSelected ? 'selected-step-summary' : undefined}
                      aria-pressed={isSelected}
                      className={`recipe-node ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedStepId(step.id)}
                      type="button"
                    >
                      <span className="node-code">{stepIndex[step.kind]}</span>
                      <small>{String(index + 1).padStart(2, '0')} / {step.kind.replace(/([A-Z])/g, ' $1').toUpperCase()}</small>
                      <strong>{step.title}</strong>
                      <em>{publicCount} public {publicCount === 1 ? 'field' : 'fields'}</em>
                      <i className="node-status" aria-hidden="true" />
                    </button>
                    {index < analysis.steps.length - 1 && <div className="node-connector" aria-hidden="true"><i /></div>}
                  </li>
                )
              })}
            </ol>

            <p className="selected-step-announcement" id="selected-step-summary" aria-live="polite">
              Selected stage: {selectedStep.title}. {selectedStep.summary}
            </p>

            <div className="canvas-legend" aria-label="Disclosure legend">
              <span><i className="private-dot" /> protected</span>
              <span><i className="public-dot" /> public edge</span>
              <span><i className="derived-dot" /> correlatable</span>
              <span><i className="wallet-dot" /> wallet-held</span>
            </div>
          </section>

          <aside className="inspector" id="boundary" aria-labelledby="inspector-title">
            <div className="inspector-heading">
              <span className="panel-label">BOUNDARY INSPECTOR</span>
              <span className="step-code">{stepIndex[selectedStep.kind]}</span>
            </div>
            <h3 id="inspector-title">{selectedStep.title}</h3>
            <p>{selectedStep.summary}</p>

            <div className="inspector-tabs" role="tablist" aria-label="Selected stage details">
              {inspectorTabs.map((tab, index) => (
                <button
                  aria-controls="inspector-panel"
                  aria-selected={inspectorTab === tab}
                  className={inspectorTab === tab ? 'active' : undefined}
                  id={`inspector-tab-${tab}`}
                  key={tab}
                  onClick={() => setInspectorTab(tab)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  ref={(element) => { tabRefs.current[index] = element }}
                  role="tab"
                  tabIndex={inspectorTab === tab ? 0 : -1}
                  type="button"
                >{tab === 'visibility' ? 'Boundary' : tab === 'checks' ? 'Checks' : 'Integration'}</button>
              ))}
            </div>

            <div
              aria-labelledby={`inspector-tab-${inspectorTab}`}
              className="inspector-panel"
              id="inspector-panel"
              role="tabpanel"
              tabIndex={0}
            >
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
                    <div key={capability}><i className="check-requirement" /><span>{capability}<small>Required wallet method · runtime status not assumed</small></span></div>
                  )) : <div><i className="check-pass" /><span>Standard wallet action<small>No STRK20 extension method required</small></span></div>}
                  {selectedStep.diagnostics.length === 0 ? (
                    <div><i className="check-pass" /><span>Preview constraints clear<small>No blocking issue in the recipe model</small></span></div>
                  ) : selectedStep.diagnostics.map((item) => (
                    <div key={item.code}><i className="check-fail" /><span>{item.message}<small>{item.code}</small></span></div>
                  ))}
                </div>
              )}

              {inspectorTab === 'code' && (
                <div className="integration-preview">
                  <div><span>CONCEPTUAL PSEUDOCODE</span><strong>NOT EXECUTABLE</strong></div>
                  <pre className="code-preview"><code>{codePreview(selectedStep)}</code></pre>
                </div>
              )}
            </div>
          </aside>
        </div>

        <footer className="studio-action-dock" aria-label="Workbench status and actions">
          <div className="disclosure-counts" aria-label="Recipe disclosure counts">
            <span><i className="private-dot" /> {analysis.disclosureCounts.private} private</span>
            <span><i className="public-dot" /> {analysis.disclosureCounts.public} public</span>
            <span><i className="derived-dot" /> {analysis.disclosureCounts.derived} correlatable</span>
            <span><i className="wallet-dot" /> {analysis.disclosureCounts['wallet-held']} wallet-held</span>
          </div>
          <div className="dock-gate-copy">
            <span><i /> EXECUTION LOCKED</span>
            <small>Real inputs, simulation, review, and consent are not exposed in this build</small>
          </div>
          <button className="dock-action" disabled type="button"><span aria-hidden="true">◇</span> Simulation gated</button>
        </footer>
      </div>
    </section>
  )
}
