/** C-DAC brand mark used across the portal shell and public pages. */
export function LogoMark({ className = 'h-9 w-auto' }: { className?: string }) {
  return (
    <img
      src="/logos/cdac-brand.svg"
      alt="C-DAC"
      className={className}
      width={120}
      height={85}
      decoding="async"
    />
  )
}
