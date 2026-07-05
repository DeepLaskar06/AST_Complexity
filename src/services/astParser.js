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
  let isRecursive = false;
  let hasDynamicSpace = false;
  const details = [];
  
  const cursor = rootNode.walk();
  
  function walk(cursor, currentLoopDepth, currentFunctionName) {
    do {
      const type = cursor.nodeType;
      const node = cursor.currentNode;
      
      let nextLoopDepth = currentLoopDepth;
      let nextFunctionName = currentFunctionName;
      
      if (type === 'function_definition') {
        const match = node.text.match(/(\w+)\s*\(/);
        if (match) {
          nextFunctionName = match[1];
        }
      }
      
      if (type === 'call_expression') {
        const match = node.text.match(/^([\w:]+)\s*\(/);
        if (match && match[1] === currentFunctionName) {
          isRecursive = true;
        }
      }
      
      if (type === 'new_expression') {
        if (node.text.includes('[')) {
          hasDynamicSpace = true;
        }
      }
      
      if (type === 'declaration' || type === 'variable_declaration') {
        if (node.text.includes('vector') || node.text.includes('[')) {
          hasDynamicSpace = true;
        }
      }

      const isLoop = (type === 'for_statement' || type === 'while_statement' || type === 'do_statement');
      
      if (isLoop) {
        nextLoopDepth++;
        if (nextLoopDepth > maxLoopDepth) {
          maxLoopDepth = nextLoopDepth;
        }
        
        details.push(`Found loop at line ${cursor.startPosition.row + 1} (depth: ${nextLoopDepth})`);
      }
      
      if (cursor.gotoFirstChild()) {
        walk(cursor, nextLoopDepth, nextFunctionName);
        cursor.gotoParent();
      }
    } while (cursor.gotoNextSibling());
  }
  
  walk(cursor, 0, null);
  
  let timeComplexity = 'O(1)';
  if (maxLoopDepth === 1) {
    timeComplexity = 'O(N)';
  } else if (maxLoopDepth === 2) {
    timeComplexity = 'O(N^2)';
  } else if (maxLoopDepth >= 3) {
    timeComplexity = `O(N^${maxLoopDepth})`;
  }
  
  let spaceComplexity = 'O(1)';
  if (hasDynamicSpace) {
    spaceComplexity = 'O(N)';
    details.push('Dynamic space allocation detected (e.g., arrays, vectors, or new[])');
  }
  
  if (isRecursive) {
    details.push('Recursive call detected');
  }
  
  return { timeComplexity, spaceComplexity, details };
}

module.exports = { parseCode, analyzeComplexity };
