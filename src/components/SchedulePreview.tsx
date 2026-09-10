"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getSegmentDetail, getSegmentTitle, useI18n } from "@/lib/i18n";
import { addDaysToDateString, getZonedDateString, zonedDateTimeToUtcMillis } from "@/lib/dateTime";
import type { Locale } from "@/lib/locale";
import type { ScheduleSegment, Station, StationScheduleState } from "@/types/radio";

interface SchedulePreviewProps {
  station: Station;
  schedule: StationScheduleState;
}

const HOUR_MILLIS = 60 * 60 * 1000;

export function SchedulePreview({ station, schedule }: SchedulePreviewProps) {
  const { locale, t } = useI18n();
  const segments = schedule.segments ?? [];
  const [now, setNow] = useState(() => new Date());
  const [timeZone, setTimeZone] = useState(station.timeZone);
  const [selectedBlock, setSelectedBlock] = useState<TimelineBlock | undefined>(undefined);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const lastScrollKeyRef = useRef<string | undefined>(undefined);
  const scheduleDate = schedule.date ?? getZonedDateString(now, station.timeZone);
  const dayStartMillis = zonedDateTimeToUtcMillis(scheduleDate, station.timeZone);
  const dayEndMillis = zonedDateTimeToUtcMillis(addDaysToDateString(scheduleDate, 1), station.timeZone);
  const dayDuration = dayEndMillis - dayStartMillis;
  const nowPercent = now.getTime() >= dayStartMillis && now.getTime() < dayEndMillis
    ? ((now.getTime() - dayStartMillis) / dayDuration) * 100
    : undefined;
  const hourMarks = Array.from({ length: Math.ceil(dayDuration / HOUR_MILLIS) }, (_, hour) =>
    new Date(dayStartMillis + hour * HOUR_MILLIS)
  );
  const dateFormatter = new Intl.DateTimeFormat(locale, { timeZone, month: "short", day: "numeric" });
  const dateRange = `${dateFormatter.format(new Date(dayStartMillis))} – ${dateFormatter.format(new Date(dayEndMillis))}`;
  const timelineBlocks = useMemo(
    () => segments
      .map((segment) => getTimelineBlock(segment, dayStartMillis, dayEndMillis))
      .filter((block) => block.heightPercent > 0),
    [dayEndMillis, dayStartMillis, segments]
  );
  const scrollKey = `${station.id}:${scheduleDate}:${timeZone}:${timelineBlocks.length}`;

  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || station.timeZone);
    } catch {
      setTimeZone(station.timeZone);
    }
  }, [station.timeZone]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const viewport = timelineRef.current;

    if (!viewport || nowPercent === undefined || lastScrollKeyRef.current === scrollKey) {
      return;
    }

    lastScrollKeyRef.current = scrollKey;
    const scrollTarget = (nowPercent / 100) * viewport.scrollHeight - viewport.clientHeight * 0.38;
    viewport.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
  }, [nowPercent, scrollKey]);

  return (
    <section
      className="schedulePanel"
      style={
        {
          "--station-accent": station.accentColor,
          "--station-bg": `url(${station.backgroundImage})`
        } as CSSProperties
      }
      aria-labelledby="schedule-title"
    >
      <div className="scheduleHeader">
        <div>
          <span className="scheduleKicker">{station.name}</span>
          <h2 id="schedule-title">{t("schedule.title", { station: station.name })}</h2>
          <p>{schedule.error ? schedule.error : t("schedule.description")}</p>
          <p>{t("schedule.weeklyNote")}</p>
        </div>
      </div>

      {segments.length === 0 ? (
        <div className="scheduleEmpty">{schedule.isLoading ? `${t("common.loading")}...` : t("schedule.empty")}</div>
      ) : (
        <div className="scheduleTimelineShell">
          <div className="scheduleTimelineToolbar">
            <span>{t("schedule.toolbar", { timeZone: timeZone.replaceAll("_", " "), date: dateRange })}</span>
            <span>{nowPercent === undefined ? scheduleDate : t("schedule.now", { time: formatClock(now, timeZone, locale) })}</span>
          </div>

          <div className="scheduleTimelineViewport" ref={timelineRef}>
            <div className="scheduleTimeline" aria-label={t("schedule.ariaLabel", { station: station.name, date: scheduleDate })}>
              <div className="scheduleTimeGutter" aria-hidden="true">
                {hourMarks.map((mark) => (
                  <span
                    key={mark.toISOString()}
                    style={
                      {
                        top: `${((mark.getTime() - dayStartMillis) / dayDuration) * 100}%`
                      } as CSSProperties
                    }
                  >
                    {formatClock(mark, timeZone, locale)}
                  </span>
                ))}
              </div>

              <div className="scheduleTrack" role="list">
                {nowPercent === undefined ? null : (
                  <div
                    className="scheduleNowLine"
                    style={
                      {
                        top: `${nowPercent}%`
                      } as CSSProperties
                    }
                    aria-label={`${t("schedule.now", { time: formatClock(now, timeZone, locale) })}`}
                  >
                    <span>{formatClock(now, timeZone, locale)}</span>
                  </div>
                )}

                {timelineBlocks.map((block) => (
                  <TimelineBlockItem
                    key={`${block.segment.startTime}-${block.segment.endTime}`}
                    block={block}
                    locale={locale}
                    timeZone={timeZone}
                    onSelect={setSelectedBlock}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBlock ? (
        <ScheduleBlockDetails
          block={selectedBlock}
          locale={locale}
          timeZone={timeZone}
          onClose={() => setSelectedBlock(undefined)}
        />
      ) : null}
    </section>
  );
}

interface TimelineBlockItemProps {
  block: TimelineBlock;
  locale: Locale;
  timeZone: string;
  onSelect: (block: TimelineBlock) => void;
}

function TimelineBlockItem({ block, locale, timeZone, onSelect }: TimelineBlockItemProps) {
  const { segment } = block;
  const isShort = block.durationMinutes < 75;
  const isMedium = block.durationMinutes >= 75 && block.durationMinutes < 105;
  const detail = getSegmentDetail(segment, locale);

  return (
    <button
      type="button"
      className={`timelineBlock ${segment.kind} ${isShort ? "timelineBlockShort" : ""} ${isMedium ? "timelineBlockMedium" : ""}`}
      style={
        {
          top: `${block.topPercent}%`,
          height: `${block.heightPercent}%`
        } as CSSProperties
      }
      role="listitem"
      onClick={() => onSelect(block)}
      title={detail}
    >
      <time>{formatRange(segment, timeZone, locale)}</time>
      <strong>{getSegmentTitle(segment, locale)}</strong>
      {!isShort ? <span className="timelineDetail">{detail}</span> : null}
    </button>
  );
}

function ScheduleBlockDetails({
  block,
  locale,
  timeZone,
  onClose
}: {
  block: TimelineBlock;
  locale: Locale;
  timeZone: string;
  onClose: () => void;
}) {
  const { segment } = block;
  return (
    <div className="scheduleBlockDetailsBackdrop" role="presentation" onClick={onClose}>
      <section
        className="scheduleBlockDetails"
        role="dialog"
        aria-modal="true"
        aria-label={getSegmentTitle(segment, locale)}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="scheduleBlockDetailsClose" onClick={onClose} aria-label="Close schedule details">×</button>
        <time>{formatRange(segment, timeZone, locale)}</time>
        <h3>{getSegmentTitle(segment, locale)}</h3>
        <p>{getSegmentDetail(segment, locale)}</p>
        {segment.playlistNames.length > 1 ? <small>{segment.playlistNames.join(" · ")}</small> : null}
      </section>
    </div>
  );
}

function formatRange(segment: ScheduleSegment, timeZone: string, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  return `${formatter.format(new Date(segment.startTime))} - ${formatter.format(new Date(segment.endTime))}`;
}

interface TimelineBlock {
  segment: ScheduleSegment;
  topPercent: number;
  heightPercent: number;
  durationMinutes: number;
}

function getTimelineBlock(
  segment: ScheduleSegment,
  dayStartMillis: number,
  dayEndMillis: number
): TimelineBlock {
  const duration = dayEndMillis - dayStartMillis;
  const start = clamp(Date.parse(segment.startTime), dayStartMillis, dayEndMillis);
  const end = clamp(Date.parse(segment.endTime), dayStartMillis, dayEndMillis);
  const visibleDuration = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;

  return {
    segment,
    topPercent: Number.isFinite(start) ? ((start - dayStartMillis) / duration) * 100 : 0,
    heightPercent: (visibleDuration / duration) * 100,
    durationMinutes: visibleDuration / 60_000
  };
}

function formatClock(date: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
