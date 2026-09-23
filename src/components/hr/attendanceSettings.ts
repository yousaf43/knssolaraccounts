import { useLocalStorage } from "@/hooks/useLocalStorage";

export type AttendanceSettings = {
  /** Official shift start, used to measure late arrival */
  shiftStart: string;
  /** Any punch before this time counts as a check-in, after it as a check-out */
  checkInCutoff: string;
  /** Official shift end, work after this becomes overtime */
  shiftEnd: string;
  /** Minutes of allowance before an arrival is marked late */
  graceMinutes: number;
  /** Minimum extra minutes before overtime starts counting */
  minOvertimeMinutes: number;
  /** Hours required for a full working day */
  fullDayHours: number;
};

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  shiftStart: "09:00",
  checkInCutoff: "10:00",
  shiftEnd: "18:00",
  graceMinutes: 15,
  minOvertimeMinutes: 30,
  fullDayHours: 8,
};

export function useAttendanceSettings(scope = "default") {
  return useLocalStorage<AttendanceSettings>(`hr-attendance-settings-v1-${scope}`, DEFAULT_ATTENDANCE_SETTINGS);
}

/** "09:35" -> 575 minutes. Returns null for empty/invalid values. */
export const toMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(mi)) return null;
  return h * 60 + mi;
};

export const minutesToLabel = (mins: number) => {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

export type DayEvaluation = {
  checkIn: string;
  checkOut: string;
  workedHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeHours: number;
  late: boolean;
};

/**
 * Applies the attendance rules to one day.
 * A punch recorded before the check-in cutoff is the arrival, a later one is the departure.
 * Time worked after the shift end (beyond the minimum) is counted as overtime.
 */
export function evaluateDay(
  record: { checkIn?: string | null; checkOut?: string | null; status?: string },
  s: AttendanceSettings,
): DayEvaluation {
  const cutoff = toMinutes(s.checkInCutoff) ?? 600;
  let inM = toMinutes(record.checkIn);
  let outM = toMinutes(record.checkOut);

  // Only one punch of the day: decide in/out by the cutoff time.
  if (inM !== null && outM === null && inM > cutoff) {
    outM = inM;
    inM = null;
  }
  if (outM !== null && inM !== null && outM < inM) {
    const tmp = inM;
    inM = outM;
    outM = tmp;
  }

  const paid = !record.status || record.status === "present" || record.status === "half-day";
  const start = toMinutes(s.shiftStart) ?? 540;
  const end = toMinutes(s.shiftEnd) ?? 1080;

  const workedMins = paid && inM !== null && outM !== null ? Math.max(0, outM - inM) : 0;
  const lateMinutes = paid && inM !== null ? Math.max(0, inM - (start + (s.graceMinutes || 0))) : 0;
  const earlyLeaveMinutes = paid && outM !== null ? Math.max(0, end - outM) : 0;
  const overMins = paid && outM !== null ? Math.max(0, outM - end) : 0;
  const overtimeHours = overMins >= (s.minOvertimeMinutes || 0) ? Math.round((overMins / 60) * 100) / 100 : 0;

  const fmt = (m: number | null) => {
    if (m === null) return "";
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };

  return {
    checkIn: fmt(inM),
    checkOut: fmt(outM),
    workedHours: Math.round((workedMins / 60) * 100) / 100,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeHours,
    late: lateMinutes > 0,
  };
}
