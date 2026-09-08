const BUNNY_EMBED_BASE = "https://iframe.mediadelivery.net/embed";

export type BunnyEmbedOptions = {
  autoplay?: boolean;
  muted?: boolean;
  preload?: boolean;
};

export function buildBunnyEmbedUrl(
  libraryId: string,
  videoId: string,
  opts: BunnyEmbedOptions = {},
): string {
  const lib = libraryId.trim();
  const vid = videoId.trim();
  const params = new URLSearchParams();
  params.set("autoplay", opts.autoplay !== false ? "true" : "false");
  params.set("muted", opts.muted === true ? "true" : "false");
  params.set("preload", opts.preload !== false ? "true" : "false");
  return `${BUNNY_EMBED_BASE}/${encodeURIComponent(lib)}/${encodeURIComponent(vid)}?${params.toString()}`;
}

export type ResolvedVideoSource =
  | { type: "bunny"; videoId: string; embedUrl: string }
  | { type: "hls"; masterUrl: string; posterUrl: string }
  | null;

export function resolveVideoSource(
  videoId: string | null | undefined,
  options: {
    bunnyLibraryId?: string;
    r2PublicBaseUrl?: string;
    embedOptions?: BunnyEmbedOptions;
  } = {},
): ResolvedVideoSource {
  if (!videoId) return null;
  const raw = videoId.trim();
  if (!raw) return null;

  // HLS stream on R2 or custom CDN
  if (
    raw.endsWith(".m3u8") ||
    raw.startsWith("videos/") ||
    raw.startsWith("r2:") ||
    raw.includes("/videos/")
  ) {
    const cleanKey = raw.replace(/^r2:/, "").replace(/^\/+/, "");
    const base = (
      options.r2PublicBaseUrl ||
      process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
      process.env.R2_PUBLIC_BASE_URL ||
      "https://cdn.loyaltering.online"
    ).replace(/\/+$/, "");

    const masterUrl =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? raw
        : `${base}/${cleanKey}`;
    const posterUrl = masterUrl.replace(/master\.m3u8$/, "poster.jpg");

    return {
      type: "hls",
      masterUrl,
      posterUrl,
    };
  }

  // Legacy Bunny stream
  const lib =
    options.bunnyLibraryId?.trim() ||
    process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID?.trim() ||
    process.env.BUNNY_STREAM_LIBRARY_ID?.trim();

  if (lib) {
    const embedUrl = buildBunnyEmbedUrl(lib, raw, options.embedOptions);
    return {
      type: "bunny",
      videoId: raw,
      embedUrl,
    };
  }

  return null;
}
