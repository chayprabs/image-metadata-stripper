import { Link } from "react-router-dom";
import { Github, Globe } from "lucide-react";
import type { ReactNode } from "react";
import { LEGAL } from "../content/legal-constants";

const GITHUB_URL = "https://github.com/chayprabs/image-metadata-stripper";
const TWITTER_URL = "https://x.com/chayprabs";
const WEBSITE_URL = "https://www.chaitanyaprabuddha.com";

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="topbar-brand">
          ExifScrub
        </Link>
        <nav className="topbar-links" aria-label="External links">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Github size={18} aria-hidden />
            GitHub
          </a>
          <a href={TWITTER_URL} target="_blank" rel="noopener noreferrer">
            <XIcon />
            @chayprabs
          </a>
          <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer">
            <Globe size={18} aria-hidden />
            chaitanyaprabuddha.com
          </a>
        </nav>
      </header>
      <div className="seo-bar" role="note">
        <div>
          Remove EXIF, GPS, XMP, IPTC and MakerNotes from photos and media — entirely in your browser for images.
        </div>
        <div>Choose a privacy preset, scrub metadata, and download a prove-clean attestation report.</div>
      </div>
      <main className="main-content">{children}</main>
      <footer className="footer-legal">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms &amp; Conditions</Link>
        <Link to="/legal">Legal &amp; Licenses</Link>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "var(--muted)", maxWidth: "48rem" }}>
          By using {LEGAL.productName} you agree to the Terms &amp; Privacy Policy. Software is provided AS
          IS without warranty; verify outputs before publishing sensitive files.
        </p>
      </footer>
    </div>
  );
}
