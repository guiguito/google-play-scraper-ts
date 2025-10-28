import { BASE_URL, constants } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import type { JsonValue } from '../types';

export interface PermissionItem {
  permission: string;
  type: JsonValue;
}

export interface PermissionsOptions {
  appId: string;
  lang?: string;
  country?: string;
  short?: boolean;
}

export async function permissions(opts: PermissionsOptions) {
  if (!opts || !opts.appId) throw new Error('appId missing');
  const lang = opts.lang || 'en';
  const country = opts.country || 'us';
  const body = `f.req=%5B%5B%5B%22xdSrCf%22%2C%22%5B%5Bnull%2C%5B%5C%22${opts.appId}%5C%22%2C7%5D%2C%5B%5D%5D%5D%22%2Cnull%2C%221%22%5D%5D%5D`;
  const url = `${BASE_URL}/_/PlayStoreUi/data/batchexecute?rpcids=qnKhOb&f.sid=-697906427155521722&bl=boq_playuiserver_20190903.08_p0&hl=${lang}&gl=${country}&authuser&soc-app=121&soc-platform=1&soc-device=1&_reqid=1065213`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
  const html = await request({ url, method: 'POST', body, headers, country });
  const input = JSON.parse(html.substring(5));
  const data = JSON.parse(input[0][2]) as JsonValue | null;
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
  const mapPermission = scriptData.extractor<{ permission?: string; type: JsonValue }>(mappings);
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
      fun: () => type,
    },
  } as scriptData.GenericMappings;
}

export default permissions;
