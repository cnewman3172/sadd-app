export default function Volunteer() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold mb-4">Become a Volunteer</h1>
      <p>Join a mission that keeps our community safe. The process is straightforward:</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Register in VMIS (Volunteer Management Information System).</li>
        <li>Attend a SADD procedures briefing and read the SADD SOP.</li>
        <li>Training for your chosen volunteer role.</li>
      </ul>
      <p className="opacity-80">Interested? Email <a className="underline" href="mailto:FortWainwrightBOSS@army.mil">FortWainwrightBOSS@army.mil</a> to schedule documentation and training.</p>
    </div>
  );
}

