/**
 * Global test setup. Mocks the `iina` runtime global before any source
 * module is imported, since each module destructures `iina` at load time.
 */

import { vi } from "vitest";

const iinaConsoleMock = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const iinaHttpMock = {
  post: vi.fn(),
};

const iinaPreferencesMock = {
  get: vi.fn(),
  set: vi.fn(),
};

const iinaGlobalMock = {
  postMessage: vi.fn(),
  onMessage: vi.fn(),
};

(globalThis as Record<string, unknown>).iina = {
  console: iinaConsoleMock,
  http: iinaHttpMock,
  preferences: iinaPreferencesMock,
  global: iinaGlobalMock,
  event: { on: vi.fn() },
  core: {
    status: { url: "", position: 0, duration: 0, paused: false },
    osd: vi.fn(),
  },
};
