/**
 * 极简 history 路由（替代 vue-router）。路由表同 ADJUST-01 §7.1。
 */

import { emit } from './bus';

export type Route =
  | { name: 'home'; path: string }
  | { name: 'zones'; path: string }
  | { name: 'zone'; path: string; zoneKey: string; phase: number }
  | { name: 'tomb'; path: string; code: string }
  | { name: 'group'; path: string; code: string }
  | { name: 'mine'; path: string }
  | { name: 'search'; path: string; q: string }
  | { name: 'funeral'; path: string };

let current: Route = parse(location.pathname, location.search);

export function parse(pathname: string, search = ''): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  const full = path + (search || '');
  if (!parts.length) return { name: 'home', path: full };
  const [head, a, b] = parts;
  switch (head) {
    case 'zones':
      return { name: 'zones', path: full };
    case 'z':
      if (a) {
        const n = Number(b);
        return { name: 'zone', path: full, zoneKey: a, phase: Number.isFinite(n) && n > 0 ? n : 1 };
      }
      break;
    case 't':
      if (a) return { name: 'tomb', path: full, code: a };
      break;
    case 'g':
      if (a) return { name: 'group', path: full, code: a };
      break;
    case 'mine':
      return { name: 'mine', path: full };
    case 'search':
      return { name: 'search', path: full, q: new URLSearchParams(search).get('q') ?? '' };
    case 'funeral':
      return { name: 'funeral', path: full };
  }
  return { name: 'home', path: '/' };
}

export function currentRoute(): Route {
  return current;
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const url = new URL(path, location.origin);
  const next = parse(url.pathname, url.search);
  const target = url.pathname + url.search;
  if (target !== location.pathname + location.search) {
    if (opts.replace) history.replaceState(null, '', target);
    else history.pushState(null, '', target);
  }
  current = next;
  emit('route', current);
}

export function zonePath(zoneKey: string, phaseNumber: number): string {
  return phaseNumber <= 1 ? `/z/${zoneKey}` : `/z/${zoneKey}/${phaseNumber}`;
}

export function startRouter(): void {
  addEventListener('popstate', () => {
    current = parse(location.pathname, location.search);
    emit('route', current);
  });
}
