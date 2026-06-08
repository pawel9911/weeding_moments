// src/app/gallery/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/db/dexieDB";
import { useLiveQuery } from "dexie-react-hooks";
import Gallery from "@/components/Gallery";
import Link from "next/link";

const VALID_PINS = ["1234", "5678", "9999"];

export default function GalleryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlPin = searchParams.get("pin");

  const [isAuthorized, setIsAuthorized] = useState(false);
  const photos = useLiveQuery(() => db.photos.toArray()) || [];

  useEffect(() => {
    if (urlPin && VALID_PINS.includes(urlPin)) {
      setIsAuthorized(true);
    } else {
      router.push("/?error=invalid_pin");
    }
  }, [urlPin, router]);

  if (!isAuthorized)
    return (
      <div className="p-8 text-center text-zinc-500">Verifying access...</div>
    );

  return (
    <main className="min-h-screen bg-[#0d070b] text-zinc-100 p-6 flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#e05397]/5 rounded-full blur-[60px] pointer-events-none" />

      <header className="flex justify-end items-center py-4 z-10">
        <Link
          href={`/capture?pin=${urlPin}`}
          className={`
            bg-[#160b13]/85 border border-[#2d1626] shadow-2xl backdrop-blur-md
            text-zinc-200 hover:border-[#3d1f33] 
            font-mono text-xs tracking-wider
            px-4 py-2 rounded-xl transition`}
        >
          Dodaj zdjęcie
        </Link>
      </header>

      {photos.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full max-w-lg mx-auto">
          <div className="text-center py-12 px-5 border border-[#2d1626] rounded-2xl bg-[#160b13]/60 shadow-xl w-full">
            <span className="text-4xl block mb-4 animate-pulse">📸</span>
            <p className="font-sans text-pink-300 mb-3">
              Stwórzmy razem coś, co zostanie z nami na lata.
            </p>
            <p className="text-xs text-zinc-300 mb-6 font-sans">
              Galeria zdjęć jest w tym momencie pusta.
            </p>

            <Link
              href={`/capture?pin=${urlPin}`}
              className="inline-block bg-[#24111f] border border-[#2d1626] hover:border-[#e05397]/40 hover:text-pink-300 px-5 py-3 rounded-xl text-xs font-semibold text-zinc-200 transition shadow-md"
            >
              Dodaj pierwsze zdjęcie
            </Link>
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div className="w-full z-10 flex-1">
          <Gallery photos={photos} onDelete={(id) => db.photos.delete(id)} />
        </div>
      )}
    </main>
  );
}
