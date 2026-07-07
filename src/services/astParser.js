const Parser = require('tree-sitter');
const Cpp = require('tree-sitter-cpp');
const stlHeuristics = require('./heuristics');

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

function extractLoopBound(node, loopVar) {
  if (!node || node.type !== 'for_statement' || !loopVar) return 'N';
  
  const initializer = node.childForFieldName('initializer');
  const condition = node.childForFieldName('condition');
  const update = node.childForFieldName('update');
  
  let isDescending = false;
  if (update) {
    const updateText = update.text;
    if (updateText.includes('--') || updateText.includes('-=')) {
      isDescending = true;
    }
  }
  
  let bound = 'N';
  if (isDescending) {
    if (initializer) {
      const match = initializer.text.match(/=\s*([A-Za-z0-9_]+)/);
      if (match) bound = match[1];
    }
  } else {
    if (condition) {
      const match = condition.text.match(/[<>=!]+\s*([A-Za-z0-9_]+)/);
      if (match) bound = match[1];
    }
  }
  
  if (bound === 'N' || !bound) return 'N';
  return bound.toUpperCase();
}

function detectGraphTraversal(node) {
  if (!node || node.type !== 'while_statement') return false;
  
  const condition = node.childForFieldName('condition');
  if (!condition || !condition.text.includes('.empty()')) return false;
  
  const body = node.childForFieldName('body');
  if (!body) return false;
  
  let hasInnerGraphLoop = false;
  
  const bodyCursor = body.walk();
  function checkBody(c) {
    do {
      const n = c.currentNode;
      if (n.type === 'for_statement' || n.type === 'for_range_loop') {
        const loopText = n.text;
        if (loopText.includes('adj') || loopText.includes('edges') || loopText.includes('graph') || loopText.includes('neighbor') || /\[\w+\]/.test(loopText)) {
          hasInnerGraphLoop = true;
        }
      }
      
      if (!hasInnerGraphLoop && c.gotoFirstChild()) {
        checkBody(c);
        c.gotoParent();
      }
    } while (!hasInnerGraphLoop && c.gotoNextSibling());
  }
  
  checkBody(bodyCursor);
  
  return hasInnerGraphLoop;
}

