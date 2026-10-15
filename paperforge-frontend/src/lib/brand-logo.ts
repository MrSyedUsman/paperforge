let logo: HTMLImageElement | null = null;

/** The loaded logo, or null while it is still loading (or outside the browser). Starts loading on first call. */
export function brandLogo(): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  if (!logo) {
    logo = new Image();
    logo.decoding = "async";
    logo.src = "/logo.png";
  }
  return logo.complete && logo.naturalWidth > 0 ? logo : null;
}

/** Draws the logo as a rounded square. Returns false when it is not available so callers can draw a fallback. */
export function drawBrandLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, radius: number): boolean {
  const image = brandLogo();
  if (!image) return false;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.clip();
  ctx.drawImage(image, x, y, size, size);
  ctx.restore();
  return true;
}
