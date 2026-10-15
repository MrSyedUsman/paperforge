/** The PaperForge logo tile shown next to the wordmark. Decorative: the wordmark carries the name. */
export function BrandMark() {
  // A fixed, already-sized local asset: next/image optimisation adds nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  return <i className="brand-mark" aria-hidden="true"><img src="/logo.png" alt="" width="64" height="64" decoding="async" /></i>;
}
