import { getAuthSession } from "@/lib/auth";
import { isFavoriteStoreConfigured, readAdminFavorites, writeAdminFavorites } from "@/lib/favoriteStore";
import { normalizeFavorites } from "@/lib/favorites";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }

  if (!isFavoriteStoreConfigured()) {
    return NextResponse.json({ error: "Favorites store is not configured." }, { status: 503 });
  }

  try {
    const stored = await readAdminFavorites();
    return NextResponse.json({
      favorites: normalizeFavorites(stored.favorites),
      exists: stored.exists
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load synced favorites." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
  }

  if (!isFavoriteStoreConfigured()) {
    return NextResponse.json({ error: "Favorites store is not configured." }, { status: 503 });
  }

  try {
    const payload = (await request.json()) as { favorites?: unknown };
    const favorites = normalizeFavorites(payload.favorites);

    if (favorites.length > 500) {
      return NextResponse.json({ error: "Favorites limit exceeded." }, { status: 413 });
    }

    await writeAdminFavorites(favorites);
    return NextResponse.json({ favorites }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to save synced favorites." }, { status: 502 });
  }
}
