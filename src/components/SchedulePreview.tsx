import { segmentDetail, segmentTitle } from "@/lib/schedule";
import type { ScheduleSegment, Station, StationScheduleState } from "@/types/radio";

interface SchedulePreviewProps {
  station: Station;
  schedule: StationScheduleState;
}

export function SchedulePreview({ station, schedule }: SchedulePreviewProps) {
  const segments = schedule.segments ?? [];

  return (
    <section
      className="schedulePanel"
      style={
        {
          "--station-accent": station.accentColor
        } as React.CSSProperties
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

      <ol className="scheduleList">
        {segments.length === 0 && !schedule.isLoading ? (
          <li className="scheduleEmpty">Schedule unavailable.</li>
        ) : null}
        {segments.map((segment) => (
          <li key={`${segment.startTime}-${segment.endTime}`} className={`scheduleRow ${segment.kind}`}>
            <time>{formatRange(segment, station.timeZone)}</time>
            <div>
              <strong>{segmentTitle(segment)}</strong>
              <span>{segmentDetail(segment)}</span>
            </div>
          </li>
        ))}
      </ol>
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
