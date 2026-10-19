import { useEffect, useRef, useState } from 'react'
import { Group, Layer, Rect, Stage } from 'react-konva'
import { ArrowLeft, X } from 'lucide-react'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import { brokenLinks } from '../../engine/doc'
import ElNode from '../canvas/ElNode'

/** Interactive prototype. Reads the live document from the store, so edits show up without reloading. */
export default function Preview() {
  const doc = useEditor((s) => s.doc)!
  const [stack, setStack] = useState<string[]>([doc.startId])
  const [fade, setFade] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 320, h: 600 })
  const close = () => useUI.getState().setPreview(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const currentId = stack[stack.length - 1]
  const ab = doc.artboards.find((a) => a.id === currentId) ?? doc.artboards[0]
  const broken = brokenLinks(doc).length
  const s = Math.min(size.w / ab.w, size.h / ab.h)

  const go = (target: string) => {
    if (!doc.artboards.some((a) => a.id === target)) {
      useUI.getState().say('This link points to a screen that no longer exists')
      return
    }
    setFade(true)
    setTimeout(() => {
      setStack((st) => [...st, target])
      setFade(false)
    }, 120)
  }

  return (
    <div className="preview" role="dialog" aria-label="Prototype preview">
      <div className="preview-bar">
        <button className="ic" aria-label="Back one screen" disabled={stack.length < 2} onClick={() => setStack((st) => st.slice(0, -1))}>
          <ArrowLeft size={18} />
        </button>
        <div className="ptitle">
          {ab.name}
          {broken > 0 && <span className="badge">{broken} broken link{broken > 1 ? 's' : ''}</span>}
        </div>
        <button className="ic" aria-label="Close preview" onClick={close}>
          <X size={18} />
        </button>
      </div>
      <div className="preview-stage" ref={box}>
        <div className={'fade' + (fade ? ' out' : '')}>
          <Stage width={Math.floor(ab.w * s)} height={Math.floor(ab.h * s)} scaleX={s} scaleY={s}>
            <Layer>
              <Rect width={ab.w} height={ab.h} fill={ab.bg} />
              <Group clipX={0} clipY={0} clipWidth={ab.w} clipHeight={ab.h}>
                {ab.els.map((el) => (
                  <ElNode key={el.id} el={el} interactive={false} abW={ab.w} abH={ab.h} onLink={go} />
                ))}
              </Group>
            </Layer>
          </Stage>
        </div>
      </div>
      <div className="preview-foot">Interactive prototype. Tap elements that have a link. This is a design preview, not a compiled app.</div>
    </div>
  )
}
