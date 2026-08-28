"use client";

import { useState, useTransition } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl.js";
import {
  CalendarDays,
  Clock3,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Plus,
  ReceiptText,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { createAbsenceAction, saveAvailabilityAction } from "./actions";
import {
  minutesOfEligibleAvailability,
  startOfWarsawWeek,
  type AvailabilityExceptionInput,
  type WeeklyAvailabilityInput,
} from "@/lib/therapist-calendar";
import type { TherapistPanelData } from "@/lib/therapist-data";
import type { Appointment } from "@/lib/appointments";
import "./panel.css";

const FULL_DAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function localDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date(iso));
}

function localTime(iso: string) {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function appointmentClass(id: string) {
  if (id === "niskoplatna") return "visit--community";
  if (id === "bezplatna") return "visit--free";
  if (id === "pelnoplatna") return "visit--paid";
  return "visit--diagnostic";
}

function statusLabel(status: Appointment["status"]) {
  return { held: "Czeka na płatność", confirmed: "Potwierdzona", completed: "Odbyta", no_show: "Nieobecność", cancelled: "Anulowana" }[status];
}

type Props = { data: TherapistPanelData };

export function TherapistPanel({ data }: Props) {
  const [section, setSection] = useState<"calendar" | "availability">("calendar");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const weekStart = startOfWarsawWeek(new Date());
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const visibleAppointments = data.appointments.filter((appointment) => appointment.status !== "cancelled");
  const upcomingCount = visibleAppointments.filter((a) => new Date(a.startsAt) >= new Date() && a.status !== "completed" && a.status !== "no_show").length;

  const calendarEvents = [
    ...visibleAppointments.map((appointment) => ({
      id: appointment.id,
      title: `${appointment.patient.name} · ${appointment.service.title}`,
      start: appointment.startsAt,
      end: new Date(new Date(appointment.startsAt).getTime() + appointment.service.durationMinutes * 60_000).toISOString(),
      classNames: ["fc-visit", appointmentClass(appointment.serviceId)],
      extendedProps: { appointmentId: appointment.id },
    })),
    ...data.exceptions.map((exception) => ({
      id: `absence-${exception.id}`,
      title: exception.reason ? `Nieobecność · ${exception.reason}` : "Nieobecność",
      start: `${exception.date}T${exception.startTime}:00`,
      end: `${exception.date}T${exception.endTime}:00`,
      classNames: ["fc-absence"],
      extendedProps: { absence: true },
    })),
  ];

  return (
    <div className="therapist-app">
      <aside className={`therapist-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand"><span className="brand-mark">N</span><span>Niepodzielni</span><button className="mobile-close" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
        <div className="profile-card"><span className="avatar">AK</span><div><strong>{data.practitioner.name}</strong><small>psychoterapeutka</small></div></div>
        <nav className="panel-nav" aria-label="Panel specjalisty">
          <button disabled><LayoutDashboard size={18}/>Pulpit</button>
          <button disabled><Users size={18}/>Wizyty <span className="nav-count">{upcomingCount}</span></button>
          <button className={section === "calendar" ? "active" : ""} onClick={() => { setSection("calendar"); setMenuOpen(false); }}><CalendarDays size={18}/>Kalendarz</button>
          <button className={section === "availability" ? "active" : ""} onClick={() => { setSection("availability"); setMenuOpen(false); }}><Clock3 size={18}/>Dostępność</button>
          <button disabled><FileText size={18}/>Wydarzenia</button>
          <button disabled><ReceiptText size={18}/>Rozliczenia</button>
          <button disabled><MessageSquare size={18}/>Wiadomości</button>
        </nav>
        <div className="sidebar-bottom"><button disabled><Settings2 size={18}/>Ustawienia</button><p>Panel demonstracyjny</p></div>
      </aside>

      {menuOpen && <button className="sidebar-backdrop" aria-label="Zamknij menu" onClick={() => setMenuOpen(false)} />}

      <main className="panel-main">
        <header className="panel-topbar"><button className="mobile-menu" onClick={() => setMenuOpen(true)}><Menu size={21}/></button><span>Panel specjalisty</span><div className="topbar-person"><span className="status-dot"/>Dostępna</div></header>
        {section === "calendar" ? (
          <div className="panel-content">
            <div className="page-heading"><div><p className="eyebrow">Twój grafik</p><h1>Kalendarz</h1><p>Wizyty, dostępność i nieobecności w jednym miejscu.</p></div><button className="primary-action" onClick={() => setAbsenceOpen(true)}><Plus size={17}/>Oznacz nieobecność</button></div>
            <section className="summary-grid">
              <Summary label="Wizyty w tym tygodniu" value={String(visibleAppointments.filter(a => weekDates.includes(localDate(a.startsAt))).length)} note="bez anulowanych" />
              <Summary label="Najbliższa wizyta" value={visibleAppointments.find(a => new Date(a.startsAt) > new Date()) ? localTime(visibleAppointments.find(a => new Date(a.startsAt) > new Date())!.startsAt) : "—"} note="według czasu Warszawa" />
              <Summary label="Godziny społeczne" value={`${Math.floor(minutesOfEligibleAvailability(data.availability) / 60)} h`} note="wymagane minimum 5 h" positive />
            </section>
            <section className="calendar-card fullcalendar-wrap">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                locale={plLocale}
                firstDay={1}
                headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,dayGridMonth" }}
                buttonText={{ today: "Dzisiaj", week: "Tydzień", month: "Miesiąc" }}
                allDaySlot={false}
                slotMinTime="08:00:00"
                slotMaxTime="20:00:00"
                slotDuration="00:30:00"
                nowIndicator
                height="auto"
                events={calendarEvents}
                eventClick={(info) => {
                  const appointmentId = info.event.extendedProps.appointmentId as string | undefined;
                  if (appointmentId) setSelected(visibleAppointments.find((item) => item.id === appointmentId) ?? null);
                }}
                eventContent={(info) => info.event.extendedProps.absence
                  ? <div className="fc-event-copy"><b>Nieobecność</b><span>{info.event.title.replace("Nieobecność · ", "")}</span></div>
                  : <div className="fc-event-copy"><b>{info.timeText}</b><span>{info.event.title}</span></div>}
              />
            </section>
          </div>
        ) : <AvailabilityEditor initial={data.availability} onBack={() => setSection("calendar")} />}
      </main>
      {selected && <AppointmentModal appointment={selected} all={visibleAppointments} onClose={() => setSelected(null)} />}
      {absenceOpen && <AbsenceModal onClose={() => setAbsenceOpen(false)} />}
    </div>
  );
}

function Summary({ label, value, note, positive = false }: { label: string; value: string; note: string; positive?: boolean }) {
  return <div className="summary-card"><span>{label}</span><strong>{value}</strong><small className={positive ? "positive" : ""}>{note}</small></div>;
}

function AppointmentModal({ appointment, all, onClose }: { appointment: Appointment; all: Appointment[]; onClose:()=>void }) {
  const history=all.filter(a=>a.patientId===appointment.patientId&&a.id!==appointment.id&&new Date(a.startsAt)<new Date(appointment.startsAt));
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="panel-modal" role="dialog" aria-modal="true" aria-labelledby="visit-title" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={20}/></button><p className="eyebrow">Szczegóły wizyty</p><h2 id="visit-title">{appointment.patient.name}</h2><p className="modal-subtitle">{formatLongDate(appointment.startsAt)} · {localTime(appointment.startsAt)}</p><dl className="detail-list"><div><dt>Usługa</dt><dd>{appointment.service.title}</dd></div><div><dt>Status</dt><dd><span className="status-badge">{statusLabel(appointment.status)}</span></dd></div><div><dt>E-mail</dt><dd>{appointment.patient.email || "—"}</dd></div><div><dt>Telefon</dt><dd>{appointment.patient.phone}</dd></div><div><dt>Płatność</dt><dd>{appointment.paymentStatus === "paid" ? "Opłacona" : appointment.paymentStatus === "pending" ? "Oczekuje" : "Zwrot do wykonania"}</dd></div></dl><div className="history-box"><b>Historia pacjenta</b><p>{history.length ? `${history.length} wcześniejsze wizyty w fundacji. Ostatnia: ${formatLongDate(history.at(-1)!.startsAt)}.` : "To pierwsza wizyta tej osoby w fundacji."}</p></div></section></div>;
}

function AvailabilityEditor({ initial, onBack }: { initial: TherapistPanelData["availability"]; onBack:()=>void }) {
  const [ranges,setRanges]=useState<WeeklyAvailabilityInput[]>(initial.map((item)=>({ weekday:item.weekday,startTime:item.startTime,endTime:item.endTime,serviceType:item.serviceType }))); const [pending,startTransition]=useTransition(); const [message,setMessage]=useState<{ok:boolean;text:string}|null>(null); const minutes=minutesOfEligibleAvailability(ranges);
  function update(index:number, patch:Partial<WeeklyAvailabilityInput>){setRanges(r=>r.map((item,i)=>i===index?{...item,...patch}:item));}
  function save(){startTransition(async()=>{const result=await saveAvailabilityAction(ranges);setMessage({ok:result.ok,text:result.message});});}
  return <div className="panel-content availability-page"><div className="page-heading"><div><p className="eyebrow">Powtarzalny tydzień</p><h1>Dostępność</h1><p>Ustal godziny wizyt 55 zł i Darmowych. Zmiany nie odwołują istniejących wizyt.</p></div><button className="secondary-action" onClick={onBack}>Wróć do kalendarza</button></div><section className="availability-layout"><div className="availability-card"><div className="requirement"><div><span>Obowiązkowe godziny społeczne</span><strong>{Math.floor(minutes/60)} h {minutes%60 ? `${minutes%60} min` : ""} / 5 h</strong></div><div className="progress"><i style={{width:`${Math.min(100,minutes/3)}%`}}/></div><small>Łącznie wizyty 55 zł i Darmowe</small></div><div className="range-list">{ranges.map((r,i)=><div className="range-row" key={i}><select value={r.weekday} onChange={e=>update(i,{weekday:Number(e.target.value)})}>{FULL_DAYS.map((d,idx)=><option value={idx+1} key={d}>{d}</option>)}</select><input type="time" value={r.startTime} onChange={e=>update(i,{startTime:e.target.value})}/><span>–</span><input type="time" value={r.endTime} onChange={e=>update(i,{endTime:e.target.value})}/><select value={r.serviceType} onChange={e=>update(i,{serviceType:e.target.value as "niskoplatna"|"bezplatna"})}><option value="niskoplatna">55 zł</option><option value="bezplatna">Darmowe</option></select><button className="remove-range" onClick={()=>setRanges(v=>v.filter((_,x)=>x!==i))}><X size={17}/></button></div>)}</div><button className="add-range" onClick={()=>setRanges(r=>[...r,{weekday:1,startTime:"09:00",endTime:"10:00",serviceType:"niskoplatna"}])}><Plus size={16}/>Dodaj przedział</button>{message&&<p className={message.ok?"form-success":"form-error"}>{message.text}</p>}<div className="form-footer"><button className="primary-action" disabled={minutes<300||pending} onClick={save}>{pending?"Zapisywanie…":"Zapisz grafik"}</button></div></div><aside className="info-card"><Clock3/><h3>Jak działa grafik?</h3><p>Ustawiasz stały rytm tygodnia. Pojedyncze urlopy i szkolenia oznaczasz w kalendarzu jako nieobecność.</p><p>Już umówione wizyty pozostają bez zmian, nawet jeśli później zmienisz dostępność.</p></aside></section></div>;
}

function AbsenceModal({onClose}:{onClose:()=>void}) { const today=localDate(new Date().toISOString()); const [form,setForm]=useState<AvailabilityExceptionInput>({date:today,startTime:"09:00",endTime:"17:00",reason:""}); const [pending,startTransition]=useTransition(); const [result,setResult]=useState<{ok:boolean;message:string;conflicts?:string[]}|null>(null); function save(){startTransition(async()=>{const r=await createAbsenceAction(form);setResult(r);if(r.ok&&!r.conflicts?.length)setTimeout(onClose,700);});} return <div className="modal-backdrop" onMouseDown={onClose}><section className="panel-modal absence-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={20}/></button><p className="eyebrow">Wyjątek w grafiku</p><h2>Oznacz nieobecność</h2><label>Data<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><div className="two-fields"><label>Od<input type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></label><label>Do<input type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></label></div><label>Powód (opcjonalnie)<input value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="np. szkolenie"/></label><p className="warning-box">Nieobecność blokuje nowe rezerwacje, ale nie odwołuje istniejących wizyt.</p>{result&&<div className={result.ok?"form-success":"form-error"}>{result.message}{result.conflicts?.length?<small>Wizyty: {result.conflicts.join(", ")}</small>:null}</div>}<div className="modal-actions"><button className="secondary-action" onClick={onClose}>Anuluj</button><button className="primary-action" disabled={pending} onClick={save}>{pending?"Zapisywanie…":"Zapisz nieobecność"}</button></div></section></div>; }
