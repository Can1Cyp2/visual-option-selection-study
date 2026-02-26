import { describe, expect, test } from 'vitest'
import { LATIN_SQUARE_3, getLatinSquareOrder, orderToLabel } from './experiment'

describe('Latin square counterbalancing', () => {
  test('uses standard 3-condition latin square orders ABC, BCA, CAB', () => {
    expect(LATIN_SQUARE_3.map((order) => orderToLabel(order))).toEqual(['ABC', 'BCA', 'CAB'])
  })

  test('assigns one of the three orders by participant number mod 3', () => {
    expect(orderToLabel(getLatinSquareOrder(0))).toBe('ABC')
    expect(orderToLabel(getLatinSquareOrder(1))).toBe('BCA')
    expect(orderToLabel(getLatinSquareOrder(2))).toBe('CAB')
    expect(orderToLabel(getLatinSquareOrder(3))).toBe('ABC')
  })

  test('distributes orders evenly over large sequential IDs', () => {
    const counts = new Map<string, number>()
    for (let i = 100000; i < 100300; i += 1) {
      const label = orderToLabel(getLatinSquareOrder(i))
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }

    expect(counts.get('ABC')).toBe(100)
    expect(counts.get('BCA')).toBe(100)
    expect(counts.get('CAB')).toBe(100)
  })
})
