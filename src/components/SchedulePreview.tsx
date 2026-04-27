"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { addDaysToDateString, getZonedDateString, zonedDateTimeToUtcMillis } from "@/lib/dateTime";
import { segmentDetail, segmentTitle } from "@/lib/schedule";
import type { ScheduleSegment, Station, StationScheduleState } from "@/types/radio";

interface SchedulePreviewProps {
  station: Station;
  schedule: StationScheduleState;
}

const MINUTES_PER_DAY = 24 * 60;
const HOUR_MARKS = Array.from({ length: 24 }, (_, hour) => hour);

export function SchedulePreview({ station, schedule }: SchedulePreviewProps) {
  const segments = schedule.segments ?? [];
  const [now, setNow] = useState(() => new Date());
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const lastScrollKeyRef = useRef<string | undefined>(undefined);
  const scheduleDate = schedule.date ?? getZonedDateString(now, station.timeZone);
  const todayDate = getZonedDateString(now, station.timeZone);
  const nowMinutes = todayDate === scheduleDate ? getMinuteOfDay(now, station.timeZone) : undefined;
  const nowPercent = nowMinutes === undefined ? undefined : (nowMinutes / MINUTES_PER_DAY) * 100;
  const dayStartMillis = zonedDateTimeToUtcMillis(scheduleDate, station.timeZone);
  const dayEndMillis = zonedDateTimeToUtcMillis(addDaysToDateString(scheduleDate, 1), station.timeZone);
  const timelineBlocks = useMemo(
    () =>
      segments
        .map((segment) => getTimelineBlock(segment, station.timeZone, dayStartMillis, dayEndMillis))
        .filter((block) => block.heightPercent > 0),
    [dayEndMillis, dayStartMillis, segments, station.timeZone]
  );
  const scrollKey = `${station.id}:${scheduleDate}:${timelineBlocks.length}`;

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
          "--station-accent": station.accentColor
        } as CSSProperties
      }
      aria-labelledby="schedule-title"
    >
      <div className="sectionEyebrow">Today in Zurich</div>
      <div className="scheduleHeader">
        <div>
          <h2 id="schedule-title">{station.name} schedule</h2>
          <p>{schedule.error ? schedule.error : "Live blocks are derived from the public AzuraCast schedule."}</p>
        </div>
        <span>{schedule.isLoading ? "Loading" : `${segments.length} blocks`}</span>
      </div>

      <div className="scheduleSummaryGrid">
        <ScheduleSummaryItem label="Live now" segment={schedule.liveSegment} />
        <ScheduleSummaryItem label="Up next" segment={schedule.upNextSegment} />
      </div>

      {segments.length === 0 ? (
        <div className="scheduleEmpty">{schedule.isLoading ? "Loading schedule." : "Schedule unavailable."}</div>
      ) : (
        <div className="scheduleTimelineShell">
          <div className="scheduleTimelineToolbar">
            <span>24 hour view</span>
            <span>{nowMinutes === undefined ? scheduleDate : `Now ${formatClock(now, station.timeZone)}`}</span>
          </div>

          <div className="scheduleTimelineViewport" ref={timelineRef}>
            <div className="scheduleTimeline" aria-label={`${station.name} 24 hour schedule for ${scheduleDate}`}>
              <div className="scheduleTimeGutter" aria-hidden="true">
                {HOUR_MARKS.map((hour) => (
                  <span
                    key={hour}
                    style={
                      {
                        top: `${(hour / 24) * 100}%`
                      } as CSSProperties
                    }
                  >
                    {hour.toString().padStart(2, "0")}:00
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
                    aria-label={`Current time ${formatClock(now, station.timeZone)}`}
                  >
                    <span>{formatClock(now, station.timeZone)}</span>
                  </div>
                )}

                {timelineBlocks.map((block) => (
                  <article
                    key={`${block.segment.startTime}-${block.segment.endTime}`}
                    className={`timelineBlock ${block.segment.kind} ${
                      block.durationMinutes < 45 ? "timelineBlockShort" : ""
                    }`}
                    style={
                      {
                        top: `${block.topPercent}%`,
                        height: `${block.heightPercent}%`
                      } as CSSProperties
                    }
                    role="listitem"
                  >
                    <time>{formatRange(block.segment, station.timeZone)}</time>
                    <strong>{segmentTitle(block.segment)}</strong>
                    <span className="timelineDetail">{segmentDetail(block.segment)}</span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ScheduleSummaryItem({ label, segment }: { label: string; segment?: ScheduleSegment }) {
  return (
    <div className="scheduleSummaryItem">
      <span>{label}</span>
      <strong>{segmentTitle(segment)}</strong>
      <em>{segmentDetail(segment)}</em>
    </div>
  );
}

function formatRange(segment: ScheduleSegment, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
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
  timeZone: string,
  dayStartMillis: number,
  dayEndMillis: number
): TimelineBlock {
  const startMinute = getMinutePosition(segment.startTime, timeZone, dayStartMillis, dayEndMillis);
  const endMinute = getMinutePosition(segment.endTime, timeZone, dayStartMillis, dayEndMillis);
  const durationMinutes = Math.max(0, endMinute - startMinute);

  return {
    segment,
    topPercent: (startMinute / MINUTES_PER_DAY) * 100,
    heightPercent: (durationMinutes / MINUTES_PER_DAY) * 100,
    durationMinutes
  };
}

function getMinutePosition(
  isoTime: string,
  timeZone: string,
  dayStartMillis: number,
  dayEndMillis: number
): number {
  const millis = Date.parse(isoTime);

  if (!Number.isFinite(millis) || millis <= dayStartMillis) {
    return 0;
  }

  if (millis >= dayEndMillis) {
    return MINUTES_PER_DAY;
  }

  return getMinuteOfDay(new Date(millis), timeZone);
}

function getMinuteOfDay(date: Date, timeZone: string): number {
  const parts = getClockParts(date, timeZone);
  return clamp(parts.hour * 60 + parts.minute + parts.second / 60, 0, MINUTES_PER_DAY);
}

function formatClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function getClockParts(date: Date, timeZone: string): { hour: number; minute: number; second: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
