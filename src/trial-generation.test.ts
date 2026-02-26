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
      measuredTrials: 16,
    })

    expect(plan.trials).toHaveLength(19)
    expect(plan.trials.filter((trial) => trial.isPractice)).toHaveLength(3)
    expect(plan.trials.filter((trial) => !trial.isPractice)).toHaveLength(16)
  })

  test('keeps target color and shape distribution exactly balanced in measured combined trials', () => {
    const plan = generateBlockPlan({
      participantNumber: 654321,
      blockIndex: 1,
      blockOrder: 2,
      condition: 'combined',
      practiceTrials: 3,
      measuredTrials: 16,
    })

    const balance = assertBalancedTargets(plan.trials)
    expect(balance.maxColorDiff).toBe(0)
    expect(balance.maxShapeDiff).toBe(0)
  })

  test('keeps each colour equally frequent in measured color-only trials', () => {
    const plan = generateBlockPlan({
      participantNumber: 818181,
      blockIndex: 0,
      blockOrder: 1,
      condition: 'color',
      practiceTrials: 3,
      measuredTrials: 16,
    })

    const measured = plan.trials.filter((trial) => !trial.isPractice)
    const colorCounts = new Map<string, number>()
    for (const trial of measured) {
      colorCounts.set(trial.targetColor, (colorCounts.get(trial.targetColor) ?? 0) + 1)
    }
    expect(new Set(Array.from(colorCounts.values()))).toEqual(new Set([2]))
  })

  test('keeps each shape equally frequent in measured shape-only trials', () => {
    const plan = generateBlockPlan({
      participantNumber: 919191,
      blockIndex: 0,
      blockOrder: 1,
      condition: 'shape',
      practiceTrials: 3,
      measuredTrials: 16,
    })

    const measured = plan.trials.filter((trial) => !trial.isPractice)
    const shapeCounts = new Map<string, number>()
    for (const trial of measured) {
      shapeCounts.set(trial.targetShape, (shapeCounts.get(trial.targetShape) ?? 0) + 1)
    }
    expect(new Set(Array.from(shapeCounts.values()))).toEqual(new Set([2]))
  })

  test('all trials include exactly 8 selectable items', () => {
    const plan = generateBlockPlan({
      participantNumber: 111111,
      blockIndex: 2,
      blockOrder: 3,
      condition: 'shape',
      practiceTrials: 3,
      measuredTrials: 16,
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
        measuredTrials: 16,
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
})
