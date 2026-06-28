import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { VALID_PINS } from "@/constant";

let cachedFolderId: string | undefined;
const localUploadDir = path.join(process.cwd(), "public", "uploads");

function getGoogleAuth() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKey =
    process.env.GOOGLE_PRIVATE_KEY ??
    (process.env.GOOGLE_PRIVATE_KEY_BASE64
      ? Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString(
          "utf8",
        )
      : undefined);

  if (!email || !rawPrivateKey) {
    throw new Error("Brak danych uwierzytelniających Google Drive.");
  }

  return new google.auth.JWT({
    email,
    key: rawPrivateKey.replaceAll("\\n", "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

async function listLocalPhotos() {
  try {
    const entries = await fs.readdir(localUploadDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);

    return await Promise.all(
      files.map(async (fileName) => {
        const filePath = path.join(localUploadDir, fileName);
        const stat = await fs.stat(filePath);

        return {
          id: `local-${fileName}`,
          url: `/uploads/${fileName}`,
          name: fileName,
          createdAt: stat.mtimeMs,
          isLocal: true,
        };
      }),
    );
  } catch {
    return [];
  }
}

async function resolveDriveFolderId(drive: ReturnType<typeof google.drive>) {
  if (cachedFolderId) {
    try {
      await drive.files.get({
        fileId: cachedFolderId,
        fields: "id",
        supportsAllDrives: true,
      });
      return cachedFolderId;
    } catch {
      cachedFolderId = undefined;
    }
  }

  const configuredFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (configuredFolderId) {
    try {
      await drive.files.get({
        fileId: configuredFolderId,
        fields: "id",
        supportsAllDrives: true,
      });
      cachedFolderId = configuredFolderId;
      return cachedFolderId;
    } catch (error) {
      const status =
        typeof error === "object" && error && "status" in error
          ? (error as { status?: number }).status
          : undefined;
      if (status !== 403 && status !== 404) {
        throw error;
      }
    }
  }

  const createdFolder = await drive.files.create({
    requestBody: {
      name: "Wedding Moments",
      mimeType: "application/vnd.google-apps.folder",
      parents: ["root"],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  cachedFolderId = createdFolder.data.id ?? undefined;
  if (!cachedFolderId) {
    throw new Error("Nie udało się utworzyć folderu w Google Drive.");
  }

  return cachedFolderId;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pin = searchParams.get("pin");

    if (!pin || !VALID_PINS.includes(pin)) {
      return NextResponse.json(
        { error: "Nieautoryzowany dostęp. Nieprawidłowy PIN." },
        { status: 401 },
      );
    }

    const localPhotos = await listLocalPhotos();

    const hasDriveConfig = Boolean(
      process.env.GOOGLE_CLIENT_EMAIL &&
      (process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY_BASE64),
    );

    let drivePhotos: Array<{
      id: string;
      url: string;
      name?: string;
      createdAt: number;
      isLocal: boolean;
    }> = [];

    if (hasDriveConfig) {
      try {
        const auth = getGoogleAuth();
        const driveClient = google.drive({ version: "v3", auth });
        const folderId = await resolveDriveFolderId(driveClient);

        const response = await driveClient.files.list({
          q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
          fields:
            "files(id, name, mimeType, createdTime, thumbnailLink, webContentLink)",
          orderBy: "createdTime desc",
          pageSize: 100,
          supportsAllDrives: true,
        });

        const files = response.data.files || [];
        drivePhotos = files.map((file) => ({
          id: file.id ?? "",
          url: file.thumbnailLink
            ? file.thumbnailLink.replace(/=s\d+/, "=s800")
            : (file.webContentLink ?? ""),
          name: file.name,
          createdAt: file.createdTime
            ? new Date(file.createdTime).getTime()
            : Date.now(),
          isLocal: false,
        }));
      } catch (driveError) {
        console.warn(
          "Google Drive gallery read failed, continuing with local uploads:",
          driveError,
        );
      }
    }

    const photos = [...localPhotos, ...drivePhotos].sort(
      (a, b) => b.createdAt - a.createdAt,
    );

    return NextResponse.json({ photos }, { status: 200 });
  } catch (error: unknown) {
    console.error("Błąd podczas pobierania zdjęć z Google Drive:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Nie udało się pobrać galerii z chmury.",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
