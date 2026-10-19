// Custom toolbar icons (24px grid, currentColor so they follow the theme).
interface P {
  size?: number
}

const fillSvg = (size: number, vb: number, d: string) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} aria-hidden>
    <path fill="currentColor" d={d} />
  </svg>
)

const strokeSvg = (size: number, sw: number, d: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d={d} />
  </svg>
)

export const ShadowIcon = ({ size = 22 }: P) =>
  fillSvg(size, 24, 'M4 22q-.825 0-1.412-.587T2 20V8q0-.825.588-1.412T4 6h2V4q0-.825.588-1.412T8 2h12q.825 0 1.413.588T22 4v12q0 .825-.587 1.413T20 18h-2v2q0 .825-.587 1.413T16 22zm4-6h12V4H8z')

export const LayerIcon = ({ size = 22 }: P) =>
  fillSvg(
    size,
    24,
    'M4.528 5.118a1 1 0 0 1 1.027.05l5.554 3.703A2 2 0 0 1 12 10.535V21a1 1 0 0 1-1.555.832l-5.554-3.703A2 2 0 0 1 4 16.465V6a1 1 0 0 1 .528-.882m4-2a1 1 0 0 1 1.027.05l5.554 3.703A2 2 0 0 1 16 8.535V19a1 1 0 0 1-1.555.832l-.945-.63v-8.667a3.5 3.5 0 0 0-1.559-2.912L8 4.995V4a1 1 0 0 1 .528-.882m4-2a1 1 0 0 1 1.027.05l5.554 3.703A2 2 0 0 1 20 6.535V17a1 1 0 0 1-1.555.832l-.945-.63V8.534a3.5 3.5 0 0 0-1.559-2.912L12 2.995V2a1 1 0 0 1 .528-.882',
  )

export const OpacityIcon = ({ size = 22 }: P) =>
  fillSvg(size, 32, 'M6 6h4v4H6zm4 4h4v4h-4zm4-4h4v4h-4zm8 0h4v4h-4zM6 14h4v4H6zm8 0h4v4h-4zm8 0h4v4h-4zM6 22h4v4H6zm8 0h4v4h-4zm8 0h4v4h-4zm-4-12h4v4h-4zm-8 8h4v4h-4zm8 0h4v4h-4z')

/** "All settings" */
export const StyleIcon = ({ size = 22 }: P) =>
  fillSvg(
    size,
    24,
    'm3.975 19.8l-.85-.35q-.775-.325-1.037-1.125t.087-1.575l1.8-3.9zm4 2.2q-.825 0-1.412-.587T5.975 20v-6l2.65 7.35q.075.175.15.338t.2.312zm5.15-.1q-.8.3-1.55-.075t-1.05-1.175l-4.45-12.2q-.3-.8.05-1.562t1.15-1.038l7.55-2.75q.8-.3 1.55.075t1.05 1.175l4.45 12.2q.3.8-.05 1.563t-1.15 1.037zM11.688 9.713q.287-.288.287-.713t-.287-.712T10.975 8t-.712.288T9.975 9t.288.713t.712.287t.713-.288',
  )

export const PositionIcon = ({ size = 22 }: P) =>
  strokeSvg(size, 1.5, 'm4 16.01l.01-.011M4 20.01l.01-.011M4 8.01l.01-.011M4 4.01l.01-.011M4 12.01l.01-.011m7.99.011l.01-.011M8 20.01l.01-.011m3.99.011l.01-.011m3.99.011l.01-.011m3.99.011l.01-.011M20 16.01l.01-.011M20 12.01l.01-.011M20 8.01l.01-.011M20 4.01l.01-.011M16 4.01l.01-.011M12 4.01l.01-.011M8 4.01l.01-.011')

export const NudgeIcon = ({ size = 22 }: P) =>
  strokeSvg(size, 2, 'm12 17l3-8l-8 3l3.5 1.5zM3 7V5a2 2 0 0 1 2-2h2M3 17v2a2 2 0 0 0 2 2h2M17 3h2a2 2 0 0 1 2 2v2m-4 14h2a2 2 0 0 0 2-2v-2')
