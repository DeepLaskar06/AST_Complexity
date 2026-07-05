const Parser = require('tree-sitter');
const Cpp = require('tree-sitter-cpp');

function parseCode(codeString) {
  const parser = new Parser();
  parser.setLanguage(Cpp);
  const tree = parser.parse(codeString);
  return tree.rootNode;
}

function analyzeComplexity(rootNode) {
  let maxLoopDepth = 0;
  const details = [];
  
  const cursor = rootNode.walk();
  
  function walk(cursor, currentLoopDepth) {
    do {
      const type = cursor.nodeType;
      const isLoop = (type === 'for_statement' || type === 'while_statement' || type === 'do_statement');
      
      let nextLoopDepth = currentLoopDepth;
      
      if (isLoop) {
        nextLoopDepth++;
        if (nextLoopDepth > maxLoopDepth) {
          maxLoopDepth = nextLoopDepth;
        }
        
        details.push(`Found loop at line ${cursor.startPosition.row + 1} (depth: ${nextLoopDepth})`);
      }
      
      if (cursor.gotoFirstChild()) {
        walk(cursor, nextLoopDepth);
        cursor.gotoParent();
      }
    } while (cursor.gotoNextSibling());
  }
  
  walk(cursor, 0);
  
  let timeComplexity = 'O(1)';
  if (maxLoopDepth === 1) {
    timeComplexity = 'O(N)';
  } else if (maxLoopDepth === 2) {
    timeComplexity = 'O(N^2)';
  } else if (maxLoopDepth >= 3) {
    timeComplexity = `O(N^${maxLoopDepth})`;
  }
  
  return { timeComplexity, details };
}

module.exports = { parseCode, analyzeComplexity };
