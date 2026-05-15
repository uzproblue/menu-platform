/** First image file from a browser paste event, if any. */
export function getImageFileFromClipboardEvent(event: ClipboardEvent): File | null {
  const cd = event.clipboardData;
  if (!cd) return null;

  const { files } = cd;
  if (files?.length) {
    for (let i = 0; i < files.length; i++) {
      const f = files.item(i);
      if (f?.type.startsWith("image/")) return f;
    }
  }

  const { items } = cd;
  if (!items?.length) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}