function analyzeComplexity(rootNode) {
  const loopMacros = new Set();
  const spaceMacros = new Set();
  
  const preprocCursor = rootNode.walk();
  function pass1(cursor) {
    do {
      const type = cursor.nodeType;
      const node = cursor.currentNode;
      
      if (type === 'preproc_def' || type === 'preproc_function_def') {
        const nameNode = node.childForFieldName('name');
        const valueNode = node.childForFieldName('value');
        
        if (nameNode && valueNode) {
          const name = nameNode.text;
          const value = valueNode.text;
          
          if (/(?:for|while)\s*\(/.test(value) || value.includes('for ') || value.includes('while ')) {
            loopMacros.add(name);
          }
          if (value.includes('vector') || value.includes('map') || value.includes('set')) {
            spaceMacros.add(name);
          }
        }
      }
      
      if (cursor.gotoFirstChild()) {
        pass1(cursor);
        cursor.gotoParent();
      }
    } while (cursor.gotoNextSibling());
  }
  pass1(preprocCursor);

  let maxLinearBounds = [];
  let maxLogBounds = [];
  let maxSqrtBounds = [];
  let maxScore = 0;
  let isRecursive = false;
  let hasDynamicSpace = false;
  let isNLogLogN = false;
  let hasGraphTraversal = false;
  const details = [];
  
  const cursor = rootNode.walk();
  
  function walk(cursor, currentLinearBounds, currentLogBounds, currentSqrtBounds, currentFunctionName, activeLoopVars) {
    do {
      const type = cursor.nodeType;
      const node = cursor.currentNode;
      
      let nextLinearBounds = [...currentLinearBounds];
      let nextLogBounds = [...currentLogBounds];
      let nextSqrtBounds = [...currentSqrtBounds];
      let nextFunctionName = currentFunctionName;
      let nextLoopVars = activeLoopVars;
      let currentLoopVariable = activeLoopVars.length > 0 ? activeLoopVars[activeLoopVars.length - 1] : null;
      let skipChildren = false;
      
      if (type === 'function_definition') {
        const match = node.text.match(/(\w+)\s*\(/);
        if (match) nextFunctionName = match[1];
      }
      
      let isLoop = false;
      let isLogLoop = false;
      let isSqrtLoop = false;
      let isMacroLoop = false;
      let loopVar = null;
      let macroBaseName = null;

      if (type === 'call_expression') {
        const functionNode = node.childForFieldName('function');
        let baseName = null;
        if (functionNode) {
          if (functionNode.type === 'scoped_identifier') {
            const nameNode = functionNode.childForFieldName('name');
            if (nameNode) baseName = nameNode.text;
          } else if (functionNode.type === 'identifier') {
            baseName = functionNode.text;
          }
        }
        
        if (baseName && loopMacros.has(baseName)) {
          isLoop = true;
          isMacroLoop = true;
          macroBaseName = baseName;
        } else if (baseName && stlHeuristics[baseName]) {
          const h = stlHeuristics[baseName];
          if (h === 'O(N log N)') {
            nextLinearBounds.push('N');
            nextLogBounds.push('N');
          } else if (h === 'O(log N)') {
            nextLogBounds.push('N');
          } else if (h === 'O(N)') {
            nextLinearBounds.push('N');
          }
          
          const currentScore = nextLinearBounds.length + nextSqrtBounds.length * 0.5 + nextLogBounds.length * 0.01;
          if (currentScore > maxScore) {
            maxScore = currentScore;
            maxLinearBounds = [...nextLinearBounds];
            maxLogBounds = [...nextLogBounds];
            maxSqrtBounds = [...nextSqrtBounds];
          }
          details.push(`Found STL '${baseName}' call at line ${cursor.startPosition.row + 1} (${h})`);
        }

        const match = node.text.match(/^([\w:]+)\s*\(/);
        if (match && match[1] === currentFunctionName) {
          isRecursive = true;
        }
      }
      
      if (type === 'new_expression') {
        if (node.text.includes('[')) hasDynamicSpace = true;
      }
      
      if (type === 'declaration' || type === 'variable_declaration') {
        const text = node.text;
        if (text.includes('vector') || text.includes('[')) {
          hasDynamicSpace = true;
        } else {
          for (const sm of spaceMacros) {
            const regex = new RegExp(`\\b${sm}\\b`);
            if (regex.test(text)) hasDynamicSpace = true;
          }
        }
      }

      if (type === 'for_statement') {
        isLoop = true;
        loopVar = extractLoopVariable(node);
        if (loopVar) {
          nextLoopVars = [...activeLoopVars, loopVar];
          currentLoopVariable = loopVar;
        }
        
        const update = node.childForFieldName('update');
        if (update && loopVar) {
          const updateText = update.text;
          const regex1 = new RegExp(`\\b${loopVar}\\s*(\\*=|/=|<<=|>>=)`);
          const regex2 = new RegExp(`\\b${loopVar}\\s*=\\s*\\b${loopVar}\\s*(\\*|/|<<|>>)`);
          if (regex1.test(updateText) || regex2.test(updateText)) {
            isLogLoop = true;
          }
          
          for (const outerVar of activeLoopVars) {
            const regexSieve1 = new RegExp(`\\b${loopVar}\\s*\\+=\\s*\\b${outerVar}\\b`);
            const regexSieve2 = new RegExp(`\\b${loopVar}\\s*=\\s*\\b${loopVar}\\s*\\+\\s*\\b${outerVar}\\b`);
            if (regexSieve1.test(updateText) || regexSieve2.test(updateText)) {
              isNLogLogN = true;
            }
          }
        }
        
        const condition = node.childForFieldName('condition');
        if (condition && loopVar && !isLogLoop) {
          const condText = condition.text;
          const regexSqrt = new RegExp(`\\b${loopVar}\\s*\\*\\s*\\b${loopVar}\\b`);
          const regexSqrtCall = /\b(?:std::)?sqrt\s*\(/;
          if (regexSqrt.test(condText) || regexSqrtCall.test(condText)) {
            isSqrtLoop = true;
          }
        }
      } else if (type === 'while_statement' || type === 'do_statement') {
        if (type === 'while_statement' && detectGraphTraversal(node)) {
          hasGraphTraversal = true;
          skipChildren = true;
          
          let bound = 'V + E';
          nextLinearBounds.push(bound);
          
          const currentScore = nextLinearBounds.length + nextSqrtBounds.length * 0.5 + nextLogBounds.length * 0.01;
          if (currentScore > maxScore) {
            maxScore = currentScore;
            maxLinearBounds = [...nextLinearBounds];
            maxLogBounds = [...nextLogBounds];
            maxSqrtBounds = [...nextSqrtBounds];
          }
          
          details.push(`Detected standard Graph Traversal (BFS/DFS) at line ${cursor.startPosition.row + 1}`);
        } else {
          isLoop = true;
        }
      }
      
      if (isLoop) {
        let bound = 'N';
        if (type === 'for_statement') {
          bound = extractLoopBound(node, loopVar);
        }
        
        if (isLogLoop) {
          nextLogBounds.push(bound);
        } else if (isSqrtLoop) {
          nextSqrtBounds.push(bound);
        } else {
          nextLinearBounds.push(bound);
        }
        
        const currentScore = nextLinearBounds.length + nextSqrtBounds.length * 0.5 + nextLogBounds.length * 0.01;
        if (currentScore > maxScore) {
          maxScore = currentScore;
          maxLinearBounds = [...nextLinearBounds];
          maxLogBounds = [...nextLogBounds];
          maxSqrtBounds = [...nextSqrtBounds];
        }
        
        let loopMsg = `Found ${isLogLoop ? 'O(log ' + bound + ')' : (isSqrtLoop ? 'O(sqrt ' + bound + ')' : 'O(' + bound + ')')} loop at line ${cursor.startPosition.row + 1}`;
        if (isMacroLoop) {
          loopMsg = `Found O(N) macro loop '${macroBaseName}' at line ${cursor.startPosition.row + 1}`;
        } else if (type === 'for_statement' && loopVar) {
          loopMsg += ` tracking variable '${loopVar}'`;
        }
        details.push(loopMsg);
      }
      
      if (!skipChildren && cursor.gotoFirstChild()) {
        walk(cursor, nextLinearBounds, nextLogBounds, nextSqrtBounds, nextFunctionName, nextLoopVars);
        cursor.gotoParent();
      }
    } while (cursor.gotoNextSibling());
  }
  
  walk(cursor, [], [], [], null, []);
  
  let timeComplexity = 'O(1)';
  
  const linearCounts = {};
  for (const b of maxLinearBounds) {
    linearCounts[b] = (linearCounts[b] || 0) + 1;
  }
  for (const b of maxSqrtBounds) {
    linearCounts[`sqrt(${b})`] = (linearCounts[`sqrt(${b})`] || 0) + 1;
    if (linearCounts[`sqrt(${b})`] === 2) {
       linearCounts[b] = (linearCounts[b] || 0) + 1;
       delete linearCounts[`sqrt(${b})`];
    }
  }
  
  const logCounts = {};
  for (const b of maxLogBounds) {
    logCounts[b] = (logCounts[b] || 0) + 1;
  }

  const parts = [];
  for (const [b, count] of Object.entries(linearCounts)) {
    let baseStr = b;
    if (b.includes('+')) baseStr = `(${b})`;
    
    if (count === 1) parts.push(baseStr);
    else parts.push(`${baseStr}^${count}`);
  }
  for (const [b, count] of Object.entries(logCounts)) {
    if (count === 1) parts.push(`log ${b}`);
    else parts.push(`log^${count} ${b}`);
  }

  if (parts.length > 0) {
    timeComplexity = `O(${parts.join(' * ')})`;
  }
  
  if (isNLogLogN) {
    timeComplexity = 'O(N log log N)';
    details.push('Detected Sieve-like nested loop pattern (e.g. j += i): O(N log log N)');
  }
  
  let spaceComplexity = 'O(1)';
  if (hasGraphTraversal) {
    spaceComplexity = 'O(V)';
    details.push('Dynamic space allocation detected (Graph queue/visited array: O(V))');
  } else if (hasDynamicSpace) {
    spaceComplexity = 'O(N)';
    details.push('Dynamic space allocation detected (e.g., arrays, vectors, or new[])');
  }
  
  if (isRecursive) {
    details.push('Recursive call detected');
  }
  
  return { timeComplexity, spaceComplexity, details };
}

module.exports = { parseCode, analyzeComplexity };
