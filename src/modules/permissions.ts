import { BASE_URL, constants } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import type { JsonValue, PermissionItem } from '../types';

export type { PermissionItem };

export interface PermissionsOptions {
  appId: string;
  lang?: string;
  country?: string;
  short?: boolean;
  /** Extra HTTP headers for every request this call makes (including app() fan-outs). */
  requestOptions?: { headers?: Record<string, string> };
}

export function permissions(opts: PermissionsOptions & { short: true }): Promise<string[]>;
export function permissions(opts: PermissionsOptions & { short?: false }): Promise<PermissionItem[]>;
export function permissions(opts: PermissionsOptions): Promise<string[] | PermissionItem[]>;
export async function permissions(opts: PermissionsOptions): Promise<string[] | PermissionItem[]> {
  if (!opts || !opts.appId) throw new Error('appId missing');
  const lang = opts.lang || 'en';
  const country = opts.country || 'us';
  const inner = [[null, [opts.appId, 7], []]];
  const body = `f.req=${encodeURIComponent(JSON.stringify([[['xdSrCf', JSON.stringify(inner), null, '1']]]))}`;
  const url = `${BASE_URL}/_/PlayStoreUi/data/batchexecute?rpcids=qnKhOb&f.sid=-697906427155521722&bl=boq_playuiserver_20190903.08_p0&hl=${encodeURIComponent(lang)}&gl=${encodeURIComponent(country)}&authuser&soc-app=121&soc-platform=1&soc-device=1&_reqid=1065213`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', ...opts.requestOptions?.headers };
  const html = await request({ url, method: 'POST', body, headers, country });
  const input = JSON.parse(html.substring(5)) as JsonValue;
  const payload = Array.isArray(input) && Array.isArray(input[0]) ? input[0][2] : undefined;
  const data = typeof payload === 'string' ? (JSON.parse(payload) as JsonValue | null) : null;
  if (data === null) return [] as string[];
  return opts.short ? processShortPermissionsData(data) : processPermissionData(data);
}

const MAPPINGS = { permissions: [2], type: 0 } as const;

function asArray(value: JsonValue | undefined): JsonValue[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function processShortPermissionsData(data: JsonValue): string[] {
  const parsed = typeof data === 'string' ? scriptData.parse(data) : data;
  if (!Array.isArray(parsed)) return [];
  const section = parsed[constants.permission.COMMON];
  if (!Array.isArray(section)) return [];
  return section
    .filter((entry): entry is JsonValue => Array.isArray(entry))
    .flatMap((entry) => {
      const permissionsList = asArray(scriptData.getPathValue(entry, MAPPINGS.permissions));
      if (!permissionsList) return [];
      return permissionsList
        .map((item) => (Array.isArray(item) && typeof item[1] === 'string' ? item[1] : undefined))
        .filter((name): name is string => typeof name === 'string');
    });
}

function processPermissionData(data: JsonValue): PermissionItem[] {
  const parsed = typeof data === 'string' ? scriptData.parse(data) : data;
  if (!Array.isArray(parsed)) return [];
  return Object.values(constants.permission).flatMap((permissionKey) => {
    const section = parsed[permissionKey as number];
    if (!Array.isArray(section)) return [];
    return section.flatMap((entry) => flatMapPermissions(entry));
  });
}

function flatMapPermissions(permissionEntry: JsonValue): PermissionItem[] {
  if (!Array.isArray(permissionEntry)) return [];
  const typeValue = permissionEntry[MAPPINGS.type];
  const permissionsList = asArray(scriptData.getPathValue(permissionEntry, MAPPINGS.permissions));
  if (!permissionsList) return [];
  const mappings = getPermissionMappings(typeValue);
  const mapPermission = scriptData.extractor<{ permission?: string; type?: string }>(mappings);
  return permissionsList
    .map((item) => mapPermission(item))
    .filter((result): result is PermissionItem => typeof result.permission === 'string');
}

function getPermissionMappings(type: JsonValue) {
  return {
    permission: {
      path: [1],
      fun: (value) => (typeof value === 'string' ? value : undefined),
    },
    type: {
      path: [],
      fun: () => (typeof type === 'string' ? type : undefined),
    },
  } as scriptData.GenericMappings;
}

export default permissions;
