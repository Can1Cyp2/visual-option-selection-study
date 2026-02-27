import type { BlockPlan, Condition, StimulusItem, TrialPlan } from './types'

export const CONDITIONS: Condition[] = ['color', 'shape', 'combined']

export const LATIN_SQUARE_3: Condition[][] = [
  ['color', 'shape', 'combined'],
  ['shape', 'combined', 'color'],
  ['combined', 'color', 'shape'],
]

export const COLORS = [
  { name: 'red', hex: '#d62828' },
  { name: 'blue', hex: '#1d4ed8' },
  { name: 'green', hex: '#2f9e44' },
  { name: 'orange', hex: '#f97316' },
  { name: 'purple', hex: '#7c3aed' },
  { name: 'yellow', hex: '#eab308' },
  { name: 'cyan', hex: '#0891b2' },
  { name: 'magenta', hex: '#db2777' },
] as const

export const SHAPES = [
  { name: 'circle', symbol: '●' },
  { name: 'triangle', symbol: '▲' },
  { name: 'square', symbol: '■' },
  { name: 'diamond', symbol: '◆' },
  { name: 'star', symbol: '★' },
  { name: 'pentagon', symbol: '⬟' },
  { name: 'hexagon', symbol: '⬢' },
  { name: 'cross', symbol: '✚' },
] as const

export const DEFAULT_PRACTICE_TRIALS = 3
export const DEFAULT_MEASURED_TRIALS = 10

export function getLatinSquareOrder(participantNumber: number): Condition[] {
  return LATIN_SQUARE_3[participantNumber % 3]
}

