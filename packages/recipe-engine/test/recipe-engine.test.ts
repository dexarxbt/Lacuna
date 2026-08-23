import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeRecipe, recipes, type Recipe } from '../src/index.ts'

const allCapabilities = [
  'strk20Balances',
  'strk20PrepareInvoke',
  'strk20InvokeTransaction',
] as const

test('the shielded transfer recipe is executable with a capable wallet', () => {
  const result = analyzeRecipe(recipes[0], { capabilities: [...allCapabilities] })

  assert.equal(result.isExecutable, true)
  assert.equal(result.diagnostics.length, 0)
  assert.ok(result.disclosureCounts.public > 0)
  assert.ok(result.disclosureCounts.private > 0)
})

test('private spending is blocked until its note matures', () => {
  const recipe: Recipe = {
    id: 'immature-transfer',
    name: 'Immature transfer',
    description: 'Invalid by design.',
    steps: [
      { id: 'register', kind: 'register' },
      { id: 'shield', kind: 'shield' },
      { id: 'transfer', kind: 'privateTransfer' },
    ],
  }

  const result = analyzeRecipe(recipe, { capabilities: [...allCapabilities] })

  assert.equal(result.isExecutable, false)
  assert.ok(result.diagnostics.some(({ code }) => code === 'note-not-mature'))
})

test('a transaction group cannot contain two external invokes', () => {
  const recipe: Recipe = {
    id: 'double-invoke',
    name: 'Double invoke',
    description: 'Invalid by design.',
    steps: [
      { id: 'shield', kind: 'shield' },
      { id: 'mature', kind: 'waitForMaturity' },
      { id: 'first', kind: 'privateInvoke', transactionGroup: 'same-transaction' },
      { id: 'mature-output', kind: 'waitForMaturity' },
      { id: 'second', kind: 'privateInvoke', transactionGroup: 'same-transaction' },
    ],
  }

  const result = analyzeRecipe(recipe, { capabilities: [...allCapabilities] })

  assert.equal(result.isExecutable, false)
  assert.ok(result.diagnostics.some(({ code }) => code === 'multiple-external-invokes'))
})

test('missing wallet methods produce actionable errors', () => {
  const result = analyzeRecipe(recipes[0], { capabilities: [] })

  assert.equal(result.isExecutable, false)
  assert.ok(result.diagnostics.some(({ message }) => message.includes('strk20PrepareInvoke')))
  assert.ok(result.diagnostics.some(({ message }) => message.includes('strk20InvokeTransaction')))
})
