import type { TableStatus } from "./api";

export const JOINABLE_STATUSES: readonly TableStatus[] = [
  "available",
  "confirmed_unpaid",
  "confirmed_paid",
];

export function isJoinable(status: TableStatus): boolean {
  return (JOINABLE_STATUSES as readonly string[]).includes(status);
}

export function isRequested(status: TableStatus): boolean {
  return status === "requested";
}
