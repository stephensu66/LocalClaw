import { OpenClawMockAdapter } from './mockAdapter';
import { OpenClawRealAdapter } from './realAdapter';
import type { OpenClawAdapter } from './adapter';

export function createOpenClawAdapter(mode: 'mock' | 'real'): OpenClawAdapter {
  if (mode === 'real') {
    return new OpenClawRealAdapter({});
  }
  return new OpenClawMockAdapter();
}
