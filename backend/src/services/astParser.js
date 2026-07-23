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

function detectGraphTraversal(node, pqVariables) {
  if (!node || node.type !== 'while_statement') return null;
  
  const condition = node.childForFieldName('condition');
  if (!condition || !condition.text.includes('.empty()')) return null;
  
  let isPQ = false;
  const condText = condition.text;
  for (const pq of pqVariables) {
    if (condText.includes(`${pq}.empty()`)) isPQ = true;
  }
  
  const body = node.childForFieldName('body');
  if (!body) return null;
  
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
  
  if (hasInnerGraphLoop) {
    return isPQ ? 'O(E log V)' : 'O(V + E)';
  }
  return null;
}

function detectRecursiveDFS(functionNode) {
  if (!functionNode || functionNode.type !== 'function_definition') return false;
  
  const match = functionNode.text.match(/(\w+)\s*\(/);
  if (!match) return false;
  const functionName = match[1];
  
  let isDFS = false;
  const cursor = functionNode.walk();
  
  function checkNode(c) {
    do {
      const node = c.currentNode;
      
      if (node.type === 'for_statement' || node.type === 'for_range_loop') {
        const loopText = node.text;
        
        if (loopText.includes('adj') || loopText.includes('edges') || loopText.includes('graph') || loopText.includes('neighbor') || /\[\w+\]/.test(loopText)) {
          
          const loopCursor = node.walk();
          let hasIf = false;
          let hasRecursiveCall = false;
          
          function checkLoopBody(lc) {
            do {
              const ln = lc.currentNode;
              if (ln.type === 'if_statement') {
                hasIf = true;
                
                const ifCursor = ln.walk();
                function checkIfBody(ic) {
                  do {
                    const inNode = ic.currentNode;
                    if (inNode.type === 'call_expression') {
                       const funcNode = inNode.childForFieldName('function');
                       let baseName = null;
                       if (funcNode) {
                         if (funcNode.type === 'scoped_identifier') {
                           const nameNode = funcNode.childForFieldName('name');
                           if (nameNode) baseName = nameNode.text;
                         } else if (funcNode.type === 'identifier') {
                           baseName = funcNode.text;
                         }
                       }
                       if (!baseName) {
                         const m = inNode.text.match(/^([\w:]+)\s*\(/);
                         if (m) baseName = m[1];
                       }
                       if (baseName === functionName) {
                         hasRecursiveCall = true;
                       }
                    }
                    if (!hasRecursiveCall && ic.gotoFirstChild()) {
                      checkIfBody(ic);
                      ic.gotoParent();
                    }
                  } while (!hasRecursiveCall && ic.gotoNextSibling());
                }
                checkIfBody(ifCursor);
              }
              
              if (!hasRecursiveCall && lc.gotoFirstChild()) {
                checkLoopBody(lc);
                lc.gotoParent();
              }
            } while (!hasRecursiveCall && lc.gotoNextSibling());
          }
          
          checkLoopBody(loopCursor);
          
          if (hasIf && hasRecursiveCall) {
            isDFS = true;
          }
        }
      }
      
      if (!isDFS && c.gotoFirstChild()) {
        checkNode(c);
        c.gotoParent();
      }
    } while (!isDFS && c.gotoNextSibling());
  }
  
  checkNode(cursor);
  return isDFS;
}

function detectDivideAndConquer(functionNode) {
  if (!functionNode || functionNode.type !== 'function_definition') return null;
  
  const match = functionNode.text.match(/(\w+)\s*\(/);
  if (!match) return null;
  const functionName = match[1];
  
  let a = 0;
  let b = 1;
  let hasLinearWork = false;
  
  const cursor = functionNode.walk();
  function checkNode(c) {
    do {
      const node = c.currentNode;
      
      if (node.type === 'call_expression') {
        const funcNode = node.childForFieldName('function');
        let baseName = null;
        if (funcNode) {
           if (funcNode.type === 'scoped_identifier') {
             const nameNode = funcNode.childForFieldName('name');
             if (nameNode) baseName = nameNode.text;
           } else if (funcNode.type === 'identifier') {
             baseName = funcNode.text;
           }
        }
        if (!baseName) {
           const m = node.text.match(/^([\w:]+)\s*\(/);
           if (m) baseName = m[1];
        }
        
        if (baseName === functionName) {
           a++;
           const args = node.childForFieldName('arguments');
           if (args && (args.text.includes('/ 2') || args.text.includes('/2') || args.text.includes('>> 1') || args.text.includes('>>1') || args.text.includes('mid'))) {
             b = 2;
           }
        }
      }
      
      if (node.type === 'for_statement' || node.type === 'while_statement') {
         hasLinearWork = true;
      }
      
      if (c.gotoFirstChild()) {
        checkNode(c);
        c.gotoParent();
      }
    } while (c.gotoNextSibling());
  }
  checkNode(cursor);
  
  if (a === 2 && b === 2 && hasLinearWork) {
    return {
      time: 'O(N log N)',
      space: 'O(N)',
      details: 'Resolved via Master Theorem Heuristic: a=2, b=2, work=O(N)'
    };
  }
  
  return null;
}

function detectBinarySearch(whileNode) {
  if (!whileNode || whileNode.type !== 'while_statement') return false;
  
  const condition = whileNode.childForFieldName('condition');
  if (!condition) return false;
  
  const matchCond = condition.text.match(/([A-Za-z0-9_]+)\s*[<>=!]+\s*([A-Za-z0-9_]+)/);
  if (!matchCond) return false;
  
  const leftVar = matchCond[1];
  const rightVar = matchCond[2];
  
  const body = whileNode.childForFieldName('body');
  if (!body) return false;
  
  let hasMid = false;
  let midVar = null;
  let hasUpdate = false;
  
  const cursor = body.walk();
  function checkBody(c) {
    do {
      const node = c.currentNode;
      const text = node.text;
      
      if (text.includes('/ 2') || text.includes('/2') || text.includes('>> 1') || text.includes('>>1')) {
         if (text.includes(leftVar) || text.includes(rightVar)) {
           const matchMid = text.match(/(?:int|long long|auto)?\s*([A-Za-z0-9_]+)\s*=\s*.+/);
           if (matchMid) {
             hasMid = true;
             midVar = matchMid[1];
           }
         }
      }
      
      if (hasMid && midVar) {
         const regexLeft = new RegExp(`\\b${leftVar}\\s*=\\s*\\b${midVar}\\b`);
         const regexRight = new RegExp(`\\b${rightVar}\\s*=\\s*\\b${midVar}\\b`);
         const regexLeft2 = new RegExp(`\\b${leftVar}\\s*=\\s*\\b${midVar}\\b\\s*[+-]`);
         const regexRight2 = new RegExp(`\\b${rightVar}\\s*=\\s*\\b${midVar}\\b\\s*[+-]`);
         
         if (regexLeft.test(text) || regexRight.test(text) || regexLeft2.test(text) || regexRight2.test(text)) {
           hasUpdate = true;
         }
      }
      
      if (c.gotoFirstChild()) {
        checkBody(c);
        c.gotoParent();
      }
    } while (c.gotoNextSibling());
  }
  
  checkBody(cursor);
  return hasMid && hasUpdate;
}

function detectMemoization(functionNode) {
  if (!functionNode || functionNode.type !== 'function_definition') return null;
  
  const body = functionNode.childForFieldName('body');
  if (!body) return null;
  
  let cacheVar = null;
  let dimension = 1;
  let hasEarlyReturn = false;
  let hasCacheWrite = false;
  
  const cursor = body.walk();
  
  function checkBody(c) {
    do {
      const node = c.currentNode;
      const text = node.text;
      
      if (node.type === 'if_statement') {
        const cond = node.childForFieldName('condition');
        const cons = node.childForFieldName('consequence');
        
        if (cond && cons) {
          const condText = cond.text;
          const consText = cons.text;
          
          if (condText.includes('!=') || condText.includes('==') || condText.includes('>')) {
            const brackets = (condText.match(/\[/g) || []).length;
            if (brackets > 0 && consText.includes('return')) {
              hasEarlyReturn = true;
              dimension = brackets;
              const memoMatch = condText.match(/([A-Za-z0-9_]+)\[/);
              if (memoMatch) {
                cacheVar = memoMatch[1];
              }
            }
          }
        }
      }
      
      if (cacheVar && (node.type === 'expression_statement' || node.type === 'return_statement')) {
        const regexWrite = new RegExp(`\\b${cacheVar}\\s*\\[.*\\]\\s*=`);
        if (regexWrite.test(text)) {
          hasCacheWrite = true;
        }
        
        const regexRetWrite = new RegExp(`return\\s+${cacheVar}\\s*\\[.*\\]\\s*=`);
        if (regexRetWrite.test(text)) {
          hasCacheWrite = true;
        }
      }
      
      if (c.gotoFirstChild()) {
        checkBody(c);
        c.gotoParent();
      }
    } while (c.gotoNextSibling());
  }
  
  checkBody(cursor);
  
  if (hasEarlyReturn && hasCacheWrite) {
    const dimStr = dimension === 1 ? '1D' : (dimension === 2 ? '2D' : `${dimension}D`);
    const compStr = dimension === 1 ? 'O(N)' : `O(N^${dimension})`;
    return {
      time: compStr,
      space: compStr,
      dimension: dimension,
      details: `Detected Dynamic Programming (Memoization Cache: ${dimStr} State Space)`
    };
  }
  return null;
}

function cleanVectorArg(argStr) {
  if (!argStr) return 'N';
  let cleaned = argStr.replace(/\s*[+-]\s*[0-9]+/g, '');
  cleaned = cleaned.trim().toUpperCase();
  if (/^[0-9]+$/.test(cleaned) || cleaned === '') return 'N';
  return cleaned;
}

function detectVectorSpaceComplexity(declarationNode, spaceMacros) {
  if (!declarationNode) return null;
  
  const text = declarationNode.text;
  
  let is2D = false;
  if (text.includes('vector') && (text.includes('vector<vector') || text.match(/vector\s*<\s*vector/))) {
    is2D = true;
  } else {
    for (const sm of spaceMacros) {
       if (sm.toLowerCase().includes('vv') && new RegExp(`\\b${sm}\\b`).test(text)) {
         is2D = true;
       }
    }
  }
  
  if (!is2D) return null;
  
  const argsMatch = text.match(/\(\s*([^,]+)\s*,\s*(.+)\)/);
  if (argsMatch) {
    const outerArg = argsMatch[1];
    const innerPart = argsMatch[2];
    
    const innerMatch = innerPart.match(/\(\s*([^,]+)\s*,(?:.+)\)/);
    
    let outerClean = cleanVectorArg(outerArg);
    let innerClean = innerMatch ? cleanVectorArg(innerMatch[1]) : outerClean; 
    
    if (outerClean === innerClean) {
      return `O(${outerClean}^2)`;
    } else {
      return `O(${outerClean} * ${innerClean})`;
    }
  }
  
  return null;
}

function detectBoundedSpace(loopNode) {
  if (!loopNode || (loopNode.type !== 'for_statement' && loopNode.type !== 'while_statement' && loopNode.type !== 'for_range_loop')) return null;
  
  const body = loopNode.childForFieldName('body');
  if (!body) return null;
  
  let pushedVar = null;
  let boundVar = null;
  let hasSizeCheck = false;
  let hasPop = false;
  
  const cursor = body.walk();
  function checkBody(c) {
    do {
      const node = c.currentNode;
      const text = node.text;
      
      if (node.type === 'call_expression') {
         const m = text.match(/([A-Za-z0-9_]+)\.(?:push|push_back|insert)\(/);
         if (m) pushedVar = m[1];
      }
      
      if (node.type === 'if_statement' && pushedVar) {
         const cond = node.childForFieldName('condition');
         const cons = node.childForFieldName('consequence');
         
         if (cond && cons) {
            const condText = cond.text;
            const sizeRegex = new RegExp(`\\b${pushedVar}\\.size\\(\\)\\s*(?:>|>=|==)\\s*([A-Za-z0-9_]+)`);
            const sizeMatch = condText.match(sizeRegex);
            
            if (sizeMatch) {
               hasSizeCheck = true;
               boundVar = sizeMatch[1].toUpperCase();
               
               const consText = cons.text;
               const popRegex = new RegExp(`\\b${pushedVar}\\.(?:pop|pop_front|erase)\\(\\)?`);
               if (popRegex.test(consText)) {
                  hasPop = true;
               }
            }
         }
      }
      
      if (c.gotoFirstChild()) {
        checkBody(c);
        c.gotoParent();
      }
    } while (c.gotoNextSibling());
  }
  
  checkBody(cursor);
  
  if (hasSizeCheck && hasPop && boundVar) {
    return `O(${boundVar})`;
  }
  return null;
}

function formatComplexity(rawString, details) {
  let formatted = rawString.toUpperCase().replace(/O\(/i, 'O(').replace(/LOG/g, 'log').replace(/SQRT/g, 'sqrt');
  
  let innerMatch = formatted.match(/O\((.*)\)/);
  if (!innerMatch) return formatted;
  
  let parts = innerMatch[1].split(' * ');
  let numParts = [];
  let varParts = [];
  
  for (let p of parts) {
    if (/^[0-9]+$/.test(p)) {
      numParts.push(p);
    } else {
      varParts.push(p);
    }
  }
  
  if (numParts.length > 0 && varParts.length > 0) {
    details.push(`Dropped constant factor ${numParts.join(' * ')}`);
    formatted = `O(${varParts.join(' * ')})`;
  } else if (numParts.length > 0 && varParts.length === 0) {
    formatted = 'O(1)';
    details.push(`Simplified constant bound ${numParts.join(' * ')} to O(1)`);
  } else {
    formatted = `O(${varParts.join(' * ')})`;
  }
  
  while (formatted.includes('N * N')) {
    formatted = formatted.replace('N * N', 'N^2');
  }
  
  return formatted;
}

function analyzeComplexity(rootNode) {
  const loopMacros = new Set();
  const spaceMacros = new Set();
  const rangeMacros = new Set();
  
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
          if ((name === 'all' || name === 'rall') && value.includes('.begin()') && value.includes('.end()')) {
            rangeMacros.add(name);
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
  let dynamicSpaceStr = 'O(N)';
  let isNLogLogN = false;
  let hasGraphTraversal = false;
  let hasDivideAndConquer = false;
  let hasMemoization = false;
  let memoDim = 1;
  let hasDijkstra = false;
  let hasBoundedSpace = false;
  let boundedSpaceStr = null;
  const details = [];
  
  const containerTypes = new Map();
  
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
        
        const memoResult = detectMemoization(node);
        if (memoResult) {
          hasMemoization = true;
          memoDim = memoResult.dimension;
          skipChildren = true;
          
          for (let i = 0; i < memoDim; i++) {
            nextLinearBounds.push('N');
          }
          
          const currentScore = nextLinearBounds.length + nextSqrtBounds.length * 0.5 + nextLogBounds.length * 0.01;
          if (currentScore > maxScore) {
            maxScore = currentScore;
            maxLinearBounds = [...nextLinearBounds];
            maxLogBounds = [...nextLogBounds];
            maxSqrtBounds = [...nextSqrtBounds];
          }
          details.push(`${memoResult.details} at line ${cursor.startPosition.row + 1}`);
        } else if (detectRecursiveDFS(node)) {
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
          
          details.push(`Detected Recursive Graph Traversal (DFS) at line ${cursor.startPosition.row + 1}`);
        } else {
          const masterResult = detectDivideAndConquer(node);
          if (masterResult) {
            hasDivideAndConquer = true;
            skipChildren = true;
            
            nextLinearBounds.push('N');
            nextLogBounds.push('N');
            
            const currentScore = nextLinearBounds.length + nextSqrtBounds.length * 0.5 + nextLogBounds.length * 0.01;
            if (currentScore > maxScore) {
              maxScore = currentScore;
              maxLinearBounds = [...nextLinearBounds];
              maxLogBounds = [...nextLogBounds];
              maxSqrtBounds = [...nextSqrtBounds];
            }
            
            details.push(`${masterResult.details} at line ${cursor.startPosition.row + 1}`);
          }
        }
      }
      
      let isLoop = false;
      let isLogLoop = false;
      let isSqrtLoop = false;
      let isMacroLoop = false;
      let loopVar = null;
      let macroBaseName = null;
      let isTopK = false;
      let topKBound = 'K';

      if (type === 'call_expression') {
        const functionNode = node.childForFieldName('function');
        let baseName = null;
        let objName = null;
        let methodName = null;
        
        if (functionNode) {
          if (functionNode.type === 'scoped_identifier') {
            const nameNode = functionNode.childForFieldName('name');
            if (nameNode) baseName = nameNode.text;
          } else if (functionNode.type === 'identifier') {
            baseName = functionNode.text;
          } else if (functionNode.type === 'field_expression') {
            const objNode = functionNode.childForFieldName('argument');
            const fieldNode = functionNode.childForFieldName('field');
            if (objNode) objName = objNode.text;
            if (fieldNode) methodName = fieldNode.text;
          }
        }
        
        if (objName && methodName && containerTypes.has(objName)) {
           const cType = containerTypes.get(objName);
           if (['set', 'multiset', 'map'].includes(cType)) {
              if (['insert', 'erase', 'find', 'count', 'lower_bound', 'upper_bound'].includes(methodName)) {
                 nextLogBounds.push('N');
                 details.push(`Found logarithmic operation '${methodName}' on ${cType} '${objName}' at line ${cursor.startPosition.row + 1}`);
                 
                 const currentScore = nextLinearBounds.length + nextSqrtBounds.length * 0.5 + nextLogBounds.length * 0.01;
                 if (currentScore > maxScore) {
                   maxScore = currentScore;
                   maxLinearBounds = [...nextLinearBounds];
                   maxLogBounds = [...nextLogBounds];
                   maxSqrtBounds = [...nextSqrtBounds];
                 }
              }
           } else if (cType === 'priority_queue') {
              if (['push', 'pop'].includes(methodName)) {
                 nextLogBounds.push('N');
                 details.push(`Found logarithmic operation '${methodName}' on priority_queue '${objName}' at line ${cursor.startPosition.row + 1}`);
                 
                 const currentScore = nextLinearBounds.length + nextSqrtBounds.length * 0.5 + nextLogBounds.length * 0.01;
                 if (currentScore > maxScore) {
                   maxScore = currentScore;
                   maxLinearBounds = [...nextLinearBounds];
                   maxLogBounds = [...nextLogBounds];
                   maxSqrtBounds = [...nextSqrtBounds];
                 }
              }
           }
        }
        
        if (baseName && loopMacros.has(baseName)) {
          isLoop = true;
          isMacroLoop = true;
          macroBaseName = baseName;
        } else if (baseName && stlHeuristics[baseName]) {
          const h = stlHeuristics[baseName];
          let boundStr = 'N';
          let hasRangeMacro = false;
          let rangeVar = null;
          let macroName = null;

          const argsNode = node.childForFieldName('arguments');
          if (argsNode) {
            for (let i = 0; i < argsNode.childCount; i++) {
              const argChild = argsNode.child(i);
              if (argChild.type === 'call_expression') {
                const mFunc = argChild.childForFieldName('function');
                if (mFunc && rangeMacros.has(mFunc.text)) {
                  const mArgs = argChild.childForFieldName('arguments');
                  if (mArgs && mArgs.childCount > 1) {
                    const varNode = mArgs.child(1);
                    if (varNode) {
                      boundStr = varNode.text.toUpperCase();
                      hasRangeMacro = true;
                      rangeVar = varNode.text;
                      macroName = mFunc.text;
                      break;
                    }
                  }
                }
              }
            }
          }

          if (h === 'O(N log N)') {
            nextLinearBounds.push(boundStr);
            nextLogBounds.push(boundStr);
          } else if (h === 'O(log N)') {
            nextLogBounds.push(boundStr);
          } else if (h === 'O(N)') {
            nextLinearBounds.push(boundStr);
          }
          
          const currentScore = nextLinearBounds.length + nextSqrtBounds.length * 0.5 + nextLogBounds.length * 0.01;
          if (currentScore > maxScore) {
            maxScore = currentScore;
            maxLinearBounds = [...nextLinearBounds];
            maxLogBounds = [...nextLogBounds];
            maxSqrtBounds = [...nextSqrtBounds];
          }
          if (hasRangeMacro) {
             details.push(`Expanded range macro ${macroName}() operating on container ${rangeVar}`);
          } else {
             details.push(`Found STL '${baseName}' call at line ${cursor.startPosition.row + 1} (${h})`);
          }
        }

        const match = node.text.match(/^([\w:]+)\s*\(/);
        if (match && match[1] === currentFunctionName && !skipChildren) {
          isRecursive = true;
        }
      }
      
      if (type === 'new_expression') {
        if (node.text.includes('[')) hasDynamicSpace = true;
      }
      
      if (type === 'declaration' || type === 'variable_declaration') {
        const text = node.text;
        if (text.includes('priority_queue')) {
           const match = text.match(/priority_queue\s*<.*>\s*([A-Za-z0-9_]+)/);
           if (match) {
              containerTypes.set(match[1], 'priority_queue');
              hasDynamicSpace = true;
           }
        }
        
        const setMatch = text.match(/\b(set|multiset|map|unordered_map|unordered_set)\b/);
        if (setMatch) {
           const typeName = setMatch[1];
           const varMatch = text.match(/(?:set|multiset|map|unordered_map|unordered_set)\s*<.*>\s*([A-Za-z0-9_]+)/);
           if (varMatch) {
              containerTypes.set(varMatch[1], typeName);
              hasDynamicSpace = true;
           }
        }
        
        const vectorSpace = detectVectorSpaceComplexity(node, spaceMacros);
        if (vectorSpace) {
           hasDynamicSpace = true;
           dynamicSpaceStr = vectorSpace;
        } else if (text.includes('vector') || text.includes('[')) {
          hasDynamicSpace = true;
        } else {
          for (const sm of spaceMacros) {
            const regex = new RegExp(`\\b${sm}\\b`);
            if (regex.test(text)) hasDynamicSpace = true;
          }
        }
      }

      if (type === 'for_statement' || type === 'for_range_loop') {
        const boundedSpace = detectBoundedSpace(node);
        if (boundedSpace) {
           hasBoundedSpace = true;
           boundedSpaceStr = boundedSpace;
           details.push(`Detected dynamically bounded space (Size Capped at ${boundedSpace.match(/\((.+)\)/)[1]}) at line ${cursor.startPosition.row + 1}`);
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
        let graphType = null;
        let isBinSearch = false;
        
        if (type === 'while_statement') {
           const boundedSpace = detectBoundedSpace(node);
           if (boundedSpace) {
              hasBoundedSpace = true;
              boundedSpaceStr = boundedSpace;
              details.push(`Detected dynamically bounded space (Size Capped at ${boundedSpace.match(/\((.+)\)/)[1]}) at line ${cursor.startPosition.row + 1}`);
           }
           
           const pqKeys = Array.from(containerTypes.entries()).filter(e => e[1] === 'priority_queue').map(e => e[0]);
           graphType = detectGraphTraversal(node, pqKeys);
           if (!graphType) {
              isBinSearch = detectBinarySearch(node);
           }
        }
        
        if (graphType) {
          hasGraphTraversal = true;
          skipChildren = true;
          
          let bound = graphType === 'O(E log V)' ? 'E * log V' : 'V + E';
          nextLinearBounds.push(bound);
          
          const currentScore = nextLinearBounds.length + nextSqrtBounds.length * 0.5 + nextLogBounds.length * 0.01;
          if (currentScore > maxScore) {
            maxScore = currentScore;
            maxLinearBounds = [...nextLinearBounds];
            maxLogBounds = [...nextLogBounds];
            maxSqrtBounds = [...nextSqrtBounds];
          }
          
          if (graphType === 'O(E log V)') {
            details.push(`Detected Dijkstra-style Graph Traversal at line ${cursor.startPosition.row + 1}`);
            hasDijkstra = true;
          } else {
            details.push(`Detected standard Graph Traversal (BFS/DFS) at line ${cursor.startPosition.row + 1}`);
          }
        } else if (isBinSearch) {
          skipChildren = true;
          nextLogBounds.push('N');
          
          const currentScore = nextLinearBounds.length + nextSqrtBounds.length * 0.5 + nextLogBounds.length * 0.01;
          if (currentScore > maxScore) {
            maxScore = currentScore;
            maxLinearBounds = [...nextLinearBounds];
            maxLogBounds = [...nextLogBounds];
            maxSqrtBounds = [...nextSqrtBounds];
          }
          
          details.push(`Detected manual Binary Search (Search Space Halving) at line ${cursor.startPosition.row + 1}`);
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
  
  timeComplexity = formatComplexity(timeComplexity, details);
  
  if (isNLogLogN) {
    timeComplexity = 'O(N log log N)';
    details.push('Detected Sieve-like nested loop pattern (e.g. j += i): O(N log log N)');
  }
  
  let spaceComplexity = 'O(1)';
  if (hasBoundedSpace) {
    spaceComplexity = boundedSpaceStr;
  } else if (hasGraphTraversal) {
    spaceComplexity = 'O(V)';
    details.push('Dynamic space allocation detected (Graph queue/visited array: O(V))');
  } else if (hasMemoization) {
    spaceComplexity = memoDim === 1 ? 'O(N)' : `O(N^${memoDim})`;
    details.push(`Dynamic space allocation detected (Memoization Cache table: ${spaceComplexity})`);
  } else if (hasDivideAndConquer) {
    spaceComplexity = 'O(N)';
    details.push('Dynamic space allocation detected (Master Theorem recursive memory: O(N))');
  } else if (hasDynamicSpace) {
    spaceComplexity = dynamicSpaceStr;
    if (dynamicSpaceStr !== 'O(N)') {
       details.push(`Dynamic 2D space allocation detected: ${dynamicSpaceStr}`);
    } else {
       details.push('Dynamic space allocation detected (e.g., arrays, vectors, or new[])');
    }
  }
  
  if (isRecursive && !hasGraphTraversal && !hasDivideAndConquer && !hasMemoization) {
    details.push('Recursive call detected');
  }
  
  return { timeComplexity, spaceComplexity, details };
}

module.exports = { parseCode, analyzeComplexity };
