import { LEGAL } from "../content/legal-constants";

export default function TermsPage() {
  return (
    <article className="legal-page">
      <h1>Terms &amp; Conditions</h1>
      <p>
        <strong>Effective date:</strong> {LEGAL.effectiveDate}
      </p>
      <p>
        These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of {LEGAL.productName}
        (&quot;Service&quot;), including the website, CLI, browser application, and optional worker API,
        operated by {LEGAL.operatorName} (&quot;Operator&quot;, &quot;we&quot;, &quot;us&quot;).{" "}
        <strong>
          If you do not agree to these Terms, do not use the Service.
        </strong>
      </p>

      <h2>1. Acceptance</h2>
      <p>
        By accessing or using the Service, you agree to these Terms and our{" "}
        <a href="/privacy">Privacy Policy</a>, which is incorporated by reference. If you use the
        Service on behalf of an organization, you represent that you have authority to bind that
        organization.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old (or the age of majority in your jurisdiction) to use the
        Service. If you are under the age of majority, you may use the Service only with verifiable
        parental or guardian consent where required by law.
      </p>

      <h2>3. Service description</h2>
      <p>
        {LEGAL.productName} is a metadata inspection and removal tool. It may generate informational
        reports (&quot;prove-clean&quot; JSON/PDF). The Service is provided free of charge unless you
        separately agree to paid hosting or support.
      </p>
      <ul>
        <li>Browser processing keeps supported image formats on your device.</li>
        <li>Server worker processing handles additional formats when deployed.</li>
        <li>Results vary by file format, encoder, and preset selected.</li>
      </ul>

      <h2>4. No professional advice</h2>
      <p>
        The Service does <strong>not</strong> provide legal, forensic, security, compliance, or
        professional advice. Prove-clean outputs are technical summaries only and are not court
        evidence, regulatory certifications, or guarantees that a file is safe to publish. Consult
        qualified professionals for legal or compliance decisions.
      </p>

      <h2>5. No guarantee of complete metadata removal</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE DO NOT WARRANT THAT ALL METADATA,
        HIDDEN DATA, STEGANOGRAPHY, MALWARE, WATERMARKS, OR NON-STANDARD EMBEDDED CONTENT WILL BE
        REMOVED OR DETECTED. YOU ARE SOLELY RESPONSIBLE FOR REVIEWING OUTPUT FILES BEFORE
        DISTRIBUTION, PUBLICATION, OR LEGAL DISCLOSURE.
      </p>

      <h2>6. Your responsibilities</h2>
      <p>You agree that you will:</p>
      <ul>
        <li>Only process files you own or have lawful permission to modify.</li>
        <li>Comply with all applicable laws (copyright, privacy, export, sanctions, etc.).</li>
        <li>Not upload unlawful, infringing, or malicious content.</li>
        <li>Not attempt to disrupt, reverse-engineer, or overload the Service.</li>
        <li>Not use the Service to violate others&apos; privacy or intellectual property rights.</li>
        <li>Not misrepresent prove-clean reports as official certifications.</li>
      </ul>

      <h2>7. Acceptable use</h2>
      <p>Prohibited uses include, without limitation:</p>
      <ul>
        <li>Processing child sexual abuse material (CSAM) or content illegal in your jurisdiction.</li>
        <li>Automated scraping or denial-of-service attacks against hosted endpoints.</li>
        <li>Circumventing technical limits or security controls.</li>
        <li>Using the Service in high-risk environments (medical, aviation, nuclear) without independent validation.</li>
      </ul>
      <p>We may suspend or block access for violations, without notice where permitted by law.</p>

      <h2>8. Intellectual property</h2>
      <p>
        The Service name, branding, and original source code are owned by the Operator or licensors.
        Open-source components are licensed separately — see our{" "}
        <a href="/legal">Legal &amp; Licenses</a> page and repository{" "}
        <a href={`${LEGAL.githubRepo}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
          LICENSE
        </a>{" "}
        files. You retain ownership of files you upload; you grant us a limited, temporary license to
        process worker uploads solely to provide the Service.
      </p>

      <h2>9. Open-source software</h2>
      <p>
        Browser packages and CLI are offered under the MIT License. The worker is under AGPL-3.0.
        Third-party tools (including ExifTool) have their own licenses — see{" "}
        <a href={`${LEGAL.githubRepo}/blob/main/NOTICE.md`} target="_blank" rel="noopener noreferrer">
          NOTICE.md
        </a>
        . Self-hosting is permitted under those licenses; AGPL obligations apply to network-deployed
        worker modifications.
      </p>

      <h2>10. Disclaimer of warranties</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
        ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING BUT NOT LIMITED TO
        IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE,
        NON-INFRINGEMENT, ACCURACY, AND QUIET ENJOYMENT. WE DO NOT WARRANT UNINTERRUPTED OR ERROR-FREE
        OPERATION.
      </p>
      <p>
        Some jurisdictions do not allow exclusion of implied warranties; in those jurisdictions,
        exclusions apply to the fullest extent permitted.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE OPERATOR,
        CONTRIBUTORS, AFFILIATES, OR SUPPLIERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA,
        GOODWILL, BUSINESS INTERRUPTION, OR PRIVACY BREACH CLAIMS, ARISING FROM OR RELATED TO THE
        SERVICE, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY,
        OR ANY OTHER LEGAL THEORY, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING
        FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) USD $100 OR (B) THE
        AMOUNT YOU PAID US FOR THE SERVICE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM (TYPICALLY
        ZERO FOR FREE USE).
      </p>
      <p>
        Nothing in these Terms limits liability where prohibited by mandatory law (including death
        or personal injury caused by negligence, fraud, or liability that cannot be excluded under
        consumer protection laws in your country of residence).
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold harmless the Operator, contributors, and service
        providers from and against any claims, damages, losses, liabilities, costs, and expenses
        (including reasonable attorneys&apos; fees) arising from: (a) your use of the Service; (b)
        your files or content; (c) your violation of these Terms; or (d) your violation of any law or
        third-party rights.
      </p>

      <h2>13. Release</h2>
      <p>
        To the extent permitted by law, you release the Operator from claims, demands, and damages
        of every kind, known and unknown, arising out of or in any way connected with disputes
        between you and third parties relating to files you process with the Service.
      </p>

      <h2>14. Export and sanctions</h2>
      <p>
        You may not use the Service in violation of export control, sanctions, or embargo laws of
        any applicable jurisdiction, including U.S. OFAC regulations and EU/UN sanctions lists.
      </p>

      <h2>15. Consumer rights</h2>
      <p>
        If you are a consumer in the EEA, UK, Australia, or other jurisdictions with mandatory
        consumer protection laws, nothing in these Terms removes rights you cannot waive by
        contract. Where a term is void under your local law, it does not apply to you.
      </p>

      <h2>16. Dispute resolution</h2>
      <p>
        <strong>Informal resolution:</strong> Before formal proceedings, contact us via{" "}
        <a href={LEGAL.githubIssues} target="_blank" rel="noopener noreferrer">
          GitHub Issues
        </a>{" "}
        to attempt good-faith resolution within 30 days.
      </p>
      <p>
        <strong>Governing law:</strong> These Terms are governed by the laws of India, without regard
        to conflict-of-law principles, except where mandatory consumer protection law of your
        country of residence requires otherwise.
      </p>
      <p>
        <strong>Jurisdiction:</strong> Subject to mandatory local consumer rights, courts in
        Bengaluru, Karnataka, India shall have exclusive jurisdiction. EU/UK consumers may also
        bring proceedings in their country of residence where permitted by law.
      </p>
      <p>
        <strong>Class actions:</strong> To the extent permitted by applicable law, disputes will be
        resolved only on an individual basis, not as a class, collective, or representative action.
      </p>

      <h2>17. Severability</h2>
      <p>
        If any provision is held invalid or unenforceable, the remaining provisions remain in full
        force, and the invalid provision shall be modified to the minimum extent necessary to make
        it enforceable.
      </p>

      <h2>18. Entire agreement</h2>
      <p>
        These Terms, the Privacy Policy, and applicable open-source licenses constitute the entire
        agreement regarding the Service and supersede prior understandings on the same subject.
      </p>

      <h2>19. Assignment</h2>
      <p>
        You may not assign these Terms without our consent. We may assign these Terms in connection
        with a merger, acquisition, or asset sale.
      </p>

      <h2>20. Changes</h2>
      <p>
        We may modify these Terms at any time. The effective date will be updated. Continued use
        after changes constitutes acceptance where permitted by law. Material changes may be noted
        in the repository changelog.
      </p>

      <h2>21. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href={LEGAL.githubIssues} target="_blank" rel="noopener noreferrer">
          {LEGAL.githubIssues}
        </a>
      </p>
    </article>
  );
}
