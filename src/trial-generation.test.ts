import { describe, expect, test } from 'vitest'
import { assertBalancedTargets, generateBlockPlan } from './experiment'

describe('Trial generation', () => {
  test('creates expected number of trials and flags practice correctly', () => {
    const plan = generateBlockPlan({
      participantNumber: 123456,
      blockIndex: 0,
      blockOrder: 1,
      condition: 'combined',
      practiceTrials: 3,
      measuredTrials: 10,
    })

    expect(plan.trials).toHaveLength(13)
    expect(plan.trials.filter((trial) => trial.isPractice)).toHaveLength(3)
    expect(plan.trials.filter((trial) => !trial.isPractice)).toHaveLength(10)
  })

  test('keeps target color and shape distribution near-even in measured combined trials', () => {
    const plan = generateBlockPlan({
      participantNumber: 654321,
      blockIndex: 1,
      blockOrder: 2,
      condition: 'combined',
      practiceTrials: 3,
      measuredTrials: 10,
    })

    const balance = assertBalancedTargets(plan.trials)
    expect(balance.maxColorDiff).toBeLessThanOrEqual(1)
    expect(balance.maxShapeDiff).toBeLessThanOrEqual(1)
  })

  test('keeps each colour near-even in measured color-only trials', () => {
    const plan = generateBlockPlan({
      participantNumber: 818181,
      blockIndex: 0,
      blockOrder: 1,
      condition: 'color',
      practiceTrials: 3,
      measuredTrials: 10,
    })

    const measured = plan.trials.filter((trial) => !trial.isPractice)
    const colorCounts = new Map<string, number>()
    for (const trial of measured) {
      colorCounts.set(trial.targetColor, (colorCounts.get(trial.targetColor) ?? 0) + 1)
    }
    const values = Array.from(colorCounts.values())
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
  })

  test('keeps each shape near-even in measured shape-only trials', () => {
    const plan = generateBlockPlan({
      participantNumber: 919191,
      blockIndex: 0,
      blockOrder: 1,
      condition: 'shape',
      practiceTrials: 3,
      measuredTrials: 10,
    })

    const measured = plan.trials.filter((trial) => !trial.isPractice)
    const shapeCounts = new Map<string, number>()
    for (const trial of measured) {
      shapeCounts.set(trial.targetShape, (shapeCounts.get(trial.targetShape) ?? 0) + 1)
    }
    const values = Array.from(shapeCounts.values())
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
  })

  test('all trials include exactly 8 selectable items', () => {
    const plan = generateBlockPlan({
      participantNumber: 111111,
      blockIndex: 2,
      blockOrder: 3,
      condition: 'shape',
      practiceTrials: 3,
      measuredTrials: 10,
    })

    for (const trial of plan.trials) {
      expect(trial.items).toHaveLength(8)
      const ids = new Set(trial.items.map((item) => item.id))
      expect(ids.size).toBe(8)
    }
  })

  test('prompt targets always exist in rendered items for all conditions', () => {
    const conditions = ['color', 'shape', 'combined'] as const

    for (const condition of conditions) {
      const plan = generateBlockPlan({
        participantNumber: 222222,
        blockIndex: 0,
        blockOrder: 1,
        condition,
        practiceTrials: 3,
        measuredTrials: 10,
      })

      for (const trial of plan.trials) {
        const exists = trial.items.some(
          (item) =>
            item.id === trial.correctItemId &&
            (condition !== 'color' || item.colorName === trial.targetColor) &&
            (condition !== 'shape' || item.shapeName === trial.targetShape) &&
            (condition !== 'combined' || (item.colorName === trial.targetColor && item.shapeName === trial.targetShape)),
        )

        expect(exists).toBe(true)
      }
    }
  })

  test('near-even extras are not systematically fixed to the same categories', () => {
    const doubledColorTargets = new Set<string>()

    for (let participant = 300000; participant < 300200; participant += 1) {
      const plan = generateBlockPlan({
        participantNumber: participant,
        blockIndex: 0,
        blockOrder: 1,
        condition: 'color',
        practiceTrials: 3,
        measuredTrials: 10,
      })

      const measured = plan.trials.filter((trial) => !trial.isPractice)
      const counts = new Map<string, number>()
      for (const trial of measured) {
        counts.set(trial.targetColor, (counts.get(trial.targetColor) ?? 0) + 1)
      }

      for (const [target, count] of counts.entries()) {
        if (count === 2) {
          doubledColorTargets.add(target)
        }
      }
    }

    expect(doubledColorTargets.size).toBeGreaterThan(2)
  })
})
