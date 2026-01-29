import { createDefine } from "fresh";

// State shared between middlewares, layouts and routes
export interface State {
  expression?: string;
  resource?: unknown;
  result?: unknown[];
  error?: string;
}

export const define = createDefine<State>();
