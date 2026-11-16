import { useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth, subMonths } from "date-fns-jalali";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const jalali = (d: Date) => format(d, "yyyy/MM/dd");
const weekdays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export default function JalaliDateField({ value, onChange, label = "تاریخ شمسی" }: { value: Date; onChange: (date: Date) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(startOfMonth(value));
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const offset = (getDay(startOfMonth(month)) + 1) % 7;
  return <label>{label}<div className="tx-date-wrap"><input readOnly value={jalali(value)} onClick={() => { setMonth(startOfMonth(value)); setOpen(v => !v); }} /><button type="button" onClick={() => { setMonth(startOfMonth(value)); setOpen(v => !v); }}><CalendarDays size={16}/></button>{open && <div className="tx-calendar"><div className="tx-calendar-head"><button type="button" onClick={() => setMonth(m => addMonths(m, 1))}><ChevronRight size={16}/></button><b>{format(month, "MMMM yyyy")}</b><button type="button" onClick={() => setMonth(m => subMonths(m, 1))}><ChevronLeft size={16}/></button></div><div className="tx-calendar-grid">{weekdays.map(d => <span key={d}>{d}</span>)}{Array.from({ length: offset }, (_, i) => <i key={`b${i}`}/>)}{days.map(d => <button type="button" key={d.toISOString()} className={jalali(d) === jalali(value) ? "selected" : ""} onClick={() => { onChange(d); setOpen(false); }}>{format(d, "d")}</button>)}</div><div className="tx-calendar-foot"><button type="button" onClick={() => { onChange(new Date()); setOpen(false); }}>امروز</button><button type="button" onClick={() => setOpen(false)}>بستن</button></div></div>}</div></label>;
}
