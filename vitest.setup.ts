/**
 * Vitest global setup file.
 *
 * The `server-only` package throws when imported outside a Next.js server
 * context. Since all unit tests run in Node (not the Next.js runtime), we
 * replace it with a no-op so that files that import it can still be loaded
 * and tested in isolation.
 */
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))
