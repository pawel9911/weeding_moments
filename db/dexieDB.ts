// src/db/dexieDB.ts
import Dexie, { type Table } from "dexie";

// Zaktualizowany interfejs – przechowujemy tylko surowy plik i metadane
export interface OfflinePhoto {
  id?: number;
  blob: Blob; // Tutaj ląduje pełny plik obrazu (File/Blob)
  createdAt: number; // Znacznik czasu dodania zdjęcia
}

class OfflineDatabase extends Dexie {
  photos!: Table<OfflinePhoto>;

  constructor() {
    super("PhotoOfflineDB");

    // Definiujemy strukturę tabeli.
    // Indeksujemy "++id" (autoinkrementacja) oraz "createdAt" (przydatne do sortowania chronologicznego)
    this.version(1).stores({
      photos: "++id, createdAt",
    });
  }
}

// Eksportujemy pojedynczą, globalną instancję bazy danych (Singleton)
export const db = new OfflineDatabase();
