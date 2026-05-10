import { CalendarDays, Clock3 } from "lucide-react";
import {
  facilities,
  scheduleDays,
} from "@/features/workspace/data/static-demo";

export function ScheduleView() {
  return (
    <section className="viewStack">
      <div className="viewToolbar" aria-label="予定操作">
        <div className="segmentedControl" aria-label="表示期間">
          <button className="active" type="button">今日</button>
          <button type="button">週</button>
          <button type="button">月</button>
        </div>
        <button className="textButton primary" type="button">
          <CalendarDays aria-hidden="true" size={17} />
          予定を登録
        </button>
      </div>

      <section className="scheduleBoard" aria-label="予定一覧">
        {scheduleDays.map((day) => (
          <article className="panel dayColumn" key={day.label}>
            <div className="panelHeader compact">
              <div>
                <p className="sectionLabel">{day.label}</p>
                <h2>{day.date}</h2>
              </div>
              <Clock3 aria-hidden="true" className="panelIcon" size={20} />
            </div>
            <div className="timeline">
              {day.events.map(([time, title, place]) => (
                <article className="timelineItem compact" key={`${day.label}-${time}`}>
                  <time>{time}</time>
                  <div>
                    <h3>{title}</h3>
                    <p>{place}</p>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="quickCards" aria-label="施設予約状況">
        {facilities.map((facility) => (
          <article className="panel facilityCard" key={facility.name}>
            <div>
              <p className="sectionLabel">施設予約</p>
              <h2>{facility.name}</h2>
              <p>{facility.next}</p>
            </div>
            <span className={`statusPill ${facility.tone}`}>{facility.status}</span>
          </article>
        ))}
      </section>
    </section>
  );
}
