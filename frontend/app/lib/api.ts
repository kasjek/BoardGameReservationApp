export type Role = "USER" | "VENUE_USER" | "ADMIN";

export interface BggCategory {
  id: number;
  name: string;
  url: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  venue: number | null;
  allow_invites: boolean;
  avatar_seed: string;
  rating_avg: number | null;
  cancellations_count: number;
  late_cancel_marks_active: number;
  games_played?: number;
  different_games?: number;
  has_usable_password?: boolean;
  favorite_categories?: BggCategory[];
}

export type TableStatus =
  | "requested"
  | "available"
  | "confirmed_unpaid"
  | "confirmed_paid"
  | "cancelled"
  | "completed";

export interface PublicUser {
  id: number;
  username: string;
  avatar_seed: string;
  rating_avg: number | null;
  cancellations_count: number;
  late_cancel_marks_active: number;
  games_played: number;
  different_games: number;
  favorite_categories?: BggCategory[];
  friendship?: FriendshipState | null;
}

export type FriendshipStatus = "none" | "self" | "outgoing" | "incoming" | "friends";

export interface FriendshipState {
  status: FriendshipStatus;
  request_id: number | null;
}

export interface FriendUser {
  id: number;
  username: string;
  avatar_seed: string;
  rating_avg: number | null;
  friendship: FriendshipState | null;
}

export interface FriendRequest {
  id: number;
  status: "pending" | "accepted" | "rejected";
  requester_id: number;
  addressee_id: number;
  user: FriendUser;
}

export interface PublicUserGameSession {
  table_id: number;
  game_title: string;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  status: TableStatus;
  is_organizer: boolean;
}

export interface PublicUserGameTitle {
  title: string;
  count: number;
}

export interface PublicUserGames {
  games_played: number;
  different_games: number;
  sessions: PublicUserGameSession[];
  titles: PublicUserGameTitle[];
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

export interface Table {
  id: number;
  organizer: number;
  venue: number;
  venue_name: string;
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
  username: string;
  avatar_seed: string;
  is_organizer: boolean;
  status: "reserved" | "waitlisted" | "cancelled";
  waitlist_position: number | null;
  paid: boolean;
}

export interface Venue {
  id: number;
  name: string;
  description: string;
  location: string;
  min_players: number;
  max_players: number;
  min_reservation_minutes: number;
  max_reservation_minutes: number;
  rating_avg: number | null;
  maps_url: string | null;
}

export interface Availability {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  tables_available: number;
}

export interface WeeklyHours {
  weekday: number; // Mon=0 … Sun=6
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface VenueClosure {
  id: number;
  venue: number;
  date: string;
  comment: string;
  created_at: string;
}

export interface VenueGame {
  id: number;
  venue: number;
  title: string;
  bgg_id: number | null;
  thumbnail_url: string;
  cover_url: string | null;
  bgg_url: string | null;
  is_active: boolean;
}

export interface BggSearchHit {
  bgg_id: number;
  name: string;
  year: number | null;
}

export interface BggThing {
  bgg_id: number;
  name: string;
  thumbnail_url: string;
  playing_time: number | null;
  min_play_time: number | null;
  max_play_time: number | null;
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

