import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { resolveOverlaps } from '../services/layoutFix'

const mk = (o: any): any => ({ visible: true, locked: false, opacity: 1, rotation: 0, ...o })
const dev = { w: 360, h: 800 }

describe('resolveOverlaps', () => {
  it('pushes content down when a text is taller than the model assumed, and grows the card', () => {
    const els = [
      mk({ id: 'sub', type: 'text', x: 24, y: 300, w: 312, h: 63, fontSize: 14, lineHeight: 1.5 }),
      mk({ id: 'chip', type: 'rect', x: 70, y: 340, w: 220, h: 36 }),
      mk({ id: 'card', type: 'rect', x: 16, y: 290, w: 328, h: 150 }),
      mk({ id: 'composer', type: 'rect', x: 16, y: 690, w: 328, h: 100 }),
    ]
    resolveOverlaps(els, dev)
    const by = (id: string) => els.find((e) => e.id === id)!
    expect(by('chip').y).toBeGreaterThanOrEqual(by('sub').y + by('sub').h)
    expect(by('card').h).toBeGreaterThan(150)
    expect(by('composer').y).toBe(690)
  })

  it('does not treat two texts on the same row as a collision', () => {
    const els = [
      mk({ id: 'label', type: 'text', x: 16, y: 100, w: 300, h: 18, fontSize: 14, lineHeight: 1.25 }),
      mk({ id: 'value', type: 'text', x: 100, y: 101, w: 244, h: 18, fontSize: 14, lineHeight: 1.25 }),
      mk({ id: 'next', type: 'text', x: 16, y: 140, w: 300, h: 18, fontSize: 14, lineHeight: 1.25 }),
    ]
    resolveOverlaps(els, dev)
    expect(els.map((e) => e.y)).toEqual([100, 101, 140])
  })
})
