export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#E20074]/10 via-white to-[#FFB7E6]/30 text-slate-900 text-center">
      <h1 className="text-6xl font-bold text-[#E20074] drop-shadow-sm">404</h1>
      <p className="text-slate-700 text-lg mt-3">
        Oops! The page you’re looking for doesn’t exist.
      </p>

      <div className="mt-8 space-x-4">
        <a
          href="/"
          className="px-6 py-3 rounded-xl bg-[#E20074] text-white font-medium shadow hover:bg-[#c60063] transition"
        >
          Go Home
        </a>
        <a
          href="/chatbot"
          className="px-6 py-3 rounded-xl border border-[#E20074] text-[#E20074] font-medium hover:bg-[#E20074]/10 transition"
        >
          Chat with Support
        </a>
      </div>
    </div>
  );
}
