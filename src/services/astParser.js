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
  let maxLinear = 0;
  let maxLog = 0;
  let isRecursive = false;
  let hasDynamicSpace = false;
  const details = [];
  
  const cursor = rootNode.walk();
  
  function walk(cursor, currentLinear, currentLog, currentFunctionName, currentLoopVariable) {
    do {
      const type = cursor.nodeType;
      const node = cursor.currentNode;
      
      let nextLinear = currentLinear;
      let nextLog = currentLog;
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

      let isLoop = false;
      let isLogLoop = false;

      if (type === 'for_statement') {
        isLoop = true;
        const loopVar = extractLoopVariable(node);
        if (loopVar) {
          nextLoopVariable = loopVar;
        }
        
        const update = node.childForFieldName('update');
        if (update && nextLoopVariable) {
          const updateText = update.text;
          const regex1 = new RegExp(`\\b${nextLoopVariable}\\s*(\\*=|/=|<<=|>>=)`);
          const regex2 = new RegExp(`\\b${nextLoopVariable}\\s*=\\s*\\b${nextLoopVariable}\\s*(\\*|/|<<|>>)`);
          if (regex1.test(updateText) || regex2.test(updateText)) {
            isLogLoop = true;
          }
        }
      } else if (type === 'while_statement' || type === 'do_statement') {
        isLoop = true;
      }
      
      if (isLoop) {
        if (isLogLoop) {
          nextLog++;
        } else {
          nextLinear++;
        }
        
        if (nextLinear > maxLinear || (nextLinear === maxLinear && nextLog > maxLog)) {
          maxLinear = nextLinear;
          maxLog = nextLog;
        }
        
        let loopMsg = `Found ${isLogLoop ? 'O(log N)' : 'O(N)'} loop at line ${cursor.startPosition.row + 1}`;
        if (type === 'for_statement' && nextLoopVariable) {
          loopMsg += ` tracking variable '${nextLoopVariable}'`;
        }
        details.push(loopMsg);
      }
      
      if (cursor.gotoFirstChild()) {
        walk(cursor, nextLinear, nextLog, nextFunctionName, nextLoopVariable);
        cursor.gotoParent();
      }
    } while (cursor.gotoNextSibling());
  }
  
  walk(cursor, 0, 0, null, null);
  
  let timeComplexity = 'O(1)';
  if (maxLinear === 0 && maxLog > 0) {
    timeComplexity = maxLog === 1 ? 'O(log N)' : `O(log^${maxLog} N)`;
  } else if (maxLinear > 0) {
    const linPart = maxLinear === 1 ? 'N' : `N^${maxLinear}`;
    const logPart = maxLog === 0 ? '' : (maxLog === 1 ? ' log N' : ` log^${maxLog} N`);
    timeComplexity = `O(${linPart}${logPart})`;
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
