export const nowIso = () => new Date().toISOString();

const toMinutes = (hhmm) => {
  const [h = "0", m = "0"] = (hhmm || "0:0").split(":");
  return Number(h) * 60 + Number(m);
};

const getHoursMinutesInTimezone = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return { hour: Number(hour), minute: Number(minute) };
};

export const isWithinBusinessHours = ({ timezone, start, end, at = new Date() }) => {
  const current = getHoursMinutesInTimezone(at, timezone);
  const currentMinutes = current.hour * 60 + current.minute;
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};
