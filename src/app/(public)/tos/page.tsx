export default function Terms() {
  return (
    <section className="glass space-y-4 rounded-[32px] border border-white/20 p-6 shadow-lg dark:border-white/10">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p>SADD is a free, volunteer-run program. By requesting or accepting a ride you agree:</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Damage to vehicles may result in liability for repair costs.</li>
        <li>You are responsible for any cleaning fees for bodily fluids.</li>
        <li>SADD may decline a request at our discretion for safety.</li>
      </ul>
      <p className="opacity-80">These terms may change without notice.</p>
    </section>
  );
}
