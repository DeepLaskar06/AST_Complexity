const express = require('express');
const router = express.Router();
const { parseCode, analyzeComplexity } = require('../services/astParser');
const Analysis = require('../models/Analysis');

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

router.post('/analyze', async (req, res) => {
  try {
    const { code } = req.body;
    if (typeof code !== 'string') {
      return res.status(400).json({ error: 'Code must be a string' });
    }
    
    const rootNode = parseCode(code);
    
    // Analyze complexity
    const analysisResult = analyzeComplexity(rootNode);
    
    // Save to database
    const analysisRecord = new Analysis({
      codeSnippet: code,
      timeComplexity: analysisResult.timeComplexity,
      spaceComplexity: analysisResult.spaceComplexity,
      details: analysisResult.details
    });
    await analysisRecord.save();
    
    // Serialize AST
    const serializedAST = serializeNode(rootNode);
    
    res.json({
      analysis: analysisRecord,
      ast: serializedAST
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to analyze code' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const history = await Analysis.find().sort({ createdAt: -1 }).limit(10);
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
