const Parser = require('tree-sitter');
const Cpp = require('tree-sitter-cpp');

function parseCode(codeString) {
  const parser = new Parser();
  parser.setLanguage(Cpp);
  const tree = parser.parse(codeString);
  return tree.rootNode;
}

function findFirstIdentifier(node) {
  if (!node) return null;
  if (node.type === 'identifier') return node.text;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    const id = findFirstIdentifier(child);
    if (id) return id;
  }
  return null;
}

function extractLoopVariable(node) {
  if (!node || node.type !== 'for_statement') return null;
  
  const initializer = node.childForFieldName('initializer');
  if (initializer) {
    const id = findFirstIdentifier(initializer);
    if (id) return id;
  }
  
  const condition = node.childForFieldName('condition');
  if (condition) {
    const id = findFirstIdentifier(condition);
    if (id) return id;
  }
  
  return null;
}

function analyzeComplexity(rootNode) {
  let maxLoopDepth = 0;
  let isRecursive = false;
  let hasDynamicSpace = false;
  const details = [];
  
  const cursor = rootNode.walk();
  
  function walk(cursor, currentLoopDepth, currentFunctionName, currentLoopVariable) {
    do {
      const type = cursor.nodeType;
      const node = cursor.currentNode;
      
      let nextLoopDepth = currentLoopDepth;
      let nextFunctionName = currentFunctionName;
      let nextLoopVariable = currentLoopVariable;
      
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

      if (type === 'for_statement') {
        const loopVar = extractLoopVariable(node);
        if (loopVar) {
          nextLoopVariable = loopVar;
        }
      }

      const isLoop = (type === 'for_statement' || type === 'while_statement' || type === 'do_statement');
      
      if (isLoop) {
        nextLoopDepth++;
        if (nextLoopDepth > maxLoopDepth) {
          maxLoopDepth = nextLoopDepth;
        }
        
        let loopMsg = `Found loop at line ${cursor.startPosition.row + 1} (depth: ${nextLoopDepth})`;
        if (type === 'for_statement' && nextLoopVariable) {
          loopMsg += ` tracking variable '${nextLoopVariable}'`;
        }
        details.push(loopMsg);
      }
      
      if (cursor.gotoFirstChild()) {
        walk(cursor, nextLoopDepth, nextFunctionName, nextLoopVariable);
        cursor.gotoParent();
      }
    } while (cursor.gotoNextSibling());
  }
  
  walk(cursor, 0, null, null);
  
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
