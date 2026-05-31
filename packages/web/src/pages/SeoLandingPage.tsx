import { useEffect } from "react";
import HomePage from "./HomePage";

const SEO_CONTENT: Record<
  string,
  { title: string; headline: string; body: string }
> = {
  "exif-remover": {
    title: "EXIF Remover",
    headline: "Remove EXIF metadata from photos online",
    body: "Strip camera settings, timestamps, and embedded thumbnails from JPEG and other images without uploading when using in-browser mode.",
  },
  "gps-remover-photo": {
    title: "GPS Remover for Photos",
    headline: "Remove GPS location from images",
    body: "Use the GPS + author preset to delete location tags and identifying fields before sharing photos publicly.",
  },
  "pdf-metadata-remove": {
    title: "PDF Metadata Remover",
    headline: "Remove author and XMP metadata from PDFs",
    body: "PDF files are processed via the optional worker using ExifTool. Download a cleaned PDF and prove-clean attestation.",
  },
  "mp4-metadata-strip": {
    title: "MP4 Metadata Stripper",
    headline: "Strip MP4 and MOV container metadata",
    body: "Remove author, location, and atom-level metadata from video files with privacy presets.",
  },
  "heic-metadata": {
    title: "HEIC Metadata Remover",
    headline: "Remove metadata from HEIC / HEIF photos",
    body: "Inspect and scrub iPhone HEIC photos in your browser with lazy-loaded decoding when needed.",
  },
};

export default function SeoLandingPage({ slug }: { slug: string }) {
  const content = SEO_CONTENT[slug];

  useEffect(() => {
    if (!content) return;
    document.title = `${content.title} — ExifScrub`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", content.body);
  }, [content]);

  if (!content) return null;

  return (
    <div>
      <div className="tool-card" style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.35rem", marginTop: 0 }}>{content.headline}</h1>
        <p style={{ color: "var(--muted)" }}>{content.body}</p>
      </div>
      <HomePage />
    </div>
  );
}
