export type ActionState<T = undefined> =
  | { status: 'idle' }
  | { status: 'error';   error: string; fields?: Record<string, string[]> }
  | { status: 'success'; data?: T }
