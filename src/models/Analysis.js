const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  codeSnippet: { type: String, required: true },
  timeComplexity: { type: String, required: true },
  spaceComplexity: { type: String, required: true },
  details: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Analysis', analysisSchema);
