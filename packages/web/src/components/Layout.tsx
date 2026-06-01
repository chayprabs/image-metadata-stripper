import { Link } from "react-router-dom";
import { Globe } from "lucide-react";
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

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
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
            <GitHubIcon />
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
