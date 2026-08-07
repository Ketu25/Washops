export type UserRole = "customer" | "admin";
export type RequestType = "pickup" | "dropoff";
export type RequestStatus = "pending" | "planned" | "completed" | "cancelled";

export interface AddressSnapshot {
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  formatted_address: string | null;
  latitude: number;
  longitude: number;
  distance_miles: number;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_miles: number | null;
  created_at: string;
  updated_at: string;
}

export type PublicUser = Omit<UserRow, "password_hash">;

export interface SettingsRow {
  id: boolean;
  name: string;
  address: string;
  formatted_address: string | null;
  latitude: number;
  longitude: number;
  service_radius_miles: number;
  updated_at: string;
}

export interface RequestRow extends AddressSnapshot {
  id: string;
  user_id: string;
  type: RequestType;
  status: RequestStatus;
  scheduled_date: string;
  time_window: string;
  notes: string | null;
  admin_notes: string | null;
  planned_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A request joined with the customer who owns it, for the admin table. */
export interface RequestWithCustomer extends RequestRow {
  users: Pick<UserRow, "id" | "full_name" | "email" | "phone"> | null;
}

export const TIME_WINDOWS = [
  "08:00 - 10:00",
  "10:00 - 12:00",
  "12:00 - 14:00",
  "14:00 - 16:00",
  "16:00 - 18:00",
  "18:00 - 20:00",
] as const;

export type TimeWindow = (typeof TIME_WINDOWS)[number];

/** Statuses a customer is still allowed to cancel. */
export const CANCELLABLE_STATUSES: RequestStatus[] = ["pending", "planned"];

/** Statuses that occupy the "one open request per day" slot. */
export const OPEN_STATUSES: RequestStatus[] = ["pending", "planned"];

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  pickup: "Pickup",
  dropoff: "Drop-off",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  planned: "Planned",
  completed: "Completed",
  cancelled: "Cancelled",
};
