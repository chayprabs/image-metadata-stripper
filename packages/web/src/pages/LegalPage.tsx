import { LEGAL } from "../content/legal-constants";

export default function LegalPage() {
  return (
    <article className="legal-page">
      <h1>Legal &amp; Licenses</h1>
      <p>
        <strong>Effective date:</strong> {LEGAL.effectiveDate}
      </p>

      <h2>Software disclaimer</h2>
      <p>
        {LEGAL.productName} is free and open-source software provided <strong>AS IS</strong>, without
        warranty of any kind. Metadata removal is a best-effort technical process, not a legal
        guarantee. See{" "}
        <a href={`${LEGAL.githubRepo}/blob/main/DISCLAIMER.md`} target="_blank" rel="noopener noreferrer">
          DISCLAIMER.md
        </a>{" "}
        in the repository for the full software disclaimer.
      </p>

      <h2>Project licenses</h2>
      <ul>
        <li>
          <strong>Browser core, web UI, CLI</strong> —{" "}
          <a href={`${LEGAL.githubRepo}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
            MIT License
          </a>{" "}
          (Copyright © 2026 {LEGAL.operatorName})
        </li>
        <li>
          <strong>Worker (FastAPI + ExifTool integration)</strong> —{" "}
          <a
            href={`${LEGAL.githubRepo}/blob/main/apps/worker/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
          >
            GNU Affero General Public License v3.0 (AGPL-3.0)
          </a>
        </li>
      </ul>
      <p>
        If you deploy a modified worker as a network service, AGPL-3.0 requires making corresponding
        source available to users who interact with it over a network.
      </p>

      <h2>Third-party components</h2>
      <p>
        The Service depends on third-party libraries and tools (ExifTool, FFmpeg, exifr, piexifjs,
        React, and others). See{" "}
        <a href={`${LEGAL.githubRepo}/blob/main/NOTICE.md`} target="_blank" rel="noopener noreferrer">
          NOTICE.md
        </a>{" "}
        for attribution and license references. ExifTool is licensed under its own terms (GPL/Artistic
        — see ExifTool distribution). You are responsible for compliance when self-hosting.
      </p>

      <h2>Trademarks</h2>
      <p>
        &quot;{LEGAL.productName}&quot; and associated branding are used to identify the project.
        Third-party names (JPEG, PDF, MP4, etc.) are trademarks of their respective owners.
      </p>

      <h2>Related policies</h2>
      <ul>
        <li>
          <a href="/privacy">Privacy Policy</a>
        </li>
        <li>
          <a href="/terms">Terms &amp; Conditions</a>
        </li>
        <li>
          <a href={LEGAL.securityPolicy} target="_blank" rel="noopener noreferrer">
            Security Policy
          </a>
        </li>
        <li>
          <a href={`${LEGAL.githubRepo}/blob/main/LEGAL.md`} target="_blank" rel="noopener noreferrer">
            LEGAL.md
          </a>{" "}
          (full legal reference in repository)
        </li>
      </ul>

      <h2>Contact</h2>
      <p>
        Legal or licensing questions:{" "}
        <a href={LEGAL.githubIssues} target="_blank" rel="noopener noreferrer">
          {LEGAL.githubIssues}
        </a>
      </p>
    </article>
  );
}
