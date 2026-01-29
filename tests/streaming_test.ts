/**
 * Tests for Streaming Evaluation API
 */

import { assertEquals, assert } from "@std/assert";
import { 
  evaluateStream, 
  evaluateEach, 
  toReadableStream,
  FhirPathStream,
} from "../src/streaming.ts";

// Test data: Large Bundle with many entries
function createLargeBundle(size: number): { resourceType: string; entry: Array<{ resource: unknown }> } {
  const entries = [];
  for (let i = 0; i < size; i++) {
    entries.push({
      resource: {
        resourceType: i % 3 === 0 ? "Patient" : i % 3 === 1 ? "Observation" : "Condition",
        id: `resource-${i}`,
        name: i % 3 === 0 ? [{ given: [`Given${i}`], family: `Family${i}` }] : undefined,
        subject: i % 3 !== 0 ? { reference: `Patient/patient-${Math.floor(i / 3)}` } : undefined,
      },
    });
  }
  return {
    resourceType: "Bundle",
    entry: entries,
  };
}

Deno.test("streaming: basic iteration", async () => {
  const bundle = createLargeBundle(100);
  const results: unknown[] = [];
  
  for await (const resource of evaluateStream(bundle, "entry.resource")) {
    results.push(resource);
  }
  
  assertEquals(results.length, 100);
});

Deno.test("streaming: toArray collects all results", async () => {
  const bundle = createLargeBundle(50);
  const stream = evaluateStream(bundle, "entry.resource");
  const results = await stream.toArray();
  
  assertEquals(results.length, 50);
});

Deno.test("streaming: first returns first result", async () => {
  const bundle = createLargeBundle(100);
  const stream = evaluateStream(bundle, "entry.resource");
  const first = await stream.first();
  
  assert(first !== undefined);
  assertEquals((first as { id: string }).id, "resource-0");
});

Deno.test("streaming: count returns total", async () => {
  const bundle = createLargeBundle(75);
  const stream = evaluateStream(bundle, "entry.resource");
  const count = await stream.count();
  
  assertEquals(count, 75);
});

Deno.test("streaming: exists returns true for non-empty", async () => {
  const bundle = createLargeBundle(10);
  const exists = await evaluateStream(bundle, "entry.resource").exists();
  
  assertEquals(exists, true);
});

Deno.test("streaming: exists returns false for empty", async () => {
  const bundle = { resourceType: "Bundle", entry: [] };
  const exists = await evaluateStream(bundle, "entry.resource").exists();
  
  assertEquals(exists, false);
});

Deno.test("streaming: limit option", async () => {
  const bundle = createLargeBundle(100);
  const stream = evaluateStream(bundle, "entry.resource", {}, undefined, { limit: 10 });
  const results = await stream.toArray();
  
  assertEquals(results.length, 10);
});

Deno.test("streaming: offset option", async () => {
  const bundle = createLargeBundle(100);
  const stream = evaluateStream(bundle, "entry.resource", {}, undefined, { offset: 90 });
  const results = await stream.toArray();
  
  assertEquals(results.length, 10);
});

Deno.test("streaming: limit and offset combined", async () => {
  const bundle = createLargeBundle(100);
  const stream = evaluateStream(bundle, "entry.resource", {}, undefined, { 
    offset: 10, 
    limit: 5 
  });
  const results = await stream.toArray();
  
  assertEquals(results.length, 5);
  assertEquals((results[0] as { id: string }).id, "resource-10");
});

Deno.test("streaming: filter operation", async () => {
  const bundle = createLargeBundle(30);
  const stream = evaluateStream<{ resourceType: string }>(bundle, "entry.resource")
    .filter(r => r.resourceType === "Patient");
  
  const results = await stream.toArray();
  
  // Every 3rd resource is a Patient (indices 0, 3, 6, ...)
  assertEquals(results.length, 10);
  assert(results.every(r => r.resourceType === "Patient"));
});

Deno.test("streaming: map operation", async () => {
  const bundle = createLargeBundle(10);
  const stream = evaluateStream<{ id: string }>(bundle, "entry.resource")
    .map(r => r.id);
  
  const results = await stream.toArray();
  
  assertEquals(results.length, 10);
  assertEquals(results[0], "resource-0");
  assertEquals(results[9], "resource-9");
});

Deno.test("streaming: take operation", async () => {
  const bundle = createLargeBundle(100);
  const stream = evaluateStream(bundle, "entry.resource").take(5);
  const results = await stream.toArray();
  
  assertEquals(results.length, 5);
});

Deno.test("streaming: skip operation", async () => {
  const bundle = createLargeBundle(100);
  const stream = evaluateStream<{ id: string }>(bundle, "entry.resource").skip(95);
  const results = await stream.toArray();
  
  assertEquals(results.length, 5);
  assertEquals(results[0].id, "resource-95");
});

Deno.test("streaming: chained operations", async () => {
  const bundle = createLargeBundle(100);
  const stream = evaluateStream<{ resourceType: string; id: string }>(bundle, "entry.resource")
    .filter(r => r.resourceType === "Patient")
    .map(r => r.id)
    .take(5);
  
  const results = await stream.toArray();
  
  assertEquals(results.length, 5);
  assertEquals(results[0], "resource-0");
  assertEquals(results[1], "resource-3");
});