export function seededRandom(seed: number): () => number {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

export function shuffle<T>(array: T[], rand: () => number): T[] {
  const next = [...array]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function buildBalancedIndices(length: number, count: number, rand: () => number): number[] {
  if (count <= 0 || length <= 0) return []

  const baseRepeats = Math.floor(count / length)
  const remainder = count % length

  const indices: number[] = []
  for (let i = 0; i < length; i += 1) {
    for (let j = 0; j < baseRepeats; j += 1) {
      indices.push(i)
    }
  }

  if (remainder > 0) {
    const extraIndices = shuffle(Array.from({ length }, (_, i) => i), rand).slice(0, remainder)
    indices.push(...extraIndices)
  }

  return shuffle(indices, rand)
}

function buildItemsForColorOnlyTrial(trialSeed: number): StimulusItem[] {
  const rand = seededRandom(trialSeed)
  const order = shuffle(Array.from({ length: COLORS.length }, (_, i) => i), rand)
  return order.map((colorIndex, index) => ({
    id: `item_${index + 1}`,
    colorName: COLORS[colorIndex].name,
    colorHex: COLORS[colorIndex].hex,
    shapeName: 'circle',
    shapeSymbol: '●',
  }))
}

function buildItemsForShapeOnlyTrial(trialSeed: number): StimulusItem[] {
  const rand = seededRandom(trialSeed)
  const order = shuffle(Array.from({ length: SHAPES.length }, (_, i) => i), rand)
  return order.map((shapeIndex, index) => ({
    id: `item_${index + 1}`,
    colorName: 'black',
    colorHex: '#111111',
    shapeName: SHAPES[shapeIndex].name,
    shapeSymbol: SHAPES[shapeIndex].symbol,
  }))
}

function buildCombinedItemsForTarget(trialSeed: number, targetColor: string, targetShape: string): StimulusItem[] {
  const rand = seededRandom(trialSeed)
  const remainingColors = shuffle(
    COLORS.filter((color) => color.name !== targetColor),
    rand,
  )
  const remainingShapes = shuffle(
    SHAPES.filter((shape) => shape.name !== targetShape),
    rand,
  )

  const pairs: Array<{ colorName: string; colorHex: string; shapeName: string; shapeSymbol: string }> = [
    {
      colorName: targetColor,
      colorHex: COLORS.find((color) => color.name === targetColor)?.hex ?? '#000000',
      shapeName: targetShape,
      shapeSymbol: SHAPES.find((shape) => shape.name === targetShape)?.symbol ?? '■',
    },
  ]

  for (let i = 0; i < 7; i += 1) {
    pairs.push({
      colorName: remainingColors[i].name,
      colorHex: remainingColors[i].hex,
      shapeName: remainingShapes[i].name,
      shapeSymbol: remainingShapes[i].symbol,
    })
  }

  const orderedPairs = shuffle(pairs, rand)
  return orderedPairs.map((pair, index) => ({
    id: `item_${index + 1}`,
    colorName: pair.colorName,
    colorHex: pair.colorHex,
    shapeName: pair.shapeName,
    shapeSymbol: pair.shapeSymbol,
  }))
}

function findItemForTarget(items: StimulusItem[], targetColor: string, targetShape: string, condition: Condition): StimulusItem {
  if (condition === 'color') {
    const byColor = items.find((item) => item.colorName === targetColor)
    if (!byColor) throw new Error('No matching color target found')
    return byColor
  }
  if (condition === 'shape') {
    const byShape = items.find((item) => item.shapeName === targetShape)
    if (!byShape) throw new Error('No matching shape target found')
    return byShape
  }
  const byBoth = items.find((item) => item.colorName === targetColor && item.shapeName === targetShape)
  if (!byBoth) throw new Error('No matching combined target found')
  return byBoth
}

export function generateBlockPlan(args: {
  participantNumber: number
  blockIndex: number
  blockOrder: number
  condition: Condition
  practiceTrials?: number
  measuredTrials?: number
}): BlockPlan {
  const practiceTrials = args.practiceTrials ?? DEFAULT_PRACTICE_TRIALS
  const measuredTrials = args.measuredTrials ?? DEFAULT_MEASURED_TRIALS
  const totalTrials = practiceTrials + measuredTrials
  const rand = seededRandom(args.participantNumber * 1000 + args.blockIndex * 77 + args.blockOrder * 19)

  const practiceColorIndices = buildBalancedIndices(COLORS.length, practiceTrials, rand)
  const practiceShapeIndices = buildBalancedIndices(SHAPES.length, practiceTrials, rand)
  const measuredColorIndices = buildBalancedIndices(COLORS.length, measuredTrials, rand)
  const measuredShapeIndices = buildBalancedIndices(SHAPES.length, measuredTrials, rand)

  const balancedColorIndices = [...practiceColorIndices, ...measuredColorIndices]
  const balancedShapeIndices = [...practiceShapeIndices, ...measuredShapeIndices]

  const trials: TrialPlan[] = []
  for (let t = 0; t < totalTrials; t += 1) {
    const trialSeed = args.participantNumber * 100000 + args.blockIndex * 1000 + t + 1
    const targetColor =
      args.condition === 'shape' ? 'black' : COLORS[balancedColorIndices[t]].name
    const targetShape =
      args.condition === 'color' ? 'circle' : SHAPES[balancedShapeIndices[t]].name

    const items =
      args.condition === 'color'
        ? buildItemsForColorOnlyTrial(trialSeed)
        : args.condition === 'shape'
          ? buildItemsForShapeOnlyTrial(trialSeed)
          : buildCombinedItemsForTarget(trialSeed, targetColor, targetShape)

    const correctItem = findItemForTarget(items, targetColor, targetShape, args.condition)

    const promptText =
      args.condition === 'color'
        ? `Select the ${targetColor} circle`
        : args.condition === 'shape'
          ? `Select the ${targetShape}`
          : `Select the ${targetColor} ${targetShape}`

    trials.push({
      id: `b${args.blockIndex}_t${t + 1}`,
      blockIndex: args.blockIndex,
      blockOrder: args.blockOrder,
      condition: args.condition,
      trialIndexInBlock: t + 1,
      isPractice: t < practiceTrials,
      targetType: args.condition,
      targetColor,
      targetShape,
      promptText,
      correctItemId: correctItem.id,
      items,
    })
  }

  const practice = trials.filter((trial) => trial.isPractice)
  const measured = trials.filter((trial) => !trial.isPractice)

  return {
    blockIndex: args.blockIndex,
    blockOrder: args.blockOrder,
    condition: args.condition,
    practiceTrials: practice.length,
    measuredTrials: measured.length,
    trials,
  }
}

export function generateAllBlocks(participantNumber: number): BlockPlan[] {
  const assignedOrder = getLatinSquareOrder(participantNumber)
  return assignedOrder.map((condition, index) =>
    generateBlockPlan({
      participantNumber,
      blockIndex: index,
      blockOrder: index + 1,
      condition,
      practiceTrials: DEFAULT_PRACTICE_TRIALS,
      measuredTrials: DEFAULT_MEASURED_TRIALS,
    }),
  )
}

export function orderToLabel(order: Condition[]): string {
  return order
    .map((condition) => {
      if (condition === 'color') return 'A'
      if (condition === 'shape') return 'B'
      return 'C'
    })
    .join('')
}

export function createParticipantNumber(): number {
  return Math.floor(Math.random() * 900000) + 100000
}

export function readableCondition(condition: Condition): string {
  if (condition === 'color') return 'A: Colour-Coded'
  if (condition === 'shape') return 'B: Shape-Coded'
  return 'C: Colour + Shape'
}

export function conditionInstructions(condition: Condition): string {
  if (condition === 'color') {
    return 'In this block, identify the target by COLOUR only. All options are circles.'
  }
  if (condition === 'shape') {
    return 'In this block, identify the target by SHAPE only. All options are black.'
  }
  return 'In this block, identify the target using BOTH colour and shape together.'
}

export function assertBalancedTargets(trials: TrialPlan[]): { maxColorDiff: number; maxShapeDiff: number } {
  const measured = trials.filter((trial) => !trial.isPractice)
  const colorCounts = new Map<string, number>()
  const shapeCounts = new Map<string, number>()

  for (const trial of measured) {
    colorCounts.set(trial.targetColor, (colorCounts.get(trial.targetColor) ?? 0) + 1)
    shapeCounts.set(trial.targetShape, (shapeCounts.get(trial.targetShape) ?? 0) + 1)
  }

  const colorValues = Array.from(colorCounts.values())
  const shapeValues = Array.from(shapeCounts.values())

  const maxColorDiff = Math.max(...colorValues) - Math.min(...colorValues)
  const maxShapeDiff = Math.max(...shapeValues) - Math.min(...shapeValues)

  return { maxColorDiff, maxShapeDiff }
}
