import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Help &amp; Support</h1>
      <p className="text-sm text-gray-600">
        Liffy&apos;nin bu sürümünde detaylı yardım merkezi henüz hazır değil.
        Aşağıdaki kanallardan destek alabilirsiniz.
      </p>

      <ul className="list-disc list-inside text-sm space-y-1">
        <li>
          Sorun bildir:{" "}
          <a
            href="mailto:admin@elan-expo.com"
            className="text-orange-600 hover:underline"
          >
            admin@elan-expo.com
          </a>
        </li>
        <li>
          Geri bildirim / feature isteği:{" "}
          <a
            href="mailto:admin@elan-expo.com?subject=Liffy%20Feedback"
            className="text-orange-600 hover:underline"
          >
            admin@elan-expo.com
          </a>
        </li>
      </ul>

      <div className="pt-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
        >
          ← Dashboard&apos;a dön
        </Link>
      </div>
    </div>
  );
}
