/**
 * Tuika brand logo. Uses public/logo-mark.png: the glyph alone, centred on pure black (no outer ring),
 * so it stays crisp and symmetrical at any size. The original artwork is still in public/logo.png.
 * - variant "tile": rounded square (home header, dialogs)
 * - variant "ring": full circle
 */
const SRC = `${import.meta.env.BASE_URL}logo-mark.png`

export function LogoMark({ size = 24, variant = 'tile', label = 'Tuika' }: { size?: number; variant?: 'tile' | 'ring'; label?: string }) {
  return (
    <span className={`logo-img ${variant}`} style={{ width: size, height: size }}>
      <img src={SRC} alt={label} draggable={false} />
    </span>
  )
}
