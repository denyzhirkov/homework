// JSON operations: parse, get, set, stringify, merge.
// Tags: built-in
//
// Usage Example (parse):
// {
//   "module": "json",
//   "params": {
//     "op": "parse",
//     "input": "${prev}"
//   }
// }
//
// Usage Example (get - extract value by path):
// {
//   "module": "json",
//   "params": {
//     "op": "get",
//     "input": "${results.apiResponse}",
//     "path": "$.data.items[0].id"
//   }
// }
//
// Usage Example (set - modify value at path):
// {
//   "module": "json",
//   "params": {
//     "op": "set",
//     "input": "${results.config}",
//     "path": "$.version",
//     "value": "1.2.3"
//   }
// }
//
// Usage Example (stringify):
// {
//   "module": "json",
//   "params": {
//     "op": "stringify",
//     "input": "${results.data}",
//     "pretty": true
//   }
// }
//
// Usage Example (merge):
// {
//   "module": "json",
//   "params": {
//     "op": "merge",
//     "input": "${results.base}",
//     "merge": { "newKey": "newValue" }
//   }
// }
//
// Full params:
// {
//   "module": "json",
//   "params": {
//     "op": "get",               // Operation: parse, get, set, stringify, merge (required)
//     "input": "${prev}",        // Input data (string for parse, object for others)
//     "path": "$.data.items[0]", // JSONPath for get/set operations
//     "value": "new value",      // Value for set operation
//     "merge": { "key": "val" }, // Object to merge for merge operation
//     "pretty": true,            // Pretty print for stringify (default: false)
//     "indent": 2                // Indentation spaces for stringify (default: 2)
//   }
// }
//
// Returns:
// - parse: parsed JSON object
// - get: extracted value (any type)
// - set: modified JSON object
// - stringify: JSON string
// - merge: merged JSON object
//
// JSONPath Syntax:
// - $.key - root level key
// - $.nested.key - nested key
// - $.array[0] - array index
// - $.array[*] - all array elements
// - $.array[-1] - last array element
//
// Usage in Pipeline:
// {
//   "name": "Process API Response",
//   "steps": [
//     {
//       "name": "fetch",
//       "module": "http",
//       "params": { "url": "https://api.example.com/users" }
//     },
//     {
//       "name": "extract_first_user",
//       "module": "json",
//       "params": {
//         "op": "get",
//         "input": "${results.fetch}",
//         "path": "$.data.users[0]"
//       }
//     },
//     {
//       "name": "update_user",
//       "module": "json",
//       "params": {
//         "op": "set",
//         "input": "${prev}",
//         "path": "$.status",
//         "value": "processed"
//       }
//     }
//   ]
// }

import type { PipelineContext, ModuleResult } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    op: {
      type: "string",
      required: true,
      enum: ["parse", "get", "set", "stringify", "merge"],
      description: "JSON operation: parse, get, set, stringify, or merge"
    },
    // Common (always visible)
    input: {
      type: "any",
      required: true,
      description: "Input data (string for parse, object for other operations)"
    },
    // Get/Set-specific
    path: {
      type: "string",
      required: false,
      description: "JSONPath expression for get/set (e.g., $.data.items[0].id)",
      visibleWhen: { param: "op", equals: ["get", "set"] }
    },
    // Set-specific
    value: {
      type: "any",
      required: false,
      description: "Value to set at path (required for set operation)",
      visibleWhen: { param: "op", equals: "set" }
    },
    // Merge-specific
    merge: {
      type: "object",
      required: false,
      description: "Object to merge with input (required for merge operation)",
      visibleWhen: { param: "op", equals: "merge" }
    },
    // Stringify-specific
    pretty: {
      type: "boolean",
      required: false,
      default: false,
      description: "Pretty print JSON output (for stringify)",
      visibleWhen: { param: "op", equals: "stringify" }
    },
    indent: {
      type: "number",
      required: false,
      default: 2,
      description: "Indentation spaces for pretty print",
      visibleWhen: { param: "op", equals: "stringify" }
    }
  }
};

export interface JSONParams {
  op: "parse" | "get" | "set" | "stringify" | "merge";
  input: unknown;
  path?: string;
  value?: unknown;
  merge?: Record<string, unknown>;
  pretty?: boolean;
  indent?: number;
}

export function run(
  ctx: PipelineContext,
  params: JSONParams
): ModuleResult {
  if (!params.op) {
    throw new Error("JSON module requires 'op' parameter");
  }
  if (params.input === undefined) {
    throw new Error("JSON module requires 'input' parameter");
  }

  switch (params.op) {
    case "parse":
      return parseJSON(ctx, params);
    case "get":
      return getJSON(ctx, params);
    case "set":
      return setJSON(ctx, params);
    case "stringify":
      return stringifyJSON(ctx, params);
    case "merge":
      return mergeJSON(ctx, params);
    default:
      throw new Error(`Unknown JSON operation: ${params.op}`);
  }
}

