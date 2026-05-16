const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const ALLOWED_TAGS = ['span', 'p'];
const ALLOWED_ATTR = ['href', 'target', 'style', 'class'];

const html = '<span style="color: rgb(255, 0, 0);">Bermuda</span>';

const clean = DOMPurify.sanitize(html, {
  ALLOWED_TAGS,
  ALLOWED_ATTR
});

console.log("CLEAN HTML:", clean);
