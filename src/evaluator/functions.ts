/**
 * FHIRPath Built-in Functions
 * 
 * Implementation of all standard FHIRPath functions.
 * Functions are organized by category according to the FHIRPath specification.
 */

import type { FhirPathCollection, EvaluatorState, FhirPathQuantity } from "./types.ts";

// ============================================================
// EXISTENCE FUNCTIONS
// ============================================================

/** Returns true if collection is empty */
export function empty(collection: FhirPathCollection): boolean {
  return collection.length === 0;
}

/** Returns true if collection has any elements */
export function exists(collection: FhirPathCollection): boolean {
  return collection.length > 0;
}

/** Returns true if all elements satisfy the criteria */
export function all(collection: FhirPathCollection, criteria: boolean[]): boolean {
  if (collection.length === 0) return true;
  return criteria.every(c => c === true);
}

/** Returns true if all elements are true */
export function allTrue(collection: FhirPathCollection): boolean {
  if (collection.length === 0) return true;
  return collection.every(item => item === true);
}

/** Returns true if any element is true */
export function anyTrue(collection: FhirPathCollection): boolean {
  return collection.some(item => item === true);
}

/** Returns true if all elements are false */
export function allFalse(collection: FhirPathCollection): boolean {
  if (collection.length === 0) return true;
  return collection.every(item => item === false);
}

/** Returns true if any element is false */
export function anyFalse(collection: FhirPathCollection): boolean {
  return collection.some(item => item === false);
}

/** Returns true if collection has a single element with a value */
export function hasValue(collection: FhirPathCollection): boolean {
  return collection.length === 1 && collection[0] != null;
}

