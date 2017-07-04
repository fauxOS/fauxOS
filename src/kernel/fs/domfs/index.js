import Pathname from "../../../misc/pathname.js";

export default class DOMFS {
  constructor(selectorBase = "") {
    this.base = selectorBase;
  }

  resolve(path) {
    const pathname = new Pathname(path);
    // If we are at the DOM root, i.e. /dev/dom/
    if (pathname.chop[0] === "/") {
      return document.querySelector("*");
    } else {
      let selector = " " + pathname.chop.join(" > ");
      // For child selection by index
      // element.children[0] becomes /dev/dom/element/1
      selector = selector.replace(/ (\d)/g, " :nth-child($1)");
      return document.querySelector(selector);
    }
  }

  touch(path) {
    const pathname = new Pathname(path);
    const parent = this.resolve(pathname.parent);
    if (!parent) {
      return -1;
    }
    // When creating an element, you are only allowed to use the element name
    // e.g. touch("/dev/dom/body/#container/span")
    // You cannot touch a class, index, or id
    const el = document.createElement(pathname.name);
    return parent.appendChild(el);
  }
}