export function parseNaturalFollowUpDate(text: string, previous?: Date | null, now = new Date()) {
  const normalized = text.toLocaleLowerCase("es-ES").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const date = new Date(now);
  const hourMatch = normalized.match(/(?:a las|las)\s+(\d{1,2})(?::(\d{2}))?/);
  const hour = hourMatch ? Number(hourMatch[1]) : previous?.getHours() ?? 9;
  const minute = hourMatch ? Number(hourMatch[2] ?? 0) : previous?.getMinutes() ?? 0;
  const add = (days: number) => date.setDate(date.getDate() + days);
  if (/pasado manana/.test(normalized)) add(2);
  else if (/manana/.test(normalized)) add(1);
  else if (/proxima semana/.test(normalized)) add(7);
  else if (/dentro de (\d+) dias/.test(normalized)) add(Number(normalized.match(/dentro de (\d+) dias/)?.[1]));
  else if (/dentro de cinco dias/.test(normalized)) add(5);
  else {
    const weekdays: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
    const weekday = Object.entries(weekdays).find(([name]) => normalized.includes(name));
    if (weekday) { let delta = (weekday[1] - date.getDay() + 7) % 7; if (!delta || normalized.includes("que viene")) delta += 7; add(delta); }
    else {
      const explicit = normalized.match(/(?:el )?(\d{1,2}) de ([a-z]+)/);
      if (explicit) { const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]; date.setMonth(months.indexOf(explicit[2]), Number(explicit[1])); if (date < now) date.setFullYear(date.getFullYear() + 1); }
      else if (!/hoy/.test(normalized)) return null;
    }
  }
  date.setHours(hour, minute, 0, 0);
  return date;
}
