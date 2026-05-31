export default function TermsPage() {
  return (
    <article className="legal-page">
      <h1>Terms &amp; Conditions</h1>
      <p>Last updated: May 31, 2026</p>

      <h2>Acceptance</h2>
      <p>
        By using ExifScrub (&quot;the Service&quot;), you agree to these terms. If you do not agree, do not
        use the Service.
      </p>

      <h2>Service description</h2>
      <p>
        ExifScrub removes metadata from files and may produce attestations (&quot;prove-clean&quot; reports).
        Results depend on file format and processing path. The Service is provided &quot;as is&quot; without
        warranty of any kind.
      </p>

      <h2>No guarantee</h2>
      <p>
        We do not guarantee that all hidden data (including steganography or non-standard metadata) is
        removed. You are responsible for verifying outputs before publishing sensitive material.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, the authors and contributors shall not be liable for
        any indirect, incidental, special, consequential, or punitive damages, or any loss of profits,
        data, or goodwill, arising from your use of the Service.
      </p>

      <h2>Your responsibilities</h2>
      <p>
        You must only upload files you have the right to process. You must comply with applicable laws.
      </p>

      <h2>Open source</h2>
      <p>
        Source code is available under the licenses stated in the repository (MIT for browser packages,
        AGPL-3.0 for the worker). Self-hosting is permitted under those licenses.
      </p>

      <h2>Changes</h2>
      <p>We may modify these terms; continued use after changes constitutes acceptance.</p>
    </article>
  );
}
