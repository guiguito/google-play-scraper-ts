export type Locale = string; // e.g., 'en_US'
export type Country = string; // e.g., 'us'

export type AppId = string; // e.g., 'com.spotify.music'

export interface PaginationOptions {
  num?: number;
  start?: number;
  throttle?: { interval: number; limit: number };
}

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };
