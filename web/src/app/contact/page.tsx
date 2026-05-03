export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#0d0d22] text-white px-6 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-3xl font-semibold mb-6">Contact</h1>

        <p className="text-white/70 mb-4">
          Have questions, feedback, or need help?
        </p>

        <p className="text-white/80">
          Email us at:
        </p>

        <a
          href="mailto:parvezkhan02@outlook.com"
          className="text-[#7c83f5] underline mt-2 inline-block"
        >
          parvezkhan02@outlook.com
        </a>
      </div>
    </main>
  );
}