  // BGG search can return hundreds of hits; allow a longer window than CRUD calls.
  const timeoutMs = path.startsWith("/bgg/") ? 25_000 : 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(504, { detail: "Request timed out." });
    }
    throw err;
  }
  clearTimeout(timer);

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text.slice(0, 200) || `Request failed (${res.status}).` };
    }
  }
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
  googleConfig: () =>
    request<{ google_client_id: string | null; google_enabled: boolean }>("/auth/google/config"),
  loginGoogle: (credential: string) =>
    request<{ token: string; user: User }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
  me: () => request<User>("/auth/me"),
  rollAvatar: () => request<User>("/me/avatar/roll", { method: "POST" }),
  setFavoriteCategories: (categoryIds: number[]) =>
    request<User>("/me/favorite-categories", {
      method: "PATCH",
      body: JSON.stringify({ category_ids: categoryIds }),
    }),
  changePassword: (payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) =>
    request<{ detail: string; token: string }>("/me/password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// --- Venues ---
export const venueApi = {
  list: () => request<Venue[]>("/venues"),
  get: (id: number) => request<Venue>(`/venues/${id}`),
  create: (payload: {
    name: string;
    description?: string;
    location?: string;
    min_players?: number;
    max_players?: number;
    min_reservation_minutes?: number;
    max_reservation_minutes?: number;
    weekly_hours?: WeeklyHours[];
    closures?: { date: string; comment: string }[];
  }) => request<Venue>("/venues", { method: "POST", body: JSON.stringify(payload) }),
  update: (
    id: number,
    payload: Partial<{
      name: string;
      description: string;
      location: string;
      min_players: number;
      max_players: number;
      min_reservation_minutes: number;
      max_reservation_minutes: number;
    }>,
  ) => request<Venue>(`/venues/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  availability: (venueId: number) => request<Availability[]>(`/venues/${venueId}/availability`),
  addAvailability: (
    venueId: number,
    payload: { date: string; start_time: string; end_time: string; tables_available: number },
  ) =>
    request<Availability>(`/venues/${venueId}/availability`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  hours: (venueId: number) => request<WeeklyHours[]>(`/venues/${venueId}/hours`),
  setHours: (venueId: number, hours: WeeklyHours[]) =>
    request<WeeklyHours[]>(`/venues/${venueId}/hours`, {
      method: "PUT",
      body: JSON.stringify(hours),
    }),
  closures: (venueId: number) => request<VenueClosure[]>(`/venues/${venueId}/closures`),
  addClosure: (venueId: number, payload: { date: string; comment: string }) =>
    request<VenueClosure>(`/venues/${venueId}/closures`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteClosure: (venueId: number, closureId: number) =>
    request<unknown>(`/venues/${venueId}/closures/${closureId}`, { method: "DELETE" }),
  games: (venueId: number) => request<VenueGame[]>(`/venues/${venueId}/games`),
  addGame: (venueId: number, payload: { bgg_id?: number; title?: string }) =>
    request<VenueGame>(`/venues/${venueId}/games`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteGame: (venueId: number, gameId: number) =>
    request<unknown>(`/venues/${venueId}/games/${gameId}`, { method: "DELETE" }),
};

export const bggApi = {
  /** Live BGG results (up to `limit`; default returns a large page so rare titles like ICE appear). */
  search: (q: string, limit = 500) =>
    request<{ results: BggSearchHit[] }>(
      `/bgg/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
  directory: () => request<{ results: BggSearchHit[] }>("/bgg/directory"),
  thing: (bggId: number) => request<BggThing>(`/bgg/thing?id=${bggId}`),
  categories: () => request<{ results: BggCategory[] }>("/bgg/categories"),
};

// --- Reviews ---
export const reviewApi = {
  create: (payload: {
    table: number;
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
  public: (id: number) => request<PublicUser>(`/users/${id}`),
  games: (id: number) => request<PublicUserGames>(`/users/${id}/games`),
  search: (q: string) => request<FriendUser[]>(`/users?q=${encodeURIComponent(q)}`),
};

export const friendApi = {
  list: () => request<FriendUser[]>("/friends"),
  requests: () =>
    request<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/friends/requests"),
  add: (payload: { username?: string; user_id?: number }) =>
    request<FriendRequest>("/friends/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  accept: (id: number) =>
    request<FriendRequest>(`/friends/requests/${id}/accept`, { method: "POST" }),
  reject: (id: number) =>
    request<FriendRequest>(`/friends/requests/${id}/reject`, { method: "POST" }),
};

export interface ChatMessage {
  id: number;
  sender_id: number;
  recipient_id: number;
  body: string;
  created_at: string;
  mine: boolean;
}

export interface ChatSummary {
  user: FriendUser;
  last_message: ChatMessage;
}

export interface ChatThread {
  user: FriendUser;
  messages: ChatMessage[];
}

export const chatApi = {
  list: () => request<ChatSummary[]>("/chats"),
  thread: (userId: number) => request<ChatThread>(`/chats/${userId}`),
  send: (userId: number, body: string) =>
    request<ChatMessage>(`/chats/${userId}`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
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
  seats: (id: number) => request<Seat[]>(`/tables/${id}/seats`),
  reserve: (id: number) => request<Seat>(`/tables/${id}/seats`, { method: "POST" }),
  paySeat: (id: number) => request<Seat>(`/tables/${id}/seats/pay`, { method: "POST" }),
  cancelSeat: (id: number) => request<Seat>(`/tables/${id}/seats/cancel`, { method: "POST" }),
};

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/** Map API / network errors to a user-facing string. Pass `t` to localize fallbacks. */
export function errorMessage(e: unknown, t?: TranslateFn): string {
  const tr = t ?? ((key: string, vars?: Record<string, string | number>) => {
    // English fallbacks when called outside a locale context.
    const en: Record<string, string> = {
      "errors.loginFailed": "Unable to log in with those credentials.",
      "errors.forbidden": "You don't have permission to do that.",
      "errors.conflict": "That action conflicts with the current state.",
      "errors.requestFailed": `Request failed (${vars?.status ?? "?"}).`,
      "errors.generic": "Something went wrong.",
    };
    return en[key] ?? key;
  });

  if (e instanceof ApiError) {
    const d = e.data;
    if (typeof d === "string" && d.trim()) return d;
    if (Array.isArray(d) && d.length) {
      const first = d[0];
      if (typeof first === "string") return first;
    }
    if (d && typeof d === "object") {
      const detail = (d as { detail?: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) return detail;
      if (Array.isArray(detail) && typeof detail[0] === "string") return detail[0];
      for (const key of [
        "password",
        "current_password",
        "new_password",
        "confirm_password",
        "username",
        "email",
        "non_field_errors",
        "bgg_id",
        "title",
      ]) {
        const field = (d as Record<string, unknown>)[key];
        if (typeof field === "string" && field.trim()) return field;
        if (Array.isArray(field) && typeof field[0] === "string") return field[0];
      }
    }
    if (e.status === 400) return tr("errors.loginFailed");
    if (e.status === 403) return tr("errors.forbidden");
    if (e.status === 409) return tr("errors.conflict");
    return tr("errors.requestFailed", { status: e.status });
  }
  return tr("errors.generic");
}
