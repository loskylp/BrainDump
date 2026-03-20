/**
 * TASK-016 -- Verifies Vite config has API proxy for /api.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import viteConfig from '../../vite.config.js';

describe('vite.config.js', () => {
  it('configures API proxy for /api pointing to http://localhost:3000', () => {
    const proxy = viteConfig.server.proxy;
    expect(proxy).toHaveProperty('/api');
    expect(proxy['/api'].target).toBe('http://localhost:3000');
    expect(proxy['/api'].changeOrigin).toBe(true);
  });
});
