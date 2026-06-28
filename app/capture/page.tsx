"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/db/dexieDB";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { VALID_PINS } from "@/constant";

// Główny komponent z Suspense dla Next.js App Router
export default function CapturePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0d070b] text-zinc-100 flex flex-col items-center justify-center p-6">
          <div className="w-8 h-8 border-2 border-[#e05397] border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <CaptureContent />
    </Suspense>
  );
}

function CaptureContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlPin = searchParams.get("pin");

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true,
  );

  // Pobieramy liczbę plików w lokalnej kolejce offline
  const queueCount = useLiveQuery(() => db.photos.count()) || 0;

  // 1. Walidacja autoryzacji z PIN-u
  useEffect(() => {
    if (urlPin && VALID_PINS.includes(urlPin)) {
      setIsAuthorized(true);
    } else {
      router.push("/?error=invalid_pin");
    }
  }, [urlPin, router]);

  // Synchronizacja zdjęć z bazą Google Drive
  const syncPhotos = async () => {
    if (!navigator.onLine || isUploading) return;

    const localPhotos = await db.photos.toArray();
    if (localPhotos.length === 0) return;

    setIsUploading(true);

    for (const photo of localPhotos) {
      const formData = new FormData();
      // photo.blob zawiera zapisany plik File/Blob w IndexedDB
      formData.append("file", photo.blob);
      formData.append("pin", urlPin || "");

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          // Usuwamy z IndexedDB dopiero po poprawnym statusie 200 OK
          await db.photos.delete(photo.id!);
        }
      } catch (err) {
        console.error("Upload failed, item kept in offline cache:", err);
        break; // Przerywamy pętlę w przypadku błędu sieci, aby nie przeciążać żądaniami
      }
    }
    setIsUploading(false);
  };

  // 2. Obsługa dodawania plików (Aparat / Galeria)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];

      // Zapisujemy czysty plik bezpośrednio do IndexedDB (Dexie radzi sobie z Blobami automatycznie)
      await db.photos.add({
        blob: file,
        createdAt: Date.now(),
      });
    }

    // Czyszczenie wartości inputu, aby można było dodać to samo zdjęcie ponownie
    e.target.value = "";

    // Próba automatycznej synchronizacji, jeśli sieć jest dostępna
    if (navigator.onLine) {
      syncPhotos();
    }
  };

  // 3. Nasłuchiwanie stanu sieci (Online / Offline)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPhotos();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Wywołanie startowe przy wejściu na stronę
    if (navigator.onLine) {
      syncPhotos();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [urlPin]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0d070b] flex items-center justify-center text-zinc-400 text-sm">
        <div className="w-5 h-5 border-2 border-[#e05397] border-t-transparent rounded-full animate-spin mr-3" />
        Weryfikacja uprawnień...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d070b] text-zinc-100 p-6 flex flex-col justify-between relative overflow-hidden">
      {/* Dynamiczne tło świetlne */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#e05397]/5 rounded-full blur-[60px] pointer-events-none" />

      {/* Górny pasek menu */}
      <header className="flex justify-between items-center py-4 z-10">
        {/* Wskaźnik stanu sieci */}
        <div>
          {!isOnline ? (
            <span className="text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-1.5 rounded-full font-medium animate-pulse">
              📴 Tryb Offline
            </span>
          ) : (
            <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full font-medium">
              🌐 Połączono
            </span>
          )}
        </div>

        <Link
          href={`/gallery?pin=${urlPin}`}
          className="bg-[#1a0f17] border border-[#291422] hover:border-[#e05397]/40 px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer"
        >
          🌸 Otwórz galerię
        </Link>
      </header>

      {/* Przyciski główne */}
      <div className="flex-1 flex flex-col items-center justify-center my-8 z-10 w-full max-w-sm mx-auto space-y-4">
        {/* Opcja 1: Aparat */}
        <label className="w-full bg-[#160b13]/60 border border-[#2d1626] hover:border-[#e05397]/40 rounded-2xl p-5 flex items-center gap-4 cursor-pointer transition shadow-xl group">
          <div className="p-3 bg-[#24111f] rounded-xl text-2xl group-hover:scale-110 transition-transform select-none">
            📸
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-semibold text-zinc-200">
              Zrób zdjęcie
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Uruchom aparat telefonu
            </p>
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        {/* Opcja 2: Pamięć urządzenia */}
        <label className="w-full bg-[#160b13]/60 border border-[#2d1626] hover:border-[#e05397]/40 rounded-2xl p-5 flex items-center gap-4 cursor-pointer transition shadow-xl group">
          <div className="p-3 bg-[#24111f] rounded-xl text-2xl group-hover:scale-110 transition-transform select-none">
            📁
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-semibold text-zinc-200">
              Wybierz z pamięci
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Dodaj jedno lub wiele zdjęć
            </p>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        <p className="text-xs text-zinc-500 text-center pt-4 max-w-[260px] leading-relaxed">
          Zdjęcia trafią bezpośrednio do albumu weselnego. W przypadku braku
          internetu, zostaną przesłane automatycznie po odzyskaniu sieci.
        </p>
      </div>

      {/* Dolny panel / Status kolejki synchronizacji */}
      <footer className="pb-6 z-10 w-full max-w-sm mx-auto">
        <button
          onClick={syncPhotos}
          disabled={isUploading || queueCount === 0 || !isOnline}
          className="w-full bg-[#e05397] hover:bg-[#c23b7b] disabled:bg-[#1a0f17] disabled:text-zinc-600 text-white font-semibold p-4 rounded-2xl text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Wysyłanie na dysk ({queueCount})...
            </>
          ) : queueCount > 0 ? (
            `Oczekuje na wysłanie: ${queueCount} ${!isOnline ? "(Brak sieci)" : "— kliknij, aby ponowić"}`
          ) : (
            "Wszystkie zdjęcia zsynchronizowane ✓"
          )}
        </button>
      </footer>
    </main>
  );
}
