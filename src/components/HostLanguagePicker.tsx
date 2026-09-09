"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { FlagIcon } from "@/components/FlagIcon";
import { useI18n } from "@/lib/i18n";
import { resolveHostChannel } from "@/lib/stations";
import type { Station } from "@/types/radio";

export function HostLanguagePicker({ station, selection, onChange }: {
  station: Station;
  selection: string;
  onChange: (selection: string) => void;
}) {
  const { locale, t } = useI18n();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const following = selection === "follow-ui";
  const channel = resolveHostChannel(station, following ? "follow-ui" : "fixed", selection, locale);
  const options = [
    ...station.hostChannels.map((item) => ({
      value: item.id,
      label: item.locale.startsWith("fr") ? "Français" : "Español",
      country: item.locale.startsWith("fr") ? "ch" as const : "ar" as const
    })),
    { value: "follow-ui", label: t("host.followAppLanguage"), country: null }
  ];
  const activeLabel = options.find((item) => item.value === selection)?.label ?? channel.locale;

  useEffect(() => {
    if (!open) return;
    const close = () => menu.current?.hidePopover();
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function showMenu(last = false) {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: Math.max(12, Math.min(rect.right - 240, window.innerWidth - 252)),
      top: rect.bottom + 8 + 170 > window.innerHeight ? Math.max(12, rect.top - 178) : rect.bottom + 8
    });
    menu.current?.showPopover();
    const buttons = menu.current?.querySelectorAll<HTMLButtonElement>("button");
    const selectedIndex = options.findIndex((item) => item.value === selection);
    buttons?.[last ? options.length - 1 : Math.max(0, selectedIndex)]?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (index + 1) % buttons.length
      : event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length
        : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : undefined;
    if (next !== undefined) {
      event.preventDefault();
      buttons[next]?.focus();
    }
    if (event.key === "Tab") menu.current?.hidePopover();
  }

  return (
    <div className="hostLanguageControl">
      <span id={`${id}-label`}>{t("host.language")}</span>
      <button
        ref={trigger}
        type="button"
        className="hostLanguageTrigger"
        aria-label={`${t("host.language")}: ${activeLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        title={activeLabel}
        onClick={() => open ? menu.current?.hidePopover() : showMenu()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            showMenu(event.key === "ArrowUp");
          }
        }}
      >
        <FlagIcon country={channel.locale.startsWith("fr") ? "ch" : "ar"} />
        <span>{channel.locale.split("-")[0].toUpperCase()}</span>
        {following ? <span className="hostLanguageFollow" aria-hidden="true">↻</span> : null}
        <span className={`languageMenuChevron ${open ? "languageMenuChevronOpen" : ""}`} aria-hidden="true">▾</span>
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        role="menu"
        aria-labelledby={`${id}-label`}
        className="hostLanguageMenu"
        style={{ top: position.top, left: position.left, "--station-accent": station.accentColor } as CSSProperties}
        onToggle={(event) => setOpen(event.newState === "open")}
        onKeyDown={onMenuKeyDown}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) menu.current?.hidePopover();
        }}
      >
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            role="menuitemradio"
            aria-checked={selection === option.value}
            tabIndex={-1}
            className={`hostLanguageOption ${option.country ? "" : "hostLanguageOptionFollow"}`}
            onClick={() => {
              onChange(option.value);
              menu.current?.hidePopover();
              trigger.current?.focus();
            }}
          >
            {option.country ? <FlagIcon country={option.country} /> : <span className="hostLanguageSync" aria-hidden="true">↻</span>}
            <span>{option.label}</span>
            <span className="hostLanguageCheck" aria-hidden="true">{selection === option.value ? "✓" : ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
