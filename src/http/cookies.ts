export type Cookie = { name: string; value: string; domain?: string; path?: string };

export class SimpleCookieJar {
  private store = new Map<string, Map<string, string>>(); // domain -> name -> value

  setFromHeaders(url: string, headers: Headers) {
    const setCookie = headers.get('set-cookie');
    if (!setCookie) return;
    const domain = new URL(url).hostname;
    const jar = this.store.get(domain) || new Map<string, string>();
    // naive parse: only first cookie pair
    const parts = setCookie.split(';')[0];
    const [name, value] = parts.split('=');
    if (name && value) jar.set(name.trim(), value.trim());
    this.store.set(domain, jar);
  }

  apply(url: string, headers: Record<string, string>) {
    const domain = new URL(url).hostname;
    const jar = this.store.get(domain);
    if (!jar) return headers;
    const cookie = Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    return { ...headers, Cookie: cookie };
  }
}

