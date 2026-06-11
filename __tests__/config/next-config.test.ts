import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';

describe('Next.js config', () => {
  it('allows 127.0.0.1 dev origins for local browser smoke tests', () => {
    expect(nextConfig.allowedDevOrigins).toContain('127.0.0.1');
  });
});
