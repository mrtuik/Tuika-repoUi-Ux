// Custom toolbar icons (24px grid, currentColor so they follow the theme).
interface P {
  size?: number
  strokeWidth?: number
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

export const ShadowIcon = ({ size = 18 }: P) =>
  fillSvg(size, 24, 'M4 22q-.825 0-1.412-.587T2 20V8q0-.825.588-1.412T4 6h2V4q0-.825.588-1.412T8 2h12q.825 0 1.413.588T22 4v12q0 .825-.587 1.413T20 18h-2v2q0 .825-.587 1.413T16 22zm4-6h12V4H8z')

export const LayerIcon = ({ size = 18 }: P) =>
  fillSvg(
    size,
    24,
    'M4.528 5.118a1 1 0 0 1 1.027.05l5.554 3.703A2 2 0 0 1 12 10.535V21a1 1 0 0 1-1.555.832l-5.554-3.703A2 2 0 0 1 4 16.465V6a1 1 0 0 1 .528-.882m4-2a1 1 0 0 1 1.027.05l5.554 3.703A2 2 0 0 1 16 8.535V19a1 1 0 0 1-1.555.832l-.945-.63v-8.667a3.5 3.5 0 0 0-1.559-2.912L8 4.995V4a1 1 0 0 1 .528-.882m4-2a1 1 0 0 1 1.027.05l5.554 3.703A2 2 0 0 1 20 6.535V17a1 1 0 0 1-1.555.832l-.945-.63V8.534a3.5 3.5 0 0 0-1.559-2.912L12 2.995V2a1 1 0 0 1 .528-.882',
  )

export const OpacityIcon = ({ size = 18 }: P) =>
  fillSvg(size, 32, 'M6 6h4v4H6zm4 4h4v4h-4zm4-4h4v4h-4zm8 0h4v4h-4zM6 14h4v4H6zm8 0h4v4h-4zm8 0h4v4h-4zM6 22h4v4H6zm8 0h4v4h-4zm8 0h4v4h-4zm-4-12h4v4h-4zm-8 8h4v4h-4zm8 0h4v4h-4z')

/** "All settings" */
export const StyleIcon = ({ size = 18 }: P) =>
  fillSvg(
    size,
    24,
    'm3.975 19.8l-.85-.35q-.775-.325-1.037-1.125t.087-1.575l1.8-3.9zm4 2.2q-.825 0-1.412-.587T5.975 20v-6l2.65 7.35q.075.175.15.338t.2.312zm5.15-.1q-.8.3-1.55-.075t-1.05-1.175l-4.45-12.2q-.3-.8.05-1.562t1.15-1.038l7.55-2.75q.8-.3 1.55.075t1.05 1.175l4.45 12.2q.3.8-.05 1.563t-1.15 1.037zM11.688 9.713q.287-.288.287-.713t-.287-.712T10.975 8t-.712.288T9.975 9t.288.713t.712.287t.713-.288',
  )

export const PositionIcon = ({ size = 18 }: P) =>
  strokeSvg(size, 1.5, 'm4 16.01l.01-.011M4 20.01l.01-.011M4 8.01l.01-.011M4 4.01l.01-.011M4 12.01l.01-.011m7.99.011l.01-.011M8 20.01l.01-.011m3.99.011l.01-.011m3.99.011l.01-.011m3.99.011l.01-.011M20 16.01l.01-.011M20 12.01l.01-.011M20 8.01l.01-.011M20 4.01l.01-.011M16 4.01l.01-.011M12 4.01l.01-.011M8 4.01l.01-.011')

export const NudgeIcon = ({ size = 18 }: P) =>
  strokeSvg(size, 2, 'm12 17l3-8l-8 3l3.5 1.5zM3 7V5a2 2 0 0 1 2-2h2M3 17v2a2 2 0 0 0 2 2h2M17 3h2a2 2 0 0 1 2 2v2m-4 14h2a2 2 0 0 0 2-2v-2')

/** Upload (add-ad) */
export const UploadIcon = ({ size = 18 }: P) => fillSvg(size, 24, 'M18 20v-3h-3v-2h3v-3h2v3h3v2h-3v3zM1 21V3h18v7h-2V8H3v11h13v2z')

/** Icons category */
export const IconsFilledIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <g fill="currentColor">
      <path d="M4.25 2.603A4.5 4.5 0 1 1 2 6.5l.006-.229A4.5 4.5 0 0 1 4.25 2.603m1.382 10.901a1 1 0 0 1 1.736 0l4 7A1 1 0 0 1 10.5 22h-8a1 1 0 0 1-.868-1.496zm7.661-11.211a1 1 0 0 1 1.414 0l7 7a1 1 0 1 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414" />
      <path d="M20.293 2.293a1 1 0 0 1 1.414 1.414l-7 7a1 1 0 0 1-1.414-1.414zM21 13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" />
    </g>
  </svg>
)

/** Photos category */
export const CardSearchIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={1.5}>
      <path d="M14 4C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12V13M10 4C6.22876 4 4.34315 4 3.17157 5.17157C2 6.34315 2 8.22876 2 12C2 15.7712 2 17.6569 3.17157 18.8284C4.34315 20 6.22876 20 10 20H13" />
      <path d="M10 16H6" />
      <circle cx="18" cy="17" r="3" />
      <path d="M20.5 19.5L21.5 20.5" />
      <path d="M2 10L7 10M22 10L11 10" />
    </g>
  </svg>
)

/** "ai-editing": sparkle + pencil. Used for Ask AI (toolbar, chat, settings). */
export const AiEditIcon = ({ size = 18, strokeWidth = 1.5 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <g fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M6.538 2.322a.493.493 0 0 1 .924 0l.712 1.922c.1.27.312.483.582.583l1.922.71a.493.493 0 0 1 0 .925l-1.922.712a1 1 0 0 0-.582.582l-.712 1.922a.493.493 0 0 1-.924 0l-.711-1.922a1 1 0 0 0-.583-.583l-1.922-.71a.493.493 0 0 1 0-.925l1.922-.711c.27-.1.483-.313.583-.583z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.404 9.641l1.483 1.483M6 22h1.498c1.212 0 1.818 0 2.363-.226s.974-.654 1.831-1.512l8.15-8.149c.539-.539.808-.808.952-1.1a1.98 1.98 0 0 0 0-1.755c-.144-.291-.413-.56-.952-1.1c-.54-.539-.809-.808-1.1-.952a1.98 1.98 0 0 0-1.756 0c-.29.144-.56.413-1.1.952l-8.149 8.15c-.857.857-1.285 1.286-1.511 1.83C6 18.685 6 19.29 6 20.503z"
      />
    </g>
  </svg>
)

/** "panel-right-outline-bold": opens the Gemini setup panel. */
export const PanelRightIcon = ({ size = 18, strokeWidth = 2.5 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}>
      <path d="M14 4h5a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3H5a3 3 0 0 1 -3 -3V7a3 3 0 0 1 3 -3h5" />
      <path d="M15 4v16" />
    </g>
  </svg>
)
