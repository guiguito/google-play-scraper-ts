/* Lightweight port of reference script data utilities */
import type { JsonObject, JsonValue } from '../types';

export type Path = ReadonlyArray<string | number>;

export interface MappingSpecFn<T = JsonValue | undefined> {
  path: Path;
  fun: (input: JsonValue | undefined, parsed: JsonValue) => T;
  useServiceRequestId?: string;
}

export type MappingSpec<T = JsonValue> = Path | MappingSpecFn<T>;

export type GenericMappings = Record<string, MappingSpec<JsonValue | undefined>>;

export interface ParsedScriptData extends JsonObject {
  serviceRequestData: Record<string, JsonObject & { id?: string }>;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getPathValue(source: JsonValue, path: Path): JsonValue | undefined {
  let current: JsonValue | undefined = source;
  for (const key of path) {
    if (current == null) return undefined;
    if (typeof key === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[key];
    } else {
      if (!isJsonObject(current)) return undefined;
      current = current[key];
    }
  }
  return current;
}

export function extractDataWithServiceRequestId(parsedData: ParsedScriptData, spec: MappingSpecFn<unknown>) {
  const serviceRequests = parsedData.serviceRequestData ?? {};
  const match = Object.keys(serviceRequests).find((serviceRequest) => {
    const dsValues = serviceRequests[serviceRequest];
    return dsValues?.id === spec.useServiceRequestId;
  });
  const targetPath = match ? ([match, ...spec.path] as Path) : spec.path;
  return getPathValue(parsedData, targetPath);
}

function isMappingSpecFn<T>(spec: MappingSpec<T>): spec is MappingSpecFn<T> {
  return !Array.isArray(spec);
}

export function extractor<T extends object>(mappings: Record<string, MappingSpec<unknown>>): (parsedData: JsonValue) => T {
  return function extractFields(parsedData: JsonValue): T {
    const entries = Object.entries(mappings).map(([key, spec]) => {
      if (!isMappingSpecFn(spec)) {
        return [key, getPathValue(parsedData, spec)];
      }
      const input = spec.useServiceRequestId && isJsonObject(parsedData)
        ? extractDataWithServiceRequestId(parsedData as ParsedScriptData, spec)
        : getPathValue(parsedData, spec.path);
      return [key, spec.fun(input, parsedData)];
    });
    return Object.fromEntries(entries) as T;
  };
}

export function parse(response: string): ParsedScriptData {
  const scriptRegex = />AF_initDataCallback[\s\S]*?<\/script/g;
  const keyRegex = /(ds:.*?)'/;
  const valueRegex = /data:([\s\S]*?), sideChannel: {}}\);<\//;

  const matches = response.match(scriptRegex);
  const parsedData: ParsedScriptData = { serviceRequestData: {} } as ParsedScriptData;
  if (!matches) {
    parsedData.serviceRequestData = parseServiceRequests(response);
    return parsedData;
  }

  for (const data of matches) {
    const keyMatch = data.match(keyRegex);
    const valueMatch = data.match(valueRegex);
    if (keyMatch && valueMatch) {
      const key = keyMatch[1];
      const value = JSON.parse(valueMatch[1]) as JsonValue;
      parsedData[key] = value;
    }
  }

  parsedData.serviceRequestData = parseServiceRequests(response);
  return parsedData;
}

export function parseServiceRequests(response: string): Record<string, JsonObject & { id?: string }> {
  const scriptRegex = /; var AF_dataServiceRequests[\s\S]*?; var AF_initDataChunkQueue/g;
  const valueRegex = /{'ds:[\s\S]*}}/g;
  const matches = response.match(scriptRegex);
  if (!matches) return {};
  const [data] = matches;
  const valueMatch = data.match(valueRegex);
  if (!valueMatch) return {};
  const value = eval(`(${valueMatch[0]})`) as Record<string, JsonObject & { id?: string }>;
  return value;
}

export default { parse, parseServiceRequests, extractor, extractDataWithServiceRequestId, getPathValue };