function parseJSON(ctx: PipelineContext, params: JSONParams): ModuleResult {
  if (typeof params.input !== "string") {
    // Already an object, return as-is
    if (ctx.log) ctx.log(`[JSON] Input is already an object, returning as-is`);
    return params.input as Record<string, unknown>;
  }

  try {
    const result = JSON.parse(params.input);
    if (ctx.log) ctx.log(`[JSON] Parsed JSON successfully`);
    return result;
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function getJSON(ctx: PipelineContext, params: JSONParams): ModuleResult {
  if (!params.path) {
    throw new Error("JSON get requires 'path' parameter");
  }

  const obj = ensureObject(params.input);
  const value = getByPath(obj, params.path);

  if (ctx.log) ctx.log(`[JSON] Got value at path "${params.path}"`);

  // Return the value (could be string, number, object, array, null)
  if (value === null) return { value: null };
  if (typeof value === "string") return value;
  if (typeof value === "number") return { value };
  if (typeof value === "boolean") return { value };
  if (Array.isArray(value)) return { items: value, count: value.length };
  return value as Record<string, unknown>;
}

function setJSON(ctx: PipelineContext, params: JSONParams): ModuleResult {
  if (!params.path) {
    throw new Error("JSON set requires 'path' parameter");
  }
  if (params.value === undefined) {
    throw new Error("JSON set requires 'value' parameter");
  }

  const obj = ensureObject(params.input);
  const result = setByPath(obj, params.path, params.value);

  if (ctx.log) ctx.log(`[JSON] Set value at path "${params.path}"`);

  return result as Record<string, unknown>;
}

function stringifyJSON(ctx: PipelineContext, params: JSONParams): string {
  const obj = ensureObject(params.input);
  const indent = params.pretty ? (params.indent || 2) : undefined;

  try {
    const result = JSON.stringify(obj, null, indent);
    if (ctx.log) ctx.log(`[JSON] Stringified JSON (${result.length} chars)`);
    return result;
  } catch (e) {
    throw new Error(`Failed to stringify JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function mergeJSON(ctx: PipelineContext, params: JSONParams): ModuleResult {
  if (!params.merge) {
    throw new Error("JSON merge requires 'merge' parameter");
  }

  const obj = ensureObject(params.input);
  const result = deepMerge(obj, params.merge);

  if (ctx.log) ctx.log(`[JSON] Merged objects`);

  return result as Record<string, unknown>;
}

// Helper: ensure input is an object
function ensureObject(input: unknown): Record<string, unknown> | unknown[] {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      throw new Error("Input is a string but not valid JSON");
    }
  }
  if (typeof input === "object" && input !== null) {
    return input as Record<string, unknown>;
  }
  throw new Error(`Expected object or JSON string, got ${typeof input}`);
}

// Simple JSONPath implementation
// Supports: $.key, $.nested.key, $.array[0], $.array[-1], $.array[*]
function parsePath(path: string): (string | number)[] {
  // Remove leading $ if present
  const p = path.startsWith("$.") ? path.substring(2) : path.startsWith("$") ? path.substring(1) : path;
  
  const segments: (string | number)[] = [];
  let current = "";
  let inBracket = false;

  for (let i = 0; i < p.length; i++) {
    const char = p[i];
    
    if (char === "[") {
      if (current) {
        segments.push(current);
        current = "";
      }
      inBracket = true;
    } else if (char === "]") {
      if (current === "*") {
        segments.push("*");
      } else {
        const num = parseInt(current, 10);
        segments.push(isNaN(num) ? current : num);
      }
      current = "";
      inBracket = false;
    } else if (char === "." && !inBracket) {
      if (current) {
        segments.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

function getByPath(obj: unknown, path: string): unknown {
  const segments = parsePath(path);
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (segment === "*") {
      // Return all array elements
      if (Array.isArray(current)) {
        return current;
      }
      return undefined;
    }

    if (typeof segment === "number") {
      if (Array.isArray(current)) {
        // Support negative indices
        const index = segment < 0 ? current.length + segment : segment;
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }
  }

  return current;
}

function setByPath(obj: unknown, path: string, value: unknown): unknown {
  const segments = parsePath(path);
  
  // Deep clone to avoid mutation
  const result = JSON.parse(JSON.stringify(obj));
  
  let current: unknown = result;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    
    if (typeof segment === "number") {
      if (Array.isArray(current)) {
        const index = segment < 0 ? current.length + segment : segment;
        if (current[index] === undefined) {
          // Create object or array based on next segment
          const nextSegment = segments[i + 1];
          current[index] = typeof nextSegment === "number" ? [] : {};
        }
        current = current[index];
      } else {
        throw new Error(`Cannot index non-array with number at path segment ${i}`);
      }
    } else {
      if (typeof current === "object" && current !== null && !Array.isArray(current)) {
        const obj = current as Record<string, unknown>;
        if (obj[segment] === undefined) {
          // Create object or array based on next segment
          const nextSegment = segments[i + 1];
          obj[segment] = typeof nextSegment === "number" ? [] : {};
        }
        current = obj[segment];
      } else {
        throw new Error(`Cannot access property "${segment}" on non-object at path segment ${i}`);
      }
    }
  }

  // Set the final value
  const lastSegment = segments[segments.length - 1];
  
  if (typeof lastSegment === "number") {
    if (Array.isArray(current)) {
      const index = lastSegment < 0 ? current.length + lastSegment : lastSegment;
      current[index] = value;
    } else {
      throw new Error(`Cannot set array index on non-array`);
    }
  } else {
    if (typeof current === "object" && current !== null && !Array.isArray(current)) {
      (current as Record<string, unknown>)[lastSegment] = value;
    } else {
      throw new Error(`Cannot set property on non-object`);
    }
  }

  return result;
}

// Deep merge helper
function deepMerge(target: unknown, source: unknown): unknown {
  if (typeof target !== "object" || target === null) {
    return source;
  }
  if (typeof source !== "object" || source === null) {
    return source;
  }
  if (Array.isArray(target) || Array.isArray(source)) {
    // For arrays, replace entirely (don't merge element by element)
    return source;
  }

  const result: Record<string, unknown> = { ...target as Record<string, unknown> };
  const sourceObj = source as Record<string, unknown>;

  for (const key of Object.keys(sourceObj)) {
    if (key in result && typeof result[key] === "object" && typeof sourceObj[key] === "object") {
      result[key] = deepMerge(result[key], sourceObj[key]);
    } else {
      result[key] = sourceObj[key];
    }
  }

  return result;
}

