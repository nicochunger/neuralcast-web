import { getEpisodeArtwork } from "@/lib/hostAdmin";
import { STATIONS } from "@/lib/stations";

export async function GET(_request: Request, context: { params: Promise<{ channelId: string; mediaId: string; chapterId: string }> }) {
  const { channelId, mediaId, chapterId } = await context.params;
  if (!STATIONS.some((station) => station.hostChannels.some((channel) => channel.id === channelId)) ||
      !/^[a-z0-9_-]{1,80}$/.test(mediaId) || !/^[a-z0-9_-]{1,80}$/.test(chapterId)) return new Response(null, { status: 404 });
  try {
    const bytes = await getEpisodeArtwork(channelId, mediaId, chapterId);
    return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
  } catch { return new Response(null, { status: 404 }); }
}
