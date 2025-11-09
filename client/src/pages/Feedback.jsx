export default function Feedback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#E20074]/10 via-white to-[#FFB7E6]/30 text-slate-900 text-center">
      <h1 className="text-3xl font-bold text-[#E20074] drop-shadow">
        Feedback
      </h1>
      <p className="text-slate-600 mt-2 text-lg">
        We value your input — help us improve the experience!
      </p>

      {/* TODO: Add feedback form or rating UI */}
      <div className="mt-10 text-slate-400 italic">
        // TODO: Implement feedback form (text input, rating, submit button)
      </div>

      <a
        href="/"
        className="mt-10 text-[#E20074] font-medium hover:underline hover:text-[#c60063] transition"
      >
        ← Back to Dashboard
      </a>
    </div>
  );
}
