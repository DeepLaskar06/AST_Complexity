const express = require('express');
const router = express.Router();
const { parseCode } = require('../services/astParser');

function serializeNode(node) {
  if (!node) return null;
  
  const serialized = {
    type: node.type,
    startPosition: node.startPosition,
    endPosition: node.endPosition,
  };
  
  if (node.childCount === 0) {
    serialized.text = node.text;
  } else {
    serialized.children = node.children.map(serializeNode);
  }
  
  return serialized;
}

router.post('/analyze', (req, res) => {
  try {
    const { code } = req.body;
    if (typeof code !== 'string') {
      return res.status(400).json({ error: 'Code must be a string' });
    }
    
    const rootNode = parseCode(code);
    const serializedAST = serializeNode(rootNode);
    
    res.json(serializedAST);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to parse code' });
  }
});

module.exports = router;
