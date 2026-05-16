const DOMPurify = require('dompurify');

try {
  // Pass no window
  const purify = DOMPurify(); 
  console.log(purify.sanitize('<span style="color: red">text</span>'));
} catch (e) {
  console.log("Error:", e.message);
}
