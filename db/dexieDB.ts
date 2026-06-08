import Dexie, { type Table } from "dexie";

export interface OfflinePhoto {
  id?: number;
  blob: Blob;
  previewUrl: string;
  createdAt: number;
}

class OfflineDatabase extends Dexie {
  photos!: Table<OfflinePhoto>;

  constructor() {
    super("PhotoOfflineDB");
    this.version(1).stores({
      photos: "++id, createdAt",
    });
  }
}

export const db = new OfflineDatabase();
