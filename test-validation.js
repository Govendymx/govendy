const { containsContactInfo } = require('./lib/utils/validation');

const testCases = [
  "uno dos tres cuatro cinco seis uno tres dos cero cero",
  "hola me interesa",
  "mi numero es 1234567890",
  "cero uno dos tres cuatro cinco seis siete ocho nueve",
  "un dos tres cuatro cinco seis siete ocho nueve diez"
];

testCases.forEach(text => {
  console.log(`Text: "${text}" -> Detected:`, containsContactInfo(text));
});
