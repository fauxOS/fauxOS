import processTable from "./index.js";
import Process from "./process.js";
import fs from "../fs/index.js";

// Relative to absolute path based on a process
function resolvePath(inputPath, process) {
  if (inputPath[0] === "/") {
    return inputPath;
  } else {
    return process.cwd + "/" + inputPath;
  }
}

// Raise an error
function fail(process, id, reason) {
  process.worker.postMessage({
    status: "error",
    reason,
    id
  });
}

// Pass a success result
function pass(process, id, result) {
  process.worker.postMessage({
    status: "success",
    result,
    id
  });
}

// Spawn a new process from an executable image
export function spawn(process, msgID, args) {
  const [image, argv] = args;
  if (typeof image !== "string") {
    return fail(process, msgID, "First argument - image - should be a string");
  }
  if (!argv instanceof Array) {
    return fail(process, msgID, "Second argument - argv - should be an array");
  }
  const newProcess = new Process(image, argv);
  const pid = processTable.add(newProcess);
  return pass(process, msgID, pid);
}

// Spawn a new process from a file path
export function exec(process, msgID, args) {
  const [inputPath, argv] = args;
  if (typeof inputPath !== "string") {
    return fail(process, msgID, "First argument - path - should be a string");
  }
  if (!argv instanceof Array) {
    return fail(process, msgID, "Second argument - argv - should be an array");
  }
  const safePath = resolvePath(inputPath, process);
  const image = fs.resolve(safePath).data;
  const newProcess = new Process(image, argv);
  const pid = processTable.add(newProcess);
  return pass(process, msgID, pid);
}

// Check file access
export function access(process, msgID, args) {
  const [inputPath] = args;
  if (typeof inputPath !== "string") {
    return fail(process, msgID, "First argument - path - should be a string");
  }
  const safePath = resolvePath(inputPath, process);
  const result = process.access(safePath);
  return pass(process, msgID, result);
}

// Get file/directory info
export function stat(process, msgID, args) {
  const [inputPath] = args;
  if (typeof inputPath !== "string") {
    return fail(process, msgID, "First argument - path - should be a string");
  }
  const safePath = resolvePath(inputPath, process);
  const vnode = fs.resolve(safePath);
}

// Resolve a path into a file descriptor, and add it to the table
export function open(process, msgID, args) {
  const [inputPath, mode] = args;
  if (typeof inputPath !== "string") {
    return fail(process, msgID, "First argument - path - should be a string");
  }
  if (typeof mode !== "string") {
    return fail(process, msgID, "Second argument - mode - should be a string");
  }
  const safePath = resolvePath(inputPath, process);
  const fd = process.open(safePath, mode);
  return pass(process, msgID, fd);
}

// Read data from a file descriptor
export function read(process, msgID, args) {
  const [fd] = args;
  if (fd < 0) {
    return fail(process, msgID, "File Descriptor should be >= 0");
  }
  const data = process.fds[fd].read();
  return pass(process, msgID, data);
}

// Write data to a file descriptor
export function write(process, msgID, args) {
  const [fd, data] = args;
  if (fd < 0) {
    return fail(process, msgID, "File Descriptor should be >= 0");
  }
  if (typeof data !== "string") {
    return fail(process, msgID, "Second argument - data - should be a string");
  }
  const result = process.fds[fd].write(data);
  return pass(process, msgID, result);
}

// Tell what directory we are in
export function pwd(process, msgID, args) {
  return pass(process, msgID, process.cwd);
}

// Change the current working directory
export function chdir(process, msgID, args) {
  const [inputPath] = args;
  if (typeof inputPath !== "string") {
    return fail(process, msgID, "First argument - path - should be a string");
  }
  const safePath = resolvePath(inputPath, process);
  const result = (process.cwd = safePath);
  return pass(process, msgID, result);
}

// Get environment variable
export function getenv(process, msgID, args) {
  const [key] = args;
  if (key) {
    if (typeof key !== "string") {
      return fail(
        process,
        msgID,
        "First argument - key - should be a string (or a falsey value)"
      );
    }
    const value = process.env[key];
    return pass(process, msgID, value);
  } else {
    return pass(process, msgID, process.env);
  }
}

// Set environment variable
export function setenv(process, msgID, args) {
  const [key, value] = args;
  if (typeof key !== "string") {
    return fail(process, msgID, "First argument - key - should be a string");
  }
  if (typeof value !== "string") {
    return fail(process, msgID, "Second argument - value - should be a string");
  }
  const result = (process.env[key] = value);
  return pass(process, msgID, result);
}
