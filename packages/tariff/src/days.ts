import type { TariffRule } from "./types.js";

/**
 * The functions in this module read the *local* timezone of the JavaScript
 * runtime. Parking rules are stated in Stockholm time, so callers must
 * ensure the Date was constructed in Europe/Stockholm time. Browsers on
 * Swedish devices satisfy this automatically. Server-side callers (e.g.,
 * future SSR or scheduled jobs in CI) must convert dates to Stockholm
 * local parts before calling these helpers.
 */

export function dayOfWeekFor(date: Date): number {
  return date.getDay();
}

export function hourOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function ruleAppliesAt(rule: TariffRule, at: Date): boolean {
  const dow = dayOfWeekFor(at);
  const hour = hourOf(at);
  const dayMatches = rule.daysOfWeek.length === 0 || rule.daysOfWeek.includes(dow);
  const hourMatches = hour >= rule.hourStart && hour < rule.hourEnd;
  return dayMatches && hourMatches;
}