/** Returns true if collection has all distinct elements */
export function isDistinct(collection: FhirPathCollection): boolean {
  const seen = new Set();
  for (const item of collection) {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/** Returns true if collection is a subset of other */
export function subsetOf(collection: FhirPathCollection, other: FhirPathCollection): boolean {
  const otherSet = new Set(other.map(i => JSON.stringify(i)));
  return collection.every(item => otherSet.has(JSON.stringify(item)));
}

/** Returns true if collection is a superset of other */
export function supersetOf(collection: FhirPathCollection, other: FhirPathCollection): boolean {
  return subsetOf(other, collection);
}

// ============================================================
// FILTERING FUNCTIONS
// ============================================================

/** Returns distinct elements */
export function distinct(collection: FhirPathCollection): FhirPathCollection {
  const seen = new Set();
  const result: FhirPathCollection = [];
  for (const item of collection) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/** Returns first element or empty */
export function first(collection: FhirPathCollection): FhirPathCollection {
  return collection.length > 0 ? [collection[0]] : [];
}

/** Returns last element or empty */
export function last(collection: FhirPathCollection): FhirPathCollection {
  return collection.length > 0 ? [collection[collection.length - 1]] : [];
}

/** Returns all but first element */
export function tail(collection: FhirPathCollection): FhirPathCollection {
  return collection.slice(1);
}

/** Returns first n elements */
export function take(collection: FhirPathCollection, n: number): FhirPathCollection {
  return collection.slice(0, n);
}

/** Returns all but first n elements */
export function skip(collection: FhirPathCollection, n: number): FhirPathCollection {
  return collection.slice(n);
}

/** Returns single element or empty (error if multiple) */
export function single(collection: FhirPathCollection): FhirPathCollection {
  if (collection.length === 0) return [];
  if (collection.length === 1) return collection;
  throw new Error("single() called on collection with multiple elements");
}

// ============================================================
// AGGREGATE FUNCTIONS
// ============================================================

/** Returns count of elements */
export function count(collection: FhirPathCollection): number {
  return collection.length;
}

/** Returns sum of numeric values */
export function sum(collection: FhirPathCollection): number | undefined {
  if (collection.length === 0) return undefined;
  let total = 0;
  for (const item of collection) {
    if (typeof item === "number") {
      total += item;
    } else {
      return undefined;
    }
  }
  return total;
}

/** Returns minimum value */
export function min(collection: FhirPathCollection): unknown {
  if (collection.length === 0) return undefined;
  return collection.reduce((a, b) => (a as number) < (b as number) ? a : b);
}

/** Returns maximum value */
export function max(collection: FhirPathCollection): unknown {
  if (collection.length === 0) return undefined;
  return collection.reduce((a, b) => (a as number) > (b as number) ? a : b);
}

/** Returns average of numeric values */
export function avg(collection: FhirPathCollection): number | undefined {
  const s = sum(collection);
  if (s === undefined) return undefined;
  return s / collection.length;
}

// ============================================================
// COMBINING FUNCTIONS
// ============================================================

/** Combines two collections (with duplicates) */
export function combine(col1: FhirPathCollection, col2: FhirPathCollection): FhirPathCollection {
  return [...col1, ...col2];
}

/** Returns union of two collections (distinct) */
export function union(col1: FhirPathCollection, col2: FhirPathCollection): FhirPathCollection {
  return distinct([...col1, ...col2]);
}

/** Returns intersection of two collections */
export function intersect(col1: FhirPathCollection, col2: FhirPathCollection): FhirPathCollection {
  const set2 = new Set(col2.map(i => JSON.stringify(i)));
  return distinct(col1.filter(item => set2.has(JSON.stringify(item))));
}

/** Returns elements in col1 but not in col2 */
export function exclude(col1: FhirPathCollection, col2: FhirPathCollection): FhirPathCollection {
  const set2 = new Set(col2.map(i => JSON.stringify(i)));
  return col1.filter(item => !set2.has(JSON.stringify(item)));
}

// ============================================================
// STRING FUNCTIONS
// ============================================================

/** Returns index of substring */
export function indexOf(str: string, search: string): number {
  return str.indexOf(search);
}

/** Returns substring */
export function substring(str: string, start: number, length?: number): string {
  if (length === undefined) {
    return str.substring(start);
  }
  return str.substring(start, start + length);
}

/** Returns true if string starts with prefix */
export function startsWith(str: string, prefix: string): boolean {
  return str.startsWith(prefix);
}

/** Returns true if string ends with suffix */
export function endsWith(str: string, suffix: string): boolean {
  return str.endsWith(suffix);
}

/** Returns true if string contains substring */
export function contains(str: string, search: string): boolean {
  return str.includes(search);
}

/** Returns uppercase string */
export function upper(str: string): string {
  return str.toUpperCase();
}

/** Returns lowercase string */
export function lower(str: string): string {
  return str.toLowerCase();
}

/** Replaces occurrences of pattern */
export function replace(str: string, pattern: string, replacement: string): string {
  return str.split(pattern).join(replacement);
}

/** Returns true if string matches regex */
export function matches(str: string, regex: string): boolean {
  return new RegExp(regex).test(str);
}

/** Replaces regex matches */
export function replaceMatches(str: string, regex: string, replacement: string): string {
  return str.replace(new RegExp(regex, "g"), replacement);
}

/** Returns length of string */
export function length(str: string): number {
  return str.length;
}

/** Converts to string */
export function toChars(str: string): string[] {
  return str.split("");
}

/** Splits string */
export function split(str: string, separator: string): string[] {
  return str.split(separator);
}

/** Joins collection */
export function join(collection: FhirPathCollection, separator?: string): string {
  return collection.map(String).join(separator ?? "");
}

/** Trims whitespace */
export function trim(str: string): string {
  return str.trim();
}

// ============================================================
// MATH FUNCTIONS
// ============================================================

/** Returns absolute value */
export function abs(n: number): number {
  return Math.abs(n);
}

/** Returns ceiling */
export function ceiling(n: number): number {
  return Math.ceil(n);
}

/** Returns floor */
export function floor(n: number): number {
  return Math.floor(n);
}

/** Returns rounded value */
export function round(n: number, precision?: number): number {
  if (precision === undefined) {
    return Math.round(n);
  }
  const factor = Math.pow(10, precision);
  return Math.round(n * factor) / factor;
}

/** Returns truncated value */
export function truncate(n: number): number {
  return Math.trunc(n);
}

/** Returns exponent */
export function exp(n: number): number {
  return Math.exp(n);
}

/** Returns natural log */
export function ln(n: number): number {
  return Math.log(n);
}

/** Returns log base 10 */
export function log(n: number, base: number): number {
  return Math.log(n) / Math.log(base);
}

/** Returns power */
export function power(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

/** Returns square root */
export function sqrt(n: number): number {
  return Math.sqrt(n);
}

// ============================================================
// TYPE CONVERSION FUNCTIONS
// ============================================================

/** Converts to integer */
export function toInteger(value: unknown): number | undefined {
  if (typeof value === "number") return Math.trunc(value);
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return isNaN(n) ? undefined : n;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return undefined;
}

/** Converts to decimal */
export function toDecimal(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return isNaN(n) ? undefined : n;
  }
  if (typeof value === "boolean") return value ? 1.0 : 0.0;
  return undefined;
}

/** Converts to string */
export function toString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  return undefined;
}

/** Converts to boolean */
export function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return undefined;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  return undefined;
}

// ============================================================
// LOGIC FUNCTIONS
// ============================================================

/** Logical not */
export function not(value: boolean): boolean {
  return !value;
}

/** If-then-else */
export function iif(condition: boolean, trueValue: FhirPathCollection, falseValue: FhirPathCollection): FhirPathCollection {
  return condition ? trueValue : falseValue;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** Returns current date */
export function today(): string {
  return new Date().toISOString().split("T")[0];
}

/** Returns current datetime */
export function now(): string {
  return new Date().toISOString();
}

/** Returns current time */
export function timeOfDay(): string {
  return new Date().toISOString().split("T")[1].split(".")[0];
}
