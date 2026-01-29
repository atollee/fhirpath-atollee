/**
 * FHIRPath Playground - Fresh 2.2.0 Server Entry Point
 */
import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";

// Get the playground directory path for static files
const playgroundDir = new URL("./", import.meta.url).pathname;

export const app = new App<State>();

// Serve static files
app.use(staticFiles({
  root: playgroundDir,
}));

// Logging middleware (development only)
const loggerMiddleware = define.middleware((ctx) => {
  if (Deno.env.get("DENO_ENV") === "development") {
    console.log(`${ctx.req.method} ${ctx.url.pathname}`);
  }
  return ctx.next();
});
app.use(loggerMiddleware);

// CORS middleware for API routes
app.use(async (ctx) => {
  if (ctx.url.pathname.startsWith("/api/")) {
    // Add CORS headers for API routes
    const response = await ctx.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    return response;
  }
  return ctx.next();
});

// Register API routes manually for better control
import { handler as evaluateHandler } from "./routes/api/evaluate.ts";

app.post("/api/evaluate", async (ctx) => {
  return await evaluateHandler.POST(ctx.req);
});

// Handle OPTIONS preflight for CORS
app.all("/api/evaluate", (ctx) => {
  if (ctx.req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  return new Response("Method not allowed", { status: 405 });
});

// File-system based routes
app.fsRoutes();
