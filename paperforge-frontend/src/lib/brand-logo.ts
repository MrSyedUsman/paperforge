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

/** Draws the logo inside a size x size box, keeping its aspect ratio. Returns false when it is not available so callers can draw a fallback. */
export function drawBrandLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): boolean {
  const image = brandLogo();
  if (!image) return false;
  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
  return true;
}
