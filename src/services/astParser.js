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

  let maxLinear = 0;
  let maxLog = 0;
  let isRecursive = false;
  let hasDynamicSpace = false;
  let isNLogLogN = false;
  const details = [];
  
  const cursor = rootNode.walk();
  
  function walk(cursor, currentLinear, currentLog, currentFunctionName, activeLoopVars) {
    do {
      const type = cursor.nodeType;
      const node = cursor.currentNode;
      
      let nextLinear = currentLinear;
      let nextLog = currentLog;
      let nextFunctionName = currentFunctionName;
      let nextLoopVars = activeLoopVars;
      let currentLoopVariable = activeLoopVars.length > 0 ? activeLoopVars[activeLoopVars.length - 1] : null;
      
      if (type === 'function_definition') {
        const match = node.text.match(/(\w+)\s*\(/);
        if (match) {
          nextFunctionName = match[1];
        }
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
            nextLinear++;
            nextLog++;
          } else if (h === 'O(log N)') {
            nextLog++;
          } else if (h === 'O(N)') {
            nextLinear++;
          }
          
          const currentScore = nextLinear + nextLog * 0.01;
          const maxScore = maxLinear + maxLog * 0.01;
          if (currentScore > maxScore) {
            maxLinear = nextLinear;
            maxLog = nextLog;
          }
          details.push(`Found STL '${baseName}' call at line ${cursor.startPosition.row + 1} (${h})`);
        }

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
        const text = node.text;
        if (text.includes('vector') || text.includes('[')) {
          hasDynamicSpace = true;
        } else {
          for (const sm of spaceMacros) {
            const regex = new RegExp(`\\b${sm}\\b`);
            if (regex.test(text)) {
              hasDynamicSpace = true;
            }
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
        isLoop = true;
      }
      
      if (isLoop) {
        if (isLogLoop) {
          nextLog++;
        } else if (isSqrtLoop) {
          nextLinear += 0.5;
        } else {
          nextLinear++;
        }
        
        const currentScore = nextLinear + nextLog * 0.01;
        const maxScore = maxLinear + maxLog * 0.01;
        
        if (currentScore > maxScore) {
          maxLinear = nextLinear;
          maxLog = nextLog;
        }
        
        let loopMsg = `Found ${isLogLoop ? 'O(log N)' : (isSqrtLoop ? 'O(sqrt N)' : 'O(N)')} loop at line ${cursor.startPosition.row + 1}`;
        if (isMacroLoop) {
          loopMsg = `Found O(N) macro loop '${macroBaseName}' at line ${cursor.startPosition.row + 1}`;
        } else if (type === 'for_statement' && loopVar) {
          loopMsg += ` tracking variable '${loopVar}'`;
        }
        details.push(loopMsg);
      }
      
      if (cursor.gotoFirstChild()) {
        walk(cursor, nextLinear, nextLog, nextFunctionName, nextLoopVars);
        cursor.gotoParent();
      }
    } while (cursor.gotoNextSibling());
  }
  
  walk(cursor, 0, 0, null, []);
  
  let timeComplexity = 'O(1)';
  if (maxLinear === 0 && maxLog > 0) {
    timeComplexity = maxLog === 1 ? 'O(log N)' : `O(log^${maxLog} N)`;
  } else if (maxLinear > 0) {
    let linPart = '';
    if (maxLinear === 0.5) {
      linPart = 'sqrt(N)';
    } else if (maxLinear === 1) {
      linPart = 'N';
    } else if (maxLinear === 1.5) {
      linPart = 'N sqrt(N)';
    } else if (Number.isInteger(maxLinear)) {
      linPart = `N^${maxLinear}`;
    } else {
      linPart = `N^${Math.floor(maxLinear)} sqrt(N)`;
    }
    const logPart = maxLog === 0 ? '' : (maxLog === 1 ? ' log N' : ` log^${maxLog} N`);
    timeComplexity = `O(${linPart}${logPart})`;
  }
  
  if (isNLogLogN) {
    timeComplexity = 'O(N log log N)';
    details.push('Detected Sieve-like nested loop pattern (e.g. j += i): O(N log log N)');
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
