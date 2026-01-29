/**
 * FHIRPath Worker
 * 
 * Web Worker for parallel FHIRPath evaluation.
 * This file runs in a separate thread.
 */

import { parseFhirPath } from "../parser/parser.ts";
import { evaluateFhirPath } from "../evaluator/evaluator.ts";
import type { WorkerMessage, WorkerResponse, WorkerTask, WorkerResult } from "./types.ts";

// Expression cache within this worker
const expressionCache = new Map<string, ReturnType<typeof parseFhirPath>>();

/**
 * Get or parse an expression
 */
function getExpression(expression: string) {
  let ast = expressionCache.get(expression);
  if (!ast) {
    ast = parseFhirPath(expression);
    expressionCache.set(expression, ast);
  }
  return ast;
}

/**
 * Process a task
 */
function processTask(task: WorkerTask): WorkerResult {
  const startTime = performance.now();
  
  try {
    const ast = getExpression(task.expression);
    const results: unknown[][] = [];
    
    for (const resource of task.resources) {
      const result = evaluateFhirPath(ast, resource, task.context ?? {});
      results.push(result);
    }
    
    return {
      id: task.id,
      results,
      durationMs: performance.now() - startTime,
    };
  } catch (error) {
    return {
      id: task.id,
      results: [],
      error: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - startTime,
    };
  }
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  
  switch (message.type) {
    case "task":
      if (message.task) {
        const result = processTask(message.task);
        const response: WorkerResponse = {
          type: "result",
          result,
        };
        self.postMessage(response);
      }
      break;
      
    case "shutdown":
      expressionCache.clear();
      self.close();
      break;
  }
};

// Signal that worker is ready
const readyResponse: WorkerResponse = { type: "ready" };
self.postMessage(readyResponse);
