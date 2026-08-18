export const PERSISTENT_AUDIO_ELEMENT_ID = "neuralcast-persistent-audio";
export const PERSISTENT_AUDIO_ELEMENT_CLASS = "persistentAudioElement";

declare global {
  interface Window {
    __neuralcastPersistentAudioElement__?: HTMLAudioElement;
  }
}

/**
 * Return the single live-radio element mounted by the root layout.
 *
 * Keeping the element outside client providers and route content is important:
 * React may reconstruct either boundary during navigation, and removing a media
 * element from the DOM can interrupt an active stream. The fallback is only for
 * recovery in development or if the root mount is accidentally unavailable.
 */
export function getPersistentAudioElement(): HTMLAudioElement {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Audio playback is only available in the browser.");
  }

  const mountedElement = document.getElementById(PERSISTENT_AUDIO_ELEMENT_ID);

  if (mountedElement) {
    if (!(mountedElement instanceof window.HTMLAudioElement)) {
      throw new Error(`#${PERSISTENT_AUDIO_ELEMENT_ID} must be an audio element.`);
    }

    window.__neuralcastPersistentAudioElement__ = mountedElement;
    return mountedElement;
  }

  const existingElement = window.__neuralcastPersistentAudioElement__;
  if (existingElement) {
    if (!existingElement.isConnected) {
      document.body.appendChild(existingElement);
    }
    return existingElement;
  }

  const audio = document.createElement("audio");
  audio.id = PERSISTENT_AUDIO_ELEMENT_ID;
  audio.className = PERSISTENT_AUDIO_ELEMENT_CLASS;
  audio.preload = "none";
  audio.setAttribute("aria-hidden", "true");
  document.body.appendChild(audio);
  window.__neuralcastPersistentAudioElement__ = audio;
  return audio;
}
