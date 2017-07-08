(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define('faux', factory) :
	(global.faux = factory());
}(this, (function () { 'use strict';

// Throws an error if argument is not a string
function assertString(str) {
  if (typeof str !== "string") {
    throw new Error("Some argument is not a string");
  }
}

// normalize a crazy path
// e.g. "/the///./../a/crazy/././path" => "/a/crazy/path"
function normalize(path) {
  // Empty or no input
  if (!path) {
    return ".";
  }
  assertString(path);
  // An array to hold the significant path parts
  const significant = [];
  // Assume relative path,
  let isAbsolute = false;
  // but reassign if absolute
  if (path.indexOf("/") === 0) {
    isAbsolute = true;
  }

  // Split the path by "/", match() because it doesn't add empty strings
  const pathArray = path.match(/[^/]+/g);
  // Iterate each name in the path
  for (let i in pathArray) {
    const name = pathArray[i];
    const lastItem = significant[significant.length - 1];
    // We ignore all current directory dots
    if (name === ".") {
    } else if (name === "..") {
      // No parent of the root directory to care about
      if (isAbsolute) {
        significant.pop();
      } else {
        // Push if the array is empty or if there is nothing to pop
        // (Don't pop a "..")
        if (significant.length === 0 || lastItem === "..") {
          significant.push("..");
        } else {
          significant.pop();
        }
      }
    } else {
      // Just push everything else
      significant.push(name);
    }
  }
  if (isAbsolute) {
    return "/" + significant.join("/");
  } else {
    return significant.join("/");
  }
}

// Splits POSIX path ("/directories/leading/to/file.ext") into
// 1: "/" (if absolute)
// 2: "directories/leading/to/" (if any)
// 3: "file.ext" (the basename)
// 4: ".ext" (extention)
const splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;

// POSIX parse the path
function parse(path = "") {
  assertString(path);
  const normalized = normalize(path);
  // Use the POSIX path split regex
  const matches = normalized.match(splitPathRe);
  return {
    root: matches[1],
    dir: matches[2],
    base: matches[3],
    ext: matches[4],
    name: matches[3].slice(0, matches[3].length - matches[4].length)
  };
}

// Parent name, get the parent directory
// "/directories/hold/files/like-this-one" => "/directories/hold/files"
function dirname(path = "") {
  const parsed = parse(path);
  // If absolute path
  if (parsed.root) {
    return "/" + parsed.dir;
  } else {
    return parsed.dir;
  }
}

// Basename from the normal name
// "/path/to/filename.txt" => "filename.txt"
// You can also specify an extention
// basename("filename.txt", ".txt") => "filename"
function basename(path = "", extension = "") {
  const basename = parse(path).base;
  // The basename is returned unless an extension argument is set and valid
  const indexOf = basename.indexOf(extension);
  // Extention must be included specifically at the end of the basename
  if (indexOf && indexOf + extension.length === basename.length) {
    return basename.slice(0, indexOf);
  } else {
    return basename;
  }
}

// Get the final extention


// Join all the arguments into one clean path


// Chop a path into an array of names
// "/paths/are/like/arrays" => ["paths", "are", "like", "arrays"]
function chop(path) {
  const segments = normalize(path).match(/[^/]+/g);
  if (!segments) {
    return ["/"];
  } else {
    return segments;
  }
}

class OFS_Inode {
  constructor(config = {}) {
    this.links = 0;
    this.exec = false;
    Object.assign(this, config);
  }
}

class OFS {
  constructor() {
    this.drive = arguments[0] || [
      new OFS_Inode({
        links: 1,
        id: 0,
        type: "d",
        files: {}
      })
    ];
  }

  // Resolve path to an inode, don't follow symbolic links
  resolveHard(path) {
    let inode = 0;
    const trace = [inode];
    if (path === "/" || path === "") {
      return this.drive[inode];
    }
    const pathArray = chop(path);
    for (let i = 0; i < pathArray.length; i++) {
      const name = pathArray[i];
      const inodeObj = this.drive[inode];
      if (inodeObj.files === undefined) {
        // Could not resolve path to inodes completely
        return -1;
      }
      inode = inodeObj.files[name];
      if (inode === undefined) {
        // Could not find end inode, failed at segment name
        return -1;
      }
      trace.push(inode);
    }
    return this.drive[trace.pop()];
  }

  // Resolve and return the inode, follow symbolic links
  resolve(path, redirectCount = 0) {
    // Don't follow if we get to 50 symbolic link redirects
    if (redirectCount >= 50) {
      // Max symbolic link redirect count reached (50)
      return -1;
    }
    const inode = this.resolveHard(path);
    if (inode < 0) {
      // Error on hard resolve
      return -1;
    }
    if (inode.type === "sl") {
      redirectCount++;
      return this.resolve(inode.redirect, redirectCount);
    }
    return inode;
  }

  // Add a new inode to the disk
  // Defaults to just adding an inode, but if you pass a parent directory inode in,
  // it will add `name` as an entry in `parentInode`
  addInode(type, name = null, parentInode = null) {
    // Reject if name contains a "/"
    if (name.match("/")) {
      return -1;
    }
    const id = this.drive.length;
    this.drive[id] = new OFS_Inode({
      links: 1,
      type: type,
      id: id
    });
    // Check parent if inode and directory
    if (parentInode instanceof OFS_Inode && parentInode.type === "d") {
      parentInode.files[name] = id;
    }
    return this.drive[id];
  }

  // Add a new file to the disk
  touch(path) {
    const parentInode = this.resolve(dirname(path));
    const name = basename(path);
    const inode = this.addInode("f", name, parentInode);
    if (inode < 0) {
      return -1;
    }
    inode.data = "";
    return inode;
  }

  // Add a new directory Inode to the disk
  mkDir(path) {
    const parentInode = this.resolve(dirname(path));
    const name = basename(path);
    const inode = this.addInode("d", name, parentInode);
    if (inode < 0) {
      return -1;
    }
    inode.files = {};
    return inode;
  }

  // Make a hard link for an inode
  mkLink(inode, path) {
    const parentInode = this.resolve(dirname(path));
    const name = basename(path);
    // Same as in addInode, not very DRY I know...
    if (name.match("/")) {
      return -1;
    }
    parentInode.files[name] = inode.id;
    return inode;
  }

  // Make a symbolic link inode
  mkSymLink(refPath, linkPath) {
    const parentInode = this.resolve(dirname(path));
    const name = basename(path);
    const inode = this.addInode("sl", name, parentInode);
    if (inode < 0) {
      return -1;
    }
    inode.redirect = normalize(refPath);
    return inode;
  }

  // Remove by unlinking
  rm(path) {
    const parentInode = this.resolve(dirname(path));
    const name = basename(path);
    if (parentInode < 0) {
      return -1;
    }
    return delete parentInode.files[name];
  }
}

class DOMFS {
  constructor(selectorBase = "") {
    this.base = selectorBase;
  }

  resolve(path) {
    const chopped = chop(path);
    // If we are at the DOM root, i.e. /dev/dom/
    if (chopped[0] === "/") {
      return document.querySelector("*");
    } else {
      let selector = " " + chopped.join(" > ");
      // For child selection by index
      // element.children[0] becomes /dev/dom/element/1
      selector = selector.replace(/ (\d)/g, " :nth-child($1)");
      return document.querySelector(selector);
    }
  }

  touch(path) {
    const parent = this.resolve(dirname(path));
    if (!parent) {
      return -1;
    }
    // When creating an element, you are only allowed to use the element name
    // e.g. touch("/dev/dom/body/#container/span")
    // You cannot touch a class, index, or id
    const el = document.createElement(basename(path));
    return parent.appendChild(el);
  }
}

class VNode {
  constructor(container) {
    this.container = container;
    this.type = this.findType();
    this.exec = this.isExecutable();
  }

  findType() {
    if (this.container instanceof OFS_Inode) {
      return "inode";
    } else if (this.container instanceof HTMLElement) {
      return "element";
    } else {
      return "unknown";
    }
  }

  isExecutable() {
    if (this.type === "inode") {
      return this.container.exec;
    } else {
      return false;
    }
  }

  get data() {
    if (this.type === "inode") {
      const data = this.container.data;
      // Directory or other
      if (data === undefined) {
        return -2;
      }
      return data;
    } else if (this.type === "element") {
      return this.container.innerHTML;
    } else {
      return -1;
    }
  }

  set data(data) {
    if (this.type === "inode") {
      this.container.data = data;
      return data;
    } else if (this.type === "element") {
      this.container.innerHTML = data;
      return data;
    } else {
      return -1;
    }
  }

  get files() {
    if (this.type === "inode") {
      if (this.container.type === "d") {
        return Object.keys(this.container.files);
      } else {
        return null;
      }
    } else if (this.type === "element") {
      if (this.container.hasChildNodes()) {
        const children = this.container.children;
        const elements = [];
        for (let i = 0; i < children.length; i++) {
          let el = children[i].localName;
          let id = children[i].id;
          let classes = children[i].className.split(" ").join(".");
          elements.push(el + id + classes);
          // Child by index
          elements.push(i + 1);
        }
        return elements;
      } else {
        return null;
      }
    } else {
      return -1;
    }
  }
}

class VFS {
  constructor(rootDrive = new OFS()) {
    this.mounts = {
      "/": rootDrive
    };
  }

  // Mount a filesystem
  mount(fs, mountPoint) {
    const normalized = normalize(mountPoint);
    this.mounts[normalized] = fs;
    return normalized;
  }

  // Unmount a filesystem by mount point
  unmount(mountPoint) {
    const normalized = normalize(mountPoint);
    return delete this.mounts[normalized];
  }

  // Resolve the path to the mounted filesystem
  // This is the first step to trace a path, before any data containers (inodes etc) are involved
  mountPoint(path) {
    // Get the segments of a path like this : ["/", "/path", "/path/example"]
    const pathArray = chop(path);
    // If its a root path, skip segments
    if (pathArray.length === 1 && pathArray[0] === "/") {
      return pathArray;
    }
    const segments = [];
    // Applies to any other path
    for (let i = 0; i <= pathArray.length; i++) {
      let matchPath = pathArray.slice(0, i);
      segments.push("/" + matchPath.join("/"));
    }
    // Array of resolved mounted disks
    const resolves = [];
    // Iterate all of the mount points
    Object.keys(this.mounts).forEach(mount => {
      for (let i in segments) {
        if (segments[i] === mount) {
          resolves.push(mount);
        }
      }
    });
    // The most relevent mount point will be the last one resolved
    return resolves.pop();
  }

  // Resolve a path to the fs provided data container
  resolve(path) {
    const normalized = normalize(path);
    const mountPoint = this.mountPoint(normalized);
    const fs = this.mounts[mountPoint];
    // This strips off the mountpoint path from the given path,
    // so that we can resolve relative to the filesystem's root.
    // Example: given path is "/dev/dom/head/title"
    // We find that the mountpoint is "/dev/dom".
    // "/dev/dom/head/title" - "/dev/dom" = "/head/title"
    // Pass "/head/title" to the local filesystem for it to resolve
    const fsLocalPath = normalized.substring(mountPoint.length);
    const container = fs.resolve(fsLocalPath);
    if (container < 0) {
      return -1;
    }
    return new VNode(container);
  }

  touch(path) {
    const normalized = normalize(path);
    const mountPoint = this.mountPoint(path);
    const fs = this.mounts[mountPoint];
    const fsLocalPath = normalized.substring(mountPoint.length);
    const touched = fs.touch(fsLocalPath);
    if (touched < 0) {
      return -1;
    }
    return touched;
  }
}

const fs = new VFS(
  new OFS([
    new OFS_Inode({
      links: 1,
      id: 0,
      type: "d",
      files: {
        bin: 1,
        dev: 2,
        etc: 3,
        home: 4,
        log: 5,
        tmp: 6
      }
    }),

    // /bin
    new OFS_Inode({
      links: 1,
      type: "d",
      id: 1,
      files: {
        fsh: 7
      }
    }),

    // /dev
    new OFS_Inode({
      links: 1,
      type: "d",
      id: 2,
      files: {}
    }),

    // /etc
    new OFS_Inode({
      links: 1,
      type: "d",
      id: 3,
      files: {}
    }),

    // /home
    new OFS_Inode({
      links: 1,
      type: "d",
      id: 4,
      files: {}
    }),

    // /log
    new OFS_Inode({
      links: 1,
      type: "d",
      id: 5,
      files: {}
    }),

    // /tmp
    new OFS_Inode({
      links: 1,
      type: "d",
      id: 6,
      files: {}
    }),

    // /bin/fsh
    new OFS_Inode({
      links: 1,
      type: "f",
      exec: true,
      id: 7,
      data: "(function(){\"use strict\";function tokenizeLine(line=\"\"){const tokens=line.match(/([\"'])(?:\\\\|.)+\\1|((?:[^\\\\\\s]|\\\\.)*)/g).filter(String);for(let token,i=0;i<tokens.length;i++)token=tokens[i],tokens[i]=token.replace(/\\\\(?=.)/g,\"\"),token.match(/^[\"'].+(\\1)$/m)&&(tokens[i]=/^([\"'])(.+)(\\1)$/gm.exec(token)[2]);return tokens}function lex(input=\"\"){const allTokens=[],lines=input.match(/(\\\\;|[^;])+/g);for(let tokens,i=0;i<lines.length;i++)tokens=tokenizeLine(lines[i]),allTokens.push(tokens);return allTokens}function parseCommand(tokens){const command={type:\"simple\",argv:tokens,argc:tokens.length,name:tokens[0]};return command}(function(input=\"\"){const AST={type:\"script\",commands:[]},commands=lex(input);for(let parsed,i=0;i<commands.length;i++)parsed=parseCommand(commands[i]),AST.commands[i]=parsed;return AST})(\"echo hello, world\")})();"
    })
  ])
);

fs.mount(new DOMFS(), "/dev/dom");

function getMode(modeStr = "r") {
  // prettier-ignore
  //             read,    write,  truncate,   create,   append
  const map = {
    "r":        [true,    false,  false,      false,    false],
    "r+":       [true,    true,   false,      false,    false],
    "w":        [false,   true,   true,       true,     false],
    "w+":       [true,    true,   true,       true,     false],
    "a":        [false,   true,   false,      true,     true],
    "a+":       [true,    true,   false,      true,     true]
  };
  return map[modeStr];
}

class FileDescriptor {
  constructor(path, mode) {
    this.mode = getMode(mode);
    this.path = normalize(path);
    this.vnode = fs.resolve(this.path);
    // Create if non-existent?
    if (!this.vnode.container) {
      if (!this.mode[3]) {
        throw new Error("Path Unresolved");
      } else {
        fs.touch(this.path);
        this.vnode = fs.resolve(this.path);
        // Probably an error creating the file
        if (this.vnode < 0) {
          throw new Error("Error on file creation or resolve");
        }
      }
    }
    // If truncate in mode
    if (this.mode[2]) {
      this.truncate();
    }
    this.type = this.vnode.type;
  }

  truncate() {
    this.vnode.data = "";
  }

  // Return read data
  read() {
    // Read mode set?
    if (!this.mode[0]) {
      return -1;
    }
    return this.vnode.data;
  }

  // Write data out
  write(data) {
    return (this.vnode.data = data);
  }

  // View "directory" contents or return null
  readdir() {
    return this.vnode.files;
  }
}

// Raise an error
function fail(process, msgID, args) {
  const error = {
    status: "error",
    reason: args[0],
    id: msgID
  };
  process.worker.postMessage(error);
}

// Throw a success result
function pass(process, msgID, args) {
  const result = {
    status: "success",
    result: args[0],
    id: msgID
  };
  process.worker.postMessage(result);
}

// Spawn a new process from an executable image
function spawn(process, msgID, args) {
  if (!args[1] instanceof Array) {
    fail(process, msgID, ["Second argument should be the array argv"]);
    return -1;
  }
  const newProcess = new Process(args[0], args[1]);
  const pid = proc.add(newProcess);
  pass(process, msgID, [pid]);
}

// Check file access
function access(process, msgID, args) {
  if (typeof args[0] !== "string") {
    fail(process, msgID, ["Argument should be a string"]);
    return -1;
  }
  let path = "";
  // If the first character is a "/", then working dir does not matter
  if (args[0][0] === "/") {
    path = args[0];
  } else {
    path = process.cwd + "/" + args[0];
  }
  const result = process.access(path);
  pass(process, msgID, [result]);
}

// Resolve a path into a file descriptor, and add it to the table
function open(process, msgID, args) {
  if (typeof args[0] !== "string" && typeof args[1] !== "string") {
    fail(process, msgID, ["Arguments 1 and 2 should be a strings"]);
    return -1;
  }
  let path = "";
  // If the first character is a "/", then working dir does not matter
  if (args[0][0] === "/") {
    path = args[0];
  } else {
    path = process.cwd + "/" + args[0];
  }
  const result = process.open(path, args[1]);
  pass(process, msgID, [result]);
}

// Read data from a file descriptor
function read(process, msgID, args) {
  if (args.length !== 1) {
    fail(process, msgID, ["Should have only 1 argument"]);
    return -1;
  }
  if (args[0] < 0) {
    fail(process, msgID, [
      "File Descriptor should be postive, check file name"
    ]);
    return -1;
  }
  const result = process.fds[args[0]].read();
  pass(process, msgID, [result]);
}

// Write data to a file descriptor
function write(process, msgID, args) {
  if (args.length !== 2) {
    fail(process, msgID, ["Should have 2 arguments"]);
    return -1;
  }
  if (args[0] < 0) {
    fail(process, msgID, [
      "File Descriptor should be postive, check file name"
    ]);
    return -1;
  }
  const result = process.fds[args[0]].write(args[1]);
  pass(process, msgID, [result]);
}

// Tell what directory we are in
function pwd(process, msgID, args) {
  pass(process, msgID, [process.cwd]);
}

// Change the current working directory
function chdir(process, msgID, args) {
  if (!args[0] instanceof String) {
    fail(process, msgID, ["Argument should be a string"]);
    return -1;
  }
  process.cwd = args[0];
  pass(process, msgID, [process.cwd]);
}

// Get environment variable
function getenv(process, msgID, args = [""]) {
  if (!args[0] instanceof String) {
    fail(process, msgID, ["Variable name should be a string"]);
    return -1;
  }
  if ((args = [""])) {
    pass(process, msgID, [process.env]);
  }
  const value = process.env[args[0]];
  pass(process, msgID, [value]);
}

// Set environment variable
function setenv(process, msgID, args) {
  if (!args[0] instanceof String) {
    fail(process, msgID, ["Variable name should be a string"]);
    return -1;
  }
  if (!args[1] instanceof String) {
    fail(process, msgID, ["Variable value should be a string"]);
    return -1;
  }
  const value = (process.env[args[0]] = args[1]);
  pass(process, msgID, [value]);
}


var sys = Object.freeze({
	spawn: spawn,
	access: access,
	open: open,
	read: read,
	write: write,
	pwd: pwd,
	chdir: chdir,
	getenv: getenv,
	setenv: setenv
});

function genUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(
    char
  ) {
    let r = (Math.random() * 16) | 0,
      v = char === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function mkWorker(scriptStr) {
  const blob = new Blob([scriptStr], { type: "application/javascript" });
  const uri = URL.createObjectURL(blob);
  return new Worker(uri);
}

function openLocalFile(readAs = "readAsText") {
  const input = document.createElement("input");
  input.type = "file";
  input.click();
  return new Promise(function(resolve, reject) {
    input.onchange = function() {
      const file = input.files[0];
      const reader = new FileReader();
      reader[readAs](file);
      reader.onloadend = function() {
        resolve(reader.result);
      };
    };
  });
}

function http(uri, method = "GET") {
  return new Promise((resolve, reject) => {
    if (!uri instanceof String) {
      reject("URI invalid");
    }
    const xhr = new XMLHttpRequest();
    xhr.open(method, uri, true);
    xhr.onload = function() {
      if (xhr.status < 300 && xhr.status >= 200) {
        resolve(xhr.response);
      } else {
        reject(xhr.status + " " + xhr.statusText);
      }
    };
    xhr.onerror = function(err) {
      reject(err);
    };
    xhr.send();
  });
}


var utils = Object.freeze({
	genUUID: genUUID,
	mkWorker: mkWorker,
	openLocalFile: openLocalFile,
	http: http
});

class Process {
  constructor(image, argv) {
    this.argv = [] || argv;
    this.argc = this.argv.length;
    this.fds = [];
    this.libs = [];
    this.cwd = "/";
    this.env = {
      SHELL: "fsh",
      PATH: "/sbin:/bin",
      HOME: "/home",
      TERM: "xterm-256color"
    };
    this.image = image;
    const lib = "(function(){\"use strict\";function newID(length=10){const chars=\"0123456789abcdefghiklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXTZ\".split(\"\");let id=\"\";for(let i=0;i<length;i++){const randomIndex=Math.floor(Math.random()*chars.length);id+=chars[randomIndex]}return id}function call(name,args){const id=newID();return postMessage({type:\"syscall\",name,args,id}),new Promise((resolve,reject)=>{function listener(message){const msg=message.data;msg.id===id&&(\"success\"===msg.status?resolve(msg.result):reject(msg.reason),removeEventListener(\"message\",listener))}addEventListener(\"message\",listener)})}function assertString(str){if(\"string\"!=typeof str)throw new Error(\"Some argument is not a string\")}function normalize(path){if(!path)return\".\";assertString(path);const significant=[];let isAbsolute=!1;0===path.indexOf(\"/\")&&(isAbsolute=!0);const pathArray=path.match(/[^/]+/g);for(let i in pathArray){const name=pathArray[i],lastItem=significant[significant.length-1];\".\"===name||(\"..\"===name?isAbsolute?significant.pop():0===significant.length||\"..\"===lastItem?significant.push(\"..\"):significant.pop():significant.push(name))}return isAbsolute?\"/\"+significant.join(\"/\"):significant.join(\"/\")}function parse(path=\"\"){assertString(path);const normalized=normalize(path),matches=normalized.match(splitPathRe);return{root:matches[1],dir:matches[2],base:matches[3],ext:matches[4],name:matches[3].slice(0,matches[3].length-matches[4].length)}}async function loadFile(path){if(await sys.access(path))return self.eval((await fs.readFile(path)));if(await sys.access(path+\".js\"))return self.eval((await fs.readFile(path+\".js\")));if(await sys.access(path+\".json\"))return JSON.parse((await fs.readFile(path+\".json\")));throw new Error(\"not found\")}function wrap(style,str){return\"\\x1B[\"+ansi[style][0]+\"m\"+str+\"\\x1B[\"+ansi[style][1]+\"m\"}function dye(styles,str){if(styles instanceof Array)for(let i in styles)str=wrap(styles[i],str);else\"string\"==typeof styles&&(str=wrap(styles,str));return str}var sys$1=Object.freeze({spawn:async function(image,argv=[]){return call(\"spawn\",[image,argv])},exec:async function(path,argv){return call(\"exec\",[path,argv])},access:async function(path){return call(\"access\",[path])},open:async function(path,mode=\"r\"){const fd=await call(\"open\",[path,mode]);return 0>fd?new Error(\"Could not open file\"):fd},read:async function(fd){const data=await call(\"read\",[fd]);if(-2===data)return new Error(\"No data returned, possibly a directory\");return 0>data?new Error(\"Could not get data\"):data},write:async function(fd,data){const ret=await call(\"write\",[fd,data]);return 0>ret?new Error(\"Could not write data\"):data},pwd:async function(){return call(\"pwd\",[])},chdir:async function(path){return call(\"chdir\",[path])},getenv:async function(varName){return call(\"getenv\",[varName])},setenv:async function(varName){return call(\"setenv\",[varName])}}),browser=function(){const ua=navigator.userAgent,matches=ua.match(/(vivaldi|opera|chrome|safari|firefox|msie|trident(?=\\/))\\/?\\s*([\\d.]+)/i)||[];if(/trident/i.test(matches[1])){const tem=ua.match(/\\brv[ :]+([\\d.]+)/g)||\"\";return[\"IE\",tem[1]]}if(\"Chrome\"===matches[1]){const tem=ua.match(/\\b(OPR|Edge)\\/([\\d.]+)/);if(tem)return[\"Opera\",tem[1]]}return matches[2]?{name:matches[1],version:matches[2]}:{name:navigator.appName,version:navigator.appVersion}}();const splitPathRe=/^(\\/?|)([\\s\\S]*?)((?:\\.{1,2}|[^\\/]+?|)(\\.[^.\\/]*|))(?:[\\/]*)$/;var path=Object.freeze({normalize:normalize,parse:parse,dirname:function(path=\"\"){const parsed=parse(path);return parsed.root?\"/\"+parsed.dir:parsed.dir},basename:function(path=\"\",extension=\"\"){const basename=parse(path).base,indexOf=basename.indexOf(extension);return indexOf&&indexOf+extension.length===basename.length?basename.slice(0,indexOf):basename},extname:function(path){return parse(path).ext},join:function(){const paths=[];for(let i in arguments)assertString(arguments[i]),paths.push(arguments[i]);const joined=paths.join(\"/\");return normalize(joined)},chop:function(path){const segments=normalize(path).match(/[^/]+/g);return segments?segments:[\"/\"]}}),fs$1=Object.freeze({readFile:async function(path=\"/\"){const fd=await sys.open(path,\"r\");return sys.read(fd)},writeFile:async function(path=\"/\",data=\"\"){const fd=await sys.open(path,\"w\");return sys.write(fd,data)}});const stdout={write(str){console.log(str)}};var process$1=Object.freeze({stdin:{},stdout:stdout,stderr:{}});const esc=\"\\x1B[\";const ansi={reset:[0,0],bold:[1,22],dim:[2,22],italic:[3,23],underline:[4,24],inverse:[7,27],hidden:[8,28],strikethrough:[9,29],black:[30,39],red:[31,39],green:[32,39],yellow:[33,39],blue:[34,39],magenta:[35,39],cyan:[36,39],white:[37,39],gray:[90,39],grey:[90,39],redBright:[91,39],greenBright:[92,39],yellowBright:[93,39],blueBright:[94,39],magentaBright:[95,39],cyanBright:[96,39],whiteBright:[97,39],bgBlack:[40,49],bgRed:[41,49],bgGreen:[42,49],bgYellow:[43,49],bgBlue:[44,49],bgMagenta:[45,49],bgCyan:[46,49],bgWhite:[47,49],bgGray:[100,49],bgGrey:[100,49],bgRedBright:[101,49],bgGreenBright:[102,49],bgYellowBright:[103,49],bgBlueBright:[104,49],bgMagentaBright:[105,49],bgCyanBright:[106,49],bgWhiteBright:[107,49]};var symbols={info:dye(\"blue\",\"\\u2139\"),success:dye(\"green\",\"\\u2714\"),warning:dye(\"yellow\",\"\\u26A0\"),error:dye(\"red\",\"\\u2716\"),star:dye(\"yellowBright\",\"\\u2605\"),radioOn:dye(\"green\",\"\\u25C9\"),radioOff:dye(\"red\",\"\\u25EF\"),checkboxOn:dye(\"green\",\"\\u2612\"),checkboxOff:dye(\"red\",\"\\u2610\"),arrowUp:\"\\u2191\",arrowDown:\"\\u2193\",arrowLeft:\"\\u2190\",arrowRight:\"\\u2192\",line:\"\\u2500\",play:\"\\u25B6\",pointer:\"\\u276F\",pointerSmall:\"\\u203A\",square:\"\\u2587\",squareSmall:\"\\u25FC\",bullet:\"\\u25CF\"};Object.assign(self,{sys:sys$1,browser,path,http:function(uri,method=\"GET\"){return new Promise((resolve,reject)=>{!uri instanceof String&&reject(\"URI invalid\");const xhr=new XMLHttpRequest;xhr.open(method,uri,!0),xhr.onload=function(){300>xhr.status&&200<=xhr.status?resolve(xhr.response):reject(xhr.status+\" \"+xhr.statusText)},xhr.onerror=function(err){reject(err)},xhr.send()})},fs:fs$1,process:process$1,require:async function(requirePath=\"\"){if(\"string\"!=typeof requirePath)throw new Error(\"argument is not a string\");try{return loadFile(requirePath)}catch(err){return loadFile(requirePath+\"/index\")}},cli:{ArgParser:class{constructor(options){this.options=options||{}}parse(argv=process.argv){}},control:{cursor:{move:{to:(x=1,y=1)=>esc+x+\";\"+y+\"H\",up:(n=1)=>esc+n+\"A\",down:(n=1)=>esc+n+\"B\",right:(n=1)=>esc+n+\"C\",left:(n=1)=>esc+n+\"D\",nextLine:()=>esc+\"E\",prevLine:()=>esc+\"F\",leftMost:()=>esc+\"G\"},hide:()=>esc+\"?25l\",show:()=>esc+\"?25h\",shape:{block:()=>\"\\x1B]50;CursorShape=0\\x07\",bar:()=>\"\\x1B]50;CursorShape=1\\x07\",underscore:()=>\"\\x1B]50;CursorShape=2\\x07\"},savePosition:()=>esc+\"s\",restorePosition:()=>esc+\"u\"},line:{eraseEnd:()=>esc+\"K\",eraseStart:()=>esc+\"1K\",erase:()=>esc+\"2K\"},screen:{eraseDown:()=>esc+\"J\",eraseUp:()=>esc+\"1J\",erase:()=>esc+\"2J\",clear:()=>\"\\x1Bc\",scrollUp:(n=1)=>esc+n+\"S\",scrollDown:(n=1)=>esc+n+\"T\"},beep:()=>\"\\x07\",setTitle:str=>\"\\x1B]0;\"+str+\"\\x07\"},dye,symbols,Spinner:class{constructor(name){const spinner={line:{fps:8,frames:[\"-\",\"\\\\\",\"|\",\"/\"]},dots:{fps:12.5,frames:[\"\\u280B\",\"\\u2819\",\"\\u2839\",\"\\u2838\",\"\\u283C\",\"\\u2834\",\"\\u2826\",\"\\u2827\",\"\\u2807\",\"\\u280F\"]},scrolling:{fps:5,frames:[\".  \",\".. \",\"...\",\" ..\",\"  .\",\"   \"]},scrolling2:{fps:2.5,frames:[\".  \",\".. \",\"...\",\"   \"]},star:{fps:14,frames:[\"\\u2736\",\"\\u2738\",\"\\u2739\",\"\\u273A\",\"\\u2739\",\"\\u2737\"]},bounceyBall:{fps:8,frames:[\"\\u2801\",\"\\u2802\",\"\\u2804\",\"\\u2802\"]},triangle:{fps:15,frames:[\"\\u25E2\",\"\\u25E3\",\"\\u25E4\",\"\\u25E5\"]},circle:{fps:15,frames:[\"\\u25D0\",\"\\u25D3\",\"\\u25D1\",\"\\u25D2\"]},bounce:{fps:12.5,frames:[\"( \\u25CF    )\",\"(  \\u25CF   )\",\"(   \\u25CF  )\",\"(    \\u25CF )\",\"(     \\u25CF)\",\"(    \\u25CF )\",\"(   \\u25CF  )\",\"(  \\u25CF   )\",\"( \\u25CF    )\",\"(\\u25CF     )\"]},clock:{fps:10,frames:[\"\\uD83D\\uDD50 \",\"\\uD83D\\uDD51 \",\"\\uD83D\\uDD52 \",\"\\uD83D\\uDD53 \",\"\\uD83D\\uDD54 \",\"\\uD83D\\uDD55 \",\"\\uD83D\\uDD56 \",\"\\uD83D\\uDD57 \",\"\\uD83D\\uDD58 \",\"\\uD83D\\uDD59 \",\"\\uD83D\\uDD5A \"]},pong:{fps:12.5,frames:[\"\\u2590\\u2802       \\u258C\",\"\\u2590\\u2808       \\u258C\",\"\\u2590 \\u2802      \\u258C\",\"\\u2590 \\u2820      \\u258C\",\"\\u2590  \\u2840     \\u258C\",\"\\u2590  \\u2820     \\u258C\",\"\\u2590   \\u2802    \\u258C\",\"\\u2590   \\u2808    \\u258C\",\"\\u2590    \\u2802   \\u258C\",\"\\u2590    \\u2820   \\u258C\",\"\\u2590     \\u2840  \\u258C\",\"\\u2590     \\u2820  \\u258C\",\"\\u2590      \\u2802 \\u258C\",\"\\u2590      \\u2808 \\u258C\",\"\\u2590       \\u2802\\u258C\",\"\\u2590       \\u2820\\u258C\",\"\\u2590       \\u2840\\u258C\",\"\\u2590      \\u2820 \\u258C\",\"\\u2590      \\u2802 \\u258C\",\"\\u2590     \\u2808  \\u258C\",\"\\u2590     \\u2802  \\u258C\",\"\\u2590    \\u2820   \\u258C\",\"\\u2590    \\u2840   \\u258C\",\"\\u2590   \\u2820    \\u258C\",\"\\u2590   \\u2802    \\u258C\",\"\\u2590  \\u2808     \\u258C\",\"\\u2590  \\u2802     \\u258C\",\"\\u2590 \\u2820      \\u258C\",\"\\u2590 \\u2840      \\u258C\",\"\\u2590\\u2820       \\u258C\"]}}[name];this.frames=spinner.frames,this.index=0,this.interval=Math.round(1e3/spinner.fps),this.setIntervalIndex=null}next(){this.index++;const realIndex=(this.index-1)%this.frames.length;return this.frames[realIndex]}start(outputFunction){outputFunction=outputFunction||(str=>process.stdout.write(str)),this.setIntervalIndex=setInterval(()=>{let frame=this.next(),clearFrame=frame.replace(/./g,\"\\b\");outputFunction(clearFrame),outputFunction(frame)},this.interval)}stop(){clearInterval(this.setIntervalIndex)}}}}),addEventListener(\"message\",message=>{const msg=message.data;if(\"event\"===msg.type&&msg.name&&msg.detail){const event=new CustomEvent(msg.name,{detail:msg.detail});dispatchEvent(event)}})})();";
    // Information that we need to expose to userspace
    const expose =
      "process.argv = " +
      JSON.stringify(this.argv) +
      ";" +
      "process.argc = " +
      this.argc +
      ";" +
      "process.env = " +
      JSON.stringify(this.env) +
      ";";
    // The worker is where the process is actually executed
    this.worker = mkWorker([lib, expose, image].join("\n\n"));
    // This event listener intercepts worker messages and then
    // passes to the message handler, which decides what next
    this.worker.addEventListener("message", message => {
      this.messageHandler(message);
    });
  }

  // Handle messages coming from the worker
  messageHandler(message) {
    const msg = message.data;
    // This does some quick message format validation, but
    // all value validation must be handled by the system call function itself
    if (msg.type === "syscall" && msg.name in sys) {
      // Execute a system call with given arguments
      if (msg.id !== undefined && msg.args instanceof Array) {
        sys[msg.name](this, msg.id, msg.args);
      }
    } else if (msg.type === "event" && msg.name && msg.detail) {
      // Fire the event natively
      const event = new CustomEvent(msg.name, { detail: msg.detail });
      dispatchEvent(event);
    } else {
      // The message is not valid because of the type or name
      const error = {
        status: "error",
        reason: "Invalid request - Rejected by the message handler",
        id: msg.id
      };
      this.worker.postMessage(error);
    }
  }

  // Check if we can access/it exists
  access(path, mode = "r") {
    try {
      const fd = new FileDescriptor(path, mode);
      if (fd.vnode) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      return false;
    }
  }

  // Where open() actually runs
  // Return a file descriptor
  open(path, mode) {
    if (!this.access(path, mode)) {
      return -1;
    }
    const fd = new FileDescriptor(path, mode);
    this.fds.push(fd);
    return this.fds.length - 1;
  }
}

class ProcessTable {
  constructor(init) {
    if (init === undefined) {
      throw new Error("Init process must be defined");
    }
    this.list = [null, init];
    this.nextPID = 2;
  }

  add(process) {
    this.nextPID = this.list.push(process);
    return this.nextPID - 1;
  }

  emit(name, detail, pids = []) {
    // Default empty array means all processes
    if (pids.length === 0) {
      for (let i = 1; i < this.list.length; i++) {
        // Post the message every process' webworker
        this.list[i].worker.postMessage({
          type: "event",
          name,
          detail
        });
      }
    } else {
      // Post the message to each process as specified by the pids array
      for (let i in pids) {
        this.list[pids[i]].worker.postMessage({
          type: "event",
          name,
          detail
        });
      }
    }
  }
}

var proc = new ProcessTable(new Process());

// Example output: ["Browser", "xx.xx.xx"]
function browserInfo() {
  const ua = navigator.userAgent;
  const matches =
    ua.match(
      /(vivaldi|opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*([\d.]+)/i
    ) || [];
  if (/trident/i.test(matches[1])) {
    const tem = ua.match(/\brv[ :]+([\d.]+)/g) || "";
    return ["IE", tem[1]];
  }
  if (matches[1] === "Chrome") {
    const tem = ua.match(/\b(OPR|Edge)\/([\d.]+)/);
    if (tem) {
      return ["Opera", tem[1]];
    }
  }
  if (matches[2]) {
    return {
      name: matches[1],
      version: matches[2]
    };
  } else {
    return {
      name: navigator.appName,
      version: navigator.appVersion
    };
  }
}

var browser = browserInfo();

var index = {
  fs,
  sys,
  proc,
  utils,
  browser,
  version: "0.0.3"
};

return index;

})));