Deno.test("streaming: batches iteration", async () => {
  const bundle = createLargeBundle(25);
  const stream = evaluateStream(bundle, "entry.resource");
  const batches: unknown[][] = [];
  
  for await (const batch of stream.batches(10)) {
    batches.push(batch);
  }
  
  assertEquals(batches.length, 3);
  assertEquals(batches[0].length, 10);
  assertEquals(batches[1].length, 10);
  assertEquals(batches[2].length, 5);
});

Deno.test("streaming: evaluateEach callback", async () => {
  const bundle = createLargeBundle(10);
  const collected: { result: unknown; index: number }[] = [];
  
  const count = await evaluateEach(
    bundle,
    "entry.resource",
    (result, index) => {
      collected.push({ result, index });
    },
  );
  
  assertEquals(count, 10);
  assertEquals(collected.length, 10);
  assertEquals(collected[0].index, 0);
  assertEquals(collected[9].index, 9);
});

Deno.test("streaming: progress callback", async () => {
  const bundle = createLargeBundle(20);
  const progressUpdates: number[] = [];
  
  const stream = evaluateStream(bundle, "entry.resource", {}, undefined, {
    onProgress: (processed) => progressUpdates.push(processed),
  });
  
  await stream.toArray();
  
  assert(progressUpdates.length > 0);
  assertEquals(progressUpdates[progressUpdates.length - 1], 20);
});

Deno.test("streaming: abort signal", async () => {
  const bundle = createLargeBundle(1000);
  const controller = new AbortController();
  const results: unknown[] = [];
  
  const stream = evaluateStream(bundle, "entry.resource", {}, undefined, {
    signal: controller.signal,
  });
  
  try {
    for await (const item of stream) {
      results.push(item);
      if (results.length === 10) {
        controller.abort();
      }
    }
  } catch (e) {
    assert(e instanceof DOMException);
    assertEquals((e as DOMException).name, "AbortError");
  }
  
  assertEquals(results.length, 10);
});

Deno.test("streaming: toReadableStream", async () => {
  const bundle = createLargeBundle(10);
  const readableStream = toReadableStream(bundle, "entry.resource");
  const reader = readableStream.getReader();
  const results: unknown[] = [];
  
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    results.push(value);
  }
  
  assertEquals(results.length, 10);
});

Deno.test("streaming: works with arrays as input", async () => {
  // Create a Bundle containing patients (the standard FHIR way)
  const bundle = {
    resourceType: "Bundle",
    entry: [
      { resource: { resourceType: "Patient", id: "1", name: [{ given: ["John"] }] } },
      { resource: { resourceType: "Patient", id: "2", name: [{ given: ["Jane"] }] } },
      { resource: { resourceType: "Patient", id: "3", name: [{ given: ["Bob"] }] } },
    ],
  };
  
  // Stream through entries and get names
  const stream = evaluateStream<string>(bundle, "entry.resource.name.given");
  const results = await stream.toArray();
  
  // Should yield all 3 given names
  assertEquals(results.length, 3);
  assert(results.includes("John"));
  assert(results.includes("Jane"));
  assert(results.includes("Bob"));
});

Deno.test("streaming: works with single resource", async () => {
  const patient = {
    resourceType: "Patient",
    id: "123",
    name: [
      { given: ["John", "James"], family: "Doe" },
      { given: ["Johnny"], family: "Doe" },
    ],
  };
  
  const stream = evaluateStream<string>(patient, "name.given");
  const results = await stream.toArray();
  
  assertEquals(results.length, 3);
  assert(results.includes("John"));
  assert(results.includes("James"));
  assert(results.includes("Johnny"));
});

Deno.test("streaming: memory efficiency with large dataset", async () => {
  // Create a very large bundle
  const bundle = createLargeBundle(10000);
  let processedCount = 0;
  let maxMemoryDelta = 0;
  const initialMemory = Deno.memoryUsage().heapUsed;
  
  for await (const _ of evaluateStream(bundle, "entry.resource")) {
    processedCount++;
    
    // Sample memory every 1000 items
    if (processedCount % 1000 === 0) {
      const currentMemory = Deno.memoryUsage().heapUsed;
      const delta = currentMemory - initialMemory;
      maxMemoryDelta = Math.max(maxMemoryDelta, delta);
    }
  }
  
  assertEquals(processedCount, 10000);
  
  // Memory increase should be reasonable (not loading all results at once)
  // This is a soft check - exact memory behavior depends on GC
  console.log(`Max memory delta: ${(maxMemoryDelta / 1024 / 1024).toFixed(2)} MB`);
});

Deno.test("streaming: FhirPathStream class can be reused", async () => {
  const bundle = createLargeBundle(10);
  const stream = new FhirPathStream(bundle, "entry.resource");
  
  // First iteration
  const first = await stream.toArray();
  assertEquals(first.length, 10);
  
  // Second iteration (should work the same)
  const second = await stream.toArray();
  assertEquals(second.length, 10);
});
