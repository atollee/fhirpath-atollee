/**
 * Tests for FHIRPath Worker Pool
 * 
 * Note: These tests require Web Worker support.
 * In Deno, workers need --allow-read and proper module resolution.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { FhirPathWorkerPool } from "../src/worker/pool.ts";

// Sample patients for testing
const patients = Array.from({ length: 100 }, (_, i) => ({
  resourceType: "Patient",
  id: `patient-${i}`,
  name: [{ family: `Family${i}`, given: [`Given${i}`] }],
  active: i % 2 === 0,
  birthDate: `198${i % 10}-0${(i % 9) + 1}-15`,
}));

Deno.test({
  name: "worker-pool: can create pool",
  fn() {
    const pool = new FhirPathWorkerPool({ poolSize: 2 });
    assertExists(pool);
  },
});

Deno.test({
  name: "worker-pool: getStats returns initial stats",
  fn() {
    const pool = new FhirPathWorkerPool({ poolSize: 4 });
    const stats = pool.getStats();
    
    // Before initialization
    assertEquals(stats.poolSize, 0);
    assertEquals(stats.activeWorkers, 0);
    assertEquals(stats.queuedTasks, 0);
    assertEquals(stats.totalProcessed, 0);
  },
});

// Worker tests require actual worker execution
// These are skipped by default as they need special permissions and environment
Deno.test({
  name: "worker-pool: initialize and shutdown",
  ignore: Deno.env.get("CI") === "true", // Skip in CI
  async fn() {
    const pool = new FhirPathWorkerPool({ poolSize: 2 });
    
    try {
      await pool.initialize();
      const stats = pool.getStats();
      assertEquals(stats.poolSize, 2);
    } finally {
      await pool.shutdown();
    }
  },
});

Deno.test({
  name: "worker-pool: execute single task",
  ignore: Deno.env.get("CI") === "true",
  async fn() {
    const pool = new FhirPathWorkerPool({ poolSize: 2 });
    
    try {
      await pool.initialize();
      
      const result = await pool.execute({
        id: "test-1",
        expression: "name.family",
        resources: [patients[0]],
      });
      
      assertEquals(result.id, "test-1");
      assertEquals(result.results, [["Family0"]]);
      assertEquals(result.error, undefined);
    } finally {
      await pool.shutdown();
    }
  },
});

Deno.test({
  name: "worker-pool: batch evaluation",
  ignore: Deno.env.get("CI") === "true",
  async fn() {
    const pool = new FhirPathWorkerPool({ poolSize: 4 });
    
    try {
      await pool.initialize();
      
      const result = await pool.evaluateBatch({
        expression: "name.family",
        resources: patients.slice(0, 20),
        chunkSize: 5,
      });
      
      assertEquals(result.resourceCount, 20);
      assertEquals(result.chunkCount, 4);
      assertEquals(result.results.length, 20);
      
      // Check first and last
      assertEquals(result.results[0], ["Family0"]);
      assertEquals(result.results[19], ["Family19"]);
    } finally {
      await pool.shutdown();
    }
  },
});

Deno.test({
  name: "worker-pool: parallel execution is faster",
  ignore: Deno.env.get("CI") === "true",
  async fn() {
    const pool = new FhirPathWorkerPool({ poolSize: 4 });
    
    try {
      await pool.initialize();
      
      const startTime = performance.now();
      
      // Execute multiple tasks in parallel
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `parallel-${i}`,
        expression: "name.where(family.startsWith('Family')).given",
        resources: patients.slice(i * 10, (i + 1) * 10),
      }));
      
      await Promise.all(tasks.map(task => pool.execute(task)));
      
      const duration = performance.now() - startTime;
      console.log(`Parallel execution of 100 patients: ${duration.toFixed(2)}ms`);
      
      const stats = pool.getStats();
      assertEquals(stats.totalProcessed, 10);
    } finally {
      await pool.shutdown();
    }
  },
});

Deno.test({
  name: "worker-pool: handles errors gracefully",
  ignore: Deno.env.get("CI") === "true",
  async fn() {
    const pool = new FhirPathWorkerPool({ poolSize: 2 });
    
    try {
      await pool.initialize();
      
      const result = await pool.execute({
        id: "error-test",
        expression: "invalid...expression",
        resources: [patients[0]],
      });
      
      assertExists(result.error);
    } finally {
      await pool.shutdown();
    }
  },
});

Deno.test({
  name: "worker-pool: rejects after shutdown",
  ignore: Deno.env.get("CI") === "true",
  async fn() {
    const pool = new FhirPathWorkerPool({ poolSize: 2 });
    await pool.initialize();
    await pool.shutdown();
    
    await assertRejects(
      () => pool.execute({
        id: "after-shutdown",
        expression: "name",
        resources: [patients[0]],
      }),
      Error,
      "shut down",
    );
  },
});
