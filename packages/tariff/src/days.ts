import type { TariffRule } from "./types.js";
import type { Calendar, DayClass } from "./holidays.js";
import { dayClassOf } from "./holidays.js";
import { wallClockParts } from "./wallclock.js";

export type EvalContext = { timeZone: string; calendar: Calendar };

export function dayOfWeekFor(instant: Date, ctx: EvalContext): number {
  return wallClockParts(instant, ctx.timeZone).weekday;
}

export function hourOf(instant: Date, ctx: EvalContext): number {
  return wallClockParts(instant, ctx.timeZone).hour;
}

export function ruleAppliesAt(rule: TariffRule, at: Date, ctx: EvalContext): boolean {
  const wc = wallClockParts(at, ctx.timeZone);
  const dayMatches = rule.daysOfWeek.length === 0 || rule.daysOfWeek.includes(wc.weekday);
  const classMatches =
    !rule.dayClasses ||
    rule.dayClasses.length === 0 ||
    rule.dayClasses.includes(dayClassOf(at, ctx) as DayClass);
  const hourMatches = wc.hour >= rule.hourStart && wc.hour < rule.hourEnd;
  return dayMatches && classMatches && hourMatches;
}
