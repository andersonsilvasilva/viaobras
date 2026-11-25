/** Asterisco dos recursos em implementação; a explicação é a nota única (SOON_NOTE). */
export function SoonMark() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 font-semibold text-brand">*</span>
      <span className="sr-only"> (em implementação)</span>
    </>
  )
}
