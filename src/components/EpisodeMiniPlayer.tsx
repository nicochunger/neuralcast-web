"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEpisodePlayer } from "@/context/EpisodePlayerContext";
import { EpisodeControls } from "@/components/EpisodeControls";
import styles from "./Episodes.module.css";

export function EpisodeMiniPlayer() {
  const player = useEpisodePlayer();
  const pathname = usePathname();
  if (!player.episode || !player.active) return null;
  const url = `/episodes/${player.episode.station}/${player.episode.id}`;
  if (pathname === url) return null;
  return <aside className={styles.miniPlayer} aria-label={player.episode.title}><Link href={url}>{player.episode.title} ↗</Link><EpisodeControls episode={player.episode} compact /></aside>;
}
