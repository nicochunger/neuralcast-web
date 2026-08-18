# Agent instructions

## Git workflow

- The repository remotes are already configured with credentials suitable for normal Git operations.
- Use simple Git commands for repository work: inspect with `git status` and `git diff`, then use `git add`, `git commit`, and `git push` as requested.
- Do not require GitHub CLI authentication or introduce a branch/PR workflow unless the user explicitly asks for it.
- Stage only the files belonging to the requested change; leave unrelated worktree changes untouched.

## Persistent live audio

- Live radio playback is owned exclusively by `AudioPlayerProvider` in the root layout.
- The `#neuralcast-persistent-audio` element must remain mounted directly in the root document, outside client providers and route content. Never move, remove, replace, or recreate it during internal navigation.
- All internal route navigation must use `next/link` or the Next router. Raw internal `<a href>` links, `window.location`, and document reloads terminate live playback and are not allowed.
- Independent preview players, such as the admin test stream, must never reuse, pause, or replace the persistent live-radio element.
- The service worker must not cache or intercept Next.js RSC payloads or other route data. Stale route payloads can force a document reload and terminate playback; only the explicit static asset allowlist may use cache-first behavior.
- Run `npm run check:audio-persistence` after changing the root layout, navigation, or audio code. The production build runs this check automatically.
