export default function Privacy() {
  return (
    <section className="glass space-y-6 rounded-[32px] border border-white/20 p-6 shadow-lg dark:border-white/10 sm:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="text-sm opacity-70">Effective Date: 2 October 2025</p>
      </header>
      <p>
        This Privacy Policy describes how Arctic Aura Designs (“we,” “our,” or “us”) collects, uses, and protects
        personal information in connection with the Soldiers Against Drunk Driving (SADD) program website. Please note
        that while SADD is a volunteer program supporting the U.S. Army community, this website is privately owned and
        maintained by Arctic Aura Designs. It is not an official website of the U.S. Army, the Department of Defense
        (DoD), or any government agency, and has no official endorsement or affiliation.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Information We Collect</h2>
        <p>We may collect the following types of information when you use this website or participate in the SADD program:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Contact Information:</strong> Your name, phone number, and unit/organization, when provided for ride scheduling or
            volunteer coordination.
          </li>
          <li>
            <strong>Program Information:</strong> Ride requests, volunteer shifts, vehicle use, incident reports, and cleaning responsibilities.
          </li>
          <li>
            <strong>Technical Information:</strong> Basic log and usage data (e.g., IP address, browser type, access times) collected
            automatically for security and operational purposes.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. How We Use Your Information</h2>
        <p>Your information is used strictly for program-related purposes, including:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Coordinating and managing rides, volunteers, and shift schedules.</li>
          <li>Contacting you regarding ride confirmations, vehicle damages, or cleaning responsibilities.</li>
          <li>Maintaining accountability, safety, and program efficiency.</li>
        </ul>
        <p>We do not sell, rent, or trade your personal information.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Data Storage and Security</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Data is stored securely with administrative, technical, and physical safeguards.</li>
          <li>Access is limited to authorized program personnel or contractors with a need to know.</li>
          <li>Information is protected by encryption in transit and, where applicable, at rest.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Sharing of Information</h2>
        <p>We may share information only in the following limited circumstances:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>With authorized volunteers or coordinators to carry out program responsibilities.</li>
          <li>As required by law, regulation, or valid legal process.</li>
          <li>To protect the safety, rights, or property of participants, volunteers, or Arctic Aura Designs.</li>
        </ul>
        <p>We do not share your information with third parties for marketing purposes.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Data Retention</h2>
        <p>
          Personal information is retained only for as long as necessary to operate the SADD program or meet legal obligations.
          Information that is no longer required will be securely deleted or anonymized.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. No Government Affiliation</h2>
        <p>
          This website is privately maintained by Arctic Aura Designs. While it supports the Soldiers Against Drunk Driving program, it is
          not an official U.S. Army or DoD service. Nothing on this website should be interpreted as representing official policies or positions
          of the U.S. Government.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Your Rights</h2>
        <p>Depending on your location and applicable law, you may have rights to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Request access to personal information we hold about you.</li>
          <li>Request corrections to inaccurate or incomplete information.</li>
          <li>Request deletion of your information, subject to program and legal obligations.</li>
        </ul>
        <p>
          To exercise these rights, please contact us at: <span className="underline">info@arcticauradesigns.com</span>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Updates will be posted here with a revised “Effective Date.” Continued use of the
          website or participation in the program after updates are posted constitutes acceptance of the revised policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">9. Contact Us</h2>
        <p>For any questions regarding this Privacy Policy or the handling of your information, please contact:</p>
        <div className="space-y-1">
          <p>Arctic Aura Designs</p>
          <p className="underline">info@arcticauradesigns.com</p>
        </div>
      </section>
    </section>
  );
}

