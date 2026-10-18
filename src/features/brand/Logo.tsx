/**
 * Tuika brand logo. Uses the exact PNG at public/logo.png (copy of brand/logo.png).
 * - variant "tile": the full PNG as a rounded square (use in dialogs, about, etc.)
 * - variant "ring": zoomed to the ring so it sits in a clean circle (app header)
 */
const SRC = `${import.meta.env.BASE_URL}logo.png`

export function LogoMark({ size = 24, variant = 'tile', label = 'Tuika' }: { size?: number; variant?: 'tile' | 'ring'; label?: string }) {
  return (
    <span className={`logo-img ${variant}`} style={{ width: size, height: size }}>
      <img src={SRC} alt={label} draggable={false} />
    </span>
  )
}
