---
name: Mock leakage rule for mockResolvedValueOnce
description: Never queue a mockResolvedValueOnce that the code under test won't consume — unconsumed values bleed into subsequent tests
type: feedback
---

## Rule: Only queue values you know will be consumed

`mockResolvedValueOnce()` pushes a value onto a FIFO queue. If the code path being tested short-circuits before calling the mock (e.g. the function returns early), the queued value is **not consumed** and will be used by the **next test** that calls the same mock.

### The bug that occurred

In `lib/auth/__tests__/config.test.ts`:

1. The "google-provider user" test called `mockCompare.mockResolvedValueOnce(true)` as a defensive setup, even though the authorize function returns null *before* reaching `bcrypt.compare` for non-credentials providers.
2. The queued `true` was not consumed by that test.
3. The very next test ("wrong password returns null") called `mockCompare.mockResolvedValueOnce(false)`, putting `false` second in the queue.
4. When `bcrypt.compare` was called, it dequeued `true` (from test 1's leftover), making `valid = true`.
5. The user was returned instead of `null`. The test failed.

### The fix

Never call `mockResolvedValueOnce` for a mock that the code will not actually call. If you're unsure, assert that the mock was NOT called (e.g. `expect(mockCompare).not.toHaveBeenCalled()`) instead of setting up an unused return value.

**How to apply:** Before queuing any `mockResolvedValueOnce`, ask: "Will this code path definitely call this mock?" If the answer is "it should never reach it," do NOT queue a value — instead, write a separate assertion that verifies the mock was not called.
