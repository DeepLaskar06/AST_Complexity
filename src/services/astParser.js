const Parser = require('tree-sitter');
const Cpp = require('tree-sitter-cpp');

function parseCode(codeString) {
  const parser = new Parser();
  parser.setLanguage(Cpp);
  const tree = parser.parse(codeString);
  return tree.rootNode;
}

function analyzeComplexity(rootNode) {
  let loopCount = 0;
  const details = [];
  
  const cursor = rootNode.walk();
  
  function walk(cursor, inLoop) {
    do {
      const type = cursor.nodeType;
      const isLoop = (type === 'for_statement' || type === 'while_statement' || type === 'do_statement');
      
      if (isLoop && !inLoop) {
        loopCount++;
        details.push(`Found 1 loop at line ${cursor.startPosition.row + 1}`);
      }
      
      if (cursor.gotoFirstChild()) {
        walk(cursor, inLoop || isLoop);
        cursor.gotoParent();
      }
    } while (cursor.gotoNextSibling());
  }
  
  walk(cursor, false);
  
  let timeComplexity = 'O(1)';
  if (loopCount > 0) {
    timeComplexity = 'O(N)'; 
  }
  
  return { timeComplexity, details };
}

module.exports = { parseCode, analyzeComplexity };
