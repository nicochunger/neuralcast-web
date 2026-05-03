import { AudioPlayer } from "@/components/AudioPlayer";
import { getAuthSession } from "@/lib/auth";

export default async function Home() {
  const session = await getAuthSession();

  return <AudioPlayer isAdmin={session?.user?.isAdmin === true} />;
}
