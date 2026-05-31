import { LEGAL } from "../content/legal-constants";

export default function PrivacyPage() {
  return (
    <article className="legal-page">
      <h1>Privacy Policy</h1>
      <p>
        <strong>Effective date:</strong> {LEGAL.effectiveDate}
      </p>
      <p>
        This Privacy Policy describes how {LEGAL.productName} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) handles
        information when you use the {LEGAL.productName} website, CLI, and optional server worker
        (collectively, the &quot;Service&quot;). By using the Service, you acknowledge this Policy.
      </p>

      <h2>1. Who we are</h2>
      <p>
        The Service is operated by {LEGAL.operatorName} (&quot;Operator&quot;). For privacy inquiries, contact us
        via{" "}
        <a href={LEGAL.githubIssues} target="_blank" rel="noopener noreferrer">
          GitHub Issues
        </a>{" "}
        or the security contact listed in our{" "}
        <a href={LEGAL.securityPolicy} target="_blank" rel="noopener noreferrer">
          security policy
        </a>
        .
      </p>

      <h2>2. Scope</h2>
      <p>
        This Policy applies to visitors and users worldwide. If local law grants you rights that
        conflict with this Policy, those mandatory rights prevail to the extent required by law.
      </p>

      <h2>3. Summary — how your files are processed</h2>
      <ul>
        <li>
          <strong>In-browser mode</strong> (JPEG, PNG, HEIC, WebP, and similar): files are processed
          locally in your browser. We do not receive file contents for those operations unless you
          explicitly use a server-backed feature.
        </li>
        <li>
          <strong>Server worker mode</strong> (PDF, MP3, MP4, and similar): when the optional worker
          is enabled, files you submit may be transmitted to that server for processing.
        </li>
        <li>
          <strong>Self-hosting</strong>: you may run the open-source worker yourself; this Policy
          describes our hosted deployment only.
        </li>
      </ul>

      <h2>4. Categories of information</h2>
      <p>Depending on how you use the Service, we may process:</p>
      <ul>
        <li>
          <strong>File content</strong> — only when you use server worker features (upload, batch
          ZIP, or URL fetch processed server-side).
        </li>
        <li>
          <strong>Technical data</strong> — IP address, user-agent, request timestamps, HTTP status
          codes, and similar server logs from hosting infrastructure (e.g. GitHub Pages, reverse
          proxies).
        </li>
        <li>
          <strong>Local browser data</strong> — session state, cached assets, and cryptographic keys
          generated in-browser for prove-clean signatures (stored on your device, not sent to us).
        </li>
      </ul>
      <p>
        We do <strong>not</strong> intentionally collect names, email addresses, payment information,
        or account credentials — the Service does not require registration.
      </p>

      <h2>5. Purposes and legal bases (EEA/UK GDPR)</h2>
      <p>If GDPR applies, we process personal data on these bases:</p>
      <ul>
        <li>
          <strong>Legitimate interests</strong> — operating, securing, and improving the Service,
          preventing abuse, and maintaining logs (balanced against your rights).
        </li>
        <li>
          <strong>Contract / pre-contractual steps</strong> — providing the Service you request when
          you upload files to the worker.
        </li>
        <li>
          <strong>Legal obligation</strong> — where required to comply with applicable law.
        </li>
        <li>
          <strong>Consent</strong> — where you voluntarily submit files or URLs for server processing
          (you may withdraw by discontinuing use).
        </li>
      </ul>

      <h2>6. Retention</h2>
      <ul>
        <li>
          <strong>Worker uploads</strong> — ephemeral job directories; target deletion within{" "}
          {LEGAL.retentionSeconds} seconds after processing (configurable when self-hosting).
        </li>
        <li>
          <strong>Server logs</strong> — retained only as long as necessary for security and
          operations, typically rotated by the hosting provider.
        </li>
        <li>
          <strong>Browser processing</strong> — data remains on your device until you close the tab
          or clear browser storage.
        </li>
      </ul>

      <h2>7. Sharing and sale of data</h2>
      <p>
        We do <strong>not</strong> sell, rent, or trade your personal information. We do not share file
        contents with advertisers or data brokers. We do not use your files to train machine-learning
        models.
      </p>
      <p>Limited disclosure may occur to:</p>
      <ul>
        <li>Infrastructure providers (e.g. static hosting, CDN) strictly to deliver the Service.</li>
        <li>Authorities when required by valid legal process and applicable law.</li>
      </ul>

      <h2>8. International transfers</h2>
      <p>
        The Service may be accessed globally. If you are in the EEA, UK, or other regions with
        transfer restrictions, your data may be processed in countries that may not provide
        equivalent protection. Where required, we rely on appropriate safeguards or your explicit
        submission of data to the worker.
      </p>

      <h2>9. Cookies and local storage</h2>
      <p>
        We do not use third-party advertising or analytics cookies. The app may use browser local
        storage or session storage for functionality (e.g. UI state). You can clear this via browser
        settings.
      </p>

      <h2>10. Security</h2>
      <p>
        We implement reasonable technical and organizational measures (HTTPS, ephemeral worker
        storage, no intentional logging of EXIF values). No method of transmission or storage is 100%
        secure. Report issues via our{" "}
        <a href={LEGAL.securityPolicy} target="_blank" rel="noopener noreferrer">
          security policy
        </a>
        .
      </p>

      <h2>11. Prove-clean reports</h2>
      <p>
        JSON/PDF attestations describe metadata changes detected by the tool at processing time. They
        are <strong>not</strong> legal certificates, warranties, or guarantees of privacy compliance.
        Signatures demonstrate integrity of the report payload, not fitness for any regulated purpose.
      </p>

      <h2>12. Your rights</h2>
      <p>Depending on your location, you may have the right to:</p>
      <ul>
        <li>Access, correct, or delete personal data we hold about you.</li>
        <li>Object to or restrict certain processing.</li>
        <li>Data portability (where applicable).</li>
        <li>Withdraw consent (where processing is consent-based).</li>
        <li>Lodge a complaint with a supervisory authority (EEA/UK).</li>
      </ul>
      <p>
        <strong>California (CCPA/CPRA):</strong> We do not sell or share personal information as
        defined by California law. California residents may request disclosure or deletion by
        contacting us via GitHub Issues. We do not discriminate against users exercising privacy
        rights.
      </p>
      <p>
        <strong>Brazil (LGPD), Canada (PIPEDA), Australia (Privacy Act):</strong> Similar rights may
        apply. Contact us to exercise them; we will respond within reasonable timeframes required by
        applicable law.
      </p>

      <h2>13. Children</h2>
      <p>
        The Service is not directed to children under 13 (or 16 where EU member state law requires).
        We do not knowingly collect personal information from children. If you believe a child
        provided data via the worker, contact us for deletion.
      </p>

      <h2>14. Third-party links</h2>
      <p>
        The Service may link to external sites (GitHub, social media, maintainer website). Their
        privacy practices are governed by their own policies.
      </p>

      <h2>15. Changes</h2>
      <p>
        We may update this Policy. The effective date above will change when we do. Material changes
        may be noted in the repository changelog. Continued use after changes constitutes acceptance
        where permitted by law.
      </p>

      <h2>16. Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href={LEGAL.githubIssues} target="_blank" rel="noopener noreferrer">
          {LEGAL.githubIssues}
        </a>
      </p>
    </article>
  );
}
