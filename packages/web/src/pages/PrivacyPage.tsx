export default function PrivacyPage() {
  return (
    <article className="legal-page">
      <h1>Privacy Policy</h1>
      <p>Last updated: May 31, 2026</p>

      <h2>Summary</h2>
      <p>
        ExifScrub is designed for privacy. Image files (JPEG, PNG, HEIC, WebP, and similar) are
        processed entirely in your browser when the &quot;In browser&quot; badge is shown. Your files are
        not uploaded for those formats.
      </p>

      <h2>Server processing</h2>
      <p>
        PDF, audio, and video formats may be sent to our optional backend worker when you view
        metadata or scrub them. Those files are stored only in ephemeral job directories, deleted after a short
        retention period, and are not used for training, advertising, or resale.
      </p>

      <h2>Data we do not collect</h2>
      <ul>
        <li>We do not require an account to use the free tool.</li>
        <li>We do not sell personal data.</li>
        <li>We do not embed third-party advertising trackers that receive file contents or filenames.</li>
      </ul>

      <h2>Logs</h2>
      <p>
        Operational logs may record request timestamps and error codes. EXIF values, file contents,
        and passwords are not written to logs.
      </p>

      <h2>Your rights</h2>
      <p>
        Because browser-mode processing keeps files on your device, you control deletion by closing
        the tab or clearing your browser data. For questions, contact the maintainer via the GitHub
        repository linked in the header.
      </p>

      <h2>Changes</h2>
      <p>We may update this policy; the date above will change when we do.</p>
    </article>
  );
}
