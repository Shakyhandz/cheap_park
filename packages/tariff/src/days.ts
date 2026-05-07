import type { TariffRule } from "./types.js";

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
