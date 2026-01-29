#!/usr/bin/env -S deno run -A --watch=static/,routes/,islands/
/**
 * FHIRPath Playground Development Server
 * 
 * Using Deno Fresh 2.2.0 with Tailwind CSS
 * 
 * Usage:
 *   deno task playground:dev
 *   # or
 *   deno run -A --watch playground/fresh/dev.ts
 */
import { tailwind } from "@fresh/plugin-tailwind";
import { Builder } from "fresh/dev";

const port = parseInt(Deno.env.get("PLAYGROUND_PORT") || "8080");

console.log(`🔬 FHIRPath Playground starting...`);
console.log(`📦 Version: 0.7.1`);

// Get the playground directory path
const playgroundDir = new URL("./", import.meta.url).pathname;

// Builder with root for Routes
const builder = new Builder({
  root: playgroundDir,
});

// Enable Tailwind CSS
tailwind(builder);
console.log(`✅ Tailwind CSS enabled`);

// Helper function to check if port is in use
async function isPortInUse(port: number): Promise<boolean> {
  try {
    const listener = Deno.listen({ port, hostname: "localhost" });
    listener.close();
    return false;
  } catch (e) {
    if (e instanceof Deno.errors.AddrInUse) {
      return true;
    }
    throw e;
  }
}

// Check if port is already in use before starting
if (await isPortInUse(port)) {
  console.warn(`⚠️  Port ${port} is already in use.`);
  console.warn(`   Try a different port: PLAYGROUND_PORT=8081 deno task playground:dev`);
  Deno.exit(1);
}

if (Deno.args.includes("build")) {
  await builder.build();
  console.log(`✅ Build complete`);
} else {
  try {
    console.log(`🌐 Playground: http://localhost:${port}`);
    await builder.listen(() => import("./main.ts"), { port });
  } catch (error) {
    if (error instanceof Error && error.message.includes("AddrInUse")) {
      console.error(`❌ Port ${port} is in use.`);
      Deno.exit(1);
    }
    throw error;
  }
}
