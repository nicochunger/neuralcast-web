"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEpisodePlayer } from "@/context/EpisodePlayerContext";
import { formatEpisodeTitle } from "@/lib/episodes";
import { EpisodeControls } from "@/components/EpisodeControls";
import styles from "./Episodes.module.css";

export function EpisodeMiniPlayer() {
  const player = useEpisodePlayer();
  const pathname = usePathname();
  if (!player.episode || !player.active) return null;
  const url = `/episodes/${player.episode.station}/${player.episode.id}`;
  if (pathname === url) return null;
  const displayTitle = formatEpisodeTitle(player.episode);
  return <aside className={styles.miniPlayer} aria-label={displayTitle}><Link href={url}>{displayTitle} ↗</Link><EpisodeControls episode={player.episode} compact /></aside>;
}
