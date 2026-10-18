import { beforeEach, describe, expect, it } from 'vitest'
import { newDoc } from '../engine/doc'
import { useEditor } from '../state/editor'

const s = () => useEditor.getState()
const els = () => s().doc!.artboards[0].els

beforeEach(() => s().open(newDoc('T', 360, 800)))

describe('editor store', () => {
  it('adds, selects, undoes and redoes', () => {
    const id = s().addEl('rect')!
    expect(els()).toHaveLength(1)
    expect(s().sel.elIds).toEqual([id])
    s().undo()
    expect(els()).toHaveLength(0)
    expect(s().sel.elIds).toEqual([])
    s().redo()
    expect(els()).toHaveLength(1)
  })

  it('coalesces rapid edits with the same key into one undo step', () => {
    const id = s().addEl('rect')!
    const ab = s().doc!.artboards[0].id
    for (const v of [1, 2, 3, 4]) s().patchEl(ab, id, { x: v }, 'x')
    expect(els()[0].x).toBe(4)
    s().undo()
    expect(els()).toHaveLength(1) // only the x edits were undone
    expect(els()[0].x).not.toBe(4)
  })

  it('keeps stacking order correct when reordering', () => {
    const a = s().addEl('rect')!
    const b = s().addEl('ellipse')!
    const c = s().addEl('text')!
    s().select(s().sel.abId, [a])
    s().reorder('front')
    expect(els().map((e) => e.id)).toEqual([b, c, a])
    s().reorder('down')
    expect(els().map((e) => e.id)).toEqual([b, a, c])
    s().select(s().sel.abId, [c])
    s().reorder('back')
    expect(els().map((e) => e.id)).toEqual([c, b, a])
  })

  it('aligns to the artboard', () => {
    s().addEl('rect', { w: 100, h: 50, x: 7, y: 9 })
    s().align('right')
    expect(els()[0].x).toBe(260)
    s().align('vcenter')
    expect(els()[0].y).toBe(375)
  })

  it('duplicates, copies and pastes with new ids', () => {
    const id = s().addEl('rect', { x: 0, y: 0 })!
    s().duplicateSel()
    expect(els()).toHaveLength(2)
    expect(els()[1].id).not.toBe(id)
    s().copy()
    s().paste()
    expect(els()).toHaveLength(3)
    expect(new Set(els().map((e) => e.id)).size).toBe(3)
  })

  it('never deletes the last artboard and fixes the start screen', () => {
    const second = s().addArtboard()!
    s().commit((d) => void (d.startId = second))
    s().removeArtboard(second)
    expect(s().doc!.artboards).toHaveLength(1)
    expect(s().doc!.startId).toBe(s().doc!.artboards[0].id)
    s().removeArtboard(s().doc!.artboards[0].id)
    expect(s().doc!.artboards).toHaveLength(1)
  })

  it('bounds undo history', () => {
    const id = s().addEl('rect')!
    const ab = s().doc!.artboards[0].id
    for (let i = 0; i < 150; i++) s().patchEl(ab, id, { x: i })
    expect(s().past.length).toBeLessThanOrEqual(100)
  })
})
