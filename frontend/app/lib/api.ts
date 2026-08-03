export type Role = "USER" | "VENUE_USER" | "ADMIN";

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  venue: number | null;
  allow_invites: boolean;
  rating_avg: number | null;
  cancellations_count: number;
  late_cancel_marks_active: number;
}

export interface Review {
  id: number;
  author: number;
  author_name: string;
  target_type: "user" | "venue";
  target_user: number | null;
  target_venue: number | null;
  rating: number;
  body: string;
  created_at: string;
}

export type TableStatus =
  | "waiting_for_venue_confirmation"
  | "waiting_for_players"
  | "confirmed"
  | "cancelled"
  | "completed";

export interface Table {
  id: number;
  organizer: number;
  venue: number;
  game_title: string;
  bring_own_game: boolean;
  game_language: "en" | "de" | "other";
  game_language_other: string;
  venue_game_confirmed: boolean;
  starts_at: string;
  ends_at: string;
  min_players: number;
  max_players: number;
  status: TableStatus;
  seats_taken: number;
  created_at: string;
}

export interface Seat {
  id: number;
  table: number;
  user: number;
  is_organizer: boolean;
  status: "reserved" | "waitlisted" | "cancelled";
  waitlist_position: number | null;
}

export interface Venue {
  id: number;
  name: string;
  description: string;
  location: string;
  rating_avg: number | null;
}

export interface Availability {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  tables_available: number;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.data = data;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem("token", token);
  else window.localStorage.removeItem("token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  const t = getToken();
  if (t) headers["Authorization"] = `Token ${t}`;
  const res = await fetch(`/api${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

// --- Auth ---
export const authApi = {
  register: (username: string, email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),
  login: (username: string, password: string) =>
    request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<User>("/auth/me"),
};

// --- Venues ---
export const venueApi = {
  list: () => request<Venue[]>("/venues"),
  get: (id: number) => request<Venue>(`/venues/${id}`),
  create: (payload: { name: string; description?: string; location?: string }) =>
    request<Venue>("/venues", { method: "POST", body: JSON.stringify(payload) }),
  availability: (venueId: number) => request<Availability[]>(`/venues/${venueId}/availability`),
  addAvailability: (
    venueId: number,
    payload: { date: string; start_time: string; end_time: string; tables_available: number },
  ) =>
    request<Availability>(`/venues/${venueId}/availability`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// --- Reviews ---
export const reviewApi = {
  create: (payload: {
    target_type: "user" | "venue";
    target_user?: number;
    target_venue?: number;
    rating: number;
    body?: string;
  }) => request<Review>("/reviews", { method: "POST", body: JSON.stringify(payload) }),
  forVenue: (venueId: number) => request<Review[]>(`/venues/${venueId}/reviews`),
  forUser: (userId: number) => request<Review[]>(`/users/${userId}/reviews`),
};

export const userApi = {
  public: (id: number) => request<Omit<User, "email" | "role" | "venue" | "allow_invites">>(`/users/${id}`),
};

// --- Tables ---
export const tableApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<Table[]>(`/tables${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => request<Table>(`/tables/${id}`),
  create: (payload: Record<string, unknown>) =>
    request<Table>("/tables", { method: "POST", body: JSON.stringify(payload) }),
  confirm: (id: number) => request<Table>(`/tables/${id}/confirm`, { method: "POST" }),
  reject: (id: number) => request<Table>(`/tables/${id}/reject`, { method: "POST" }),
  cancel: (id: number) => request<Table>(`/tables/${id}/cancel`, { method: "POST" }),
  reserve: (id: number) => request<Seat>(`/tables/${id}/seats`, { method: "POST" }),
  cancelSeat: (id: number) => request<Seat>(`/tables/${id}/seats/cancel`, { method: "POST" }),
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.data as { detail?: string } | null;
    if (d && typeof d === "object" && d.detail) return d.detail;
    if (e.status === 403) return "You don't have permission to do that.";
    if (e.status === 409) return "That action conflicts with the current state.";
    return `Request failed (${e.status}).`;
  }
  return "Something went wrong.";
}
