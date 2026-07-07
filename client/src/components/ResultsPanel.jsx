import React from 'react';

const formatBadgeText = (text) => {
  if (!text) return '';
  const parts = text.split('^');
  if (parts.length === 1) return text;
  
  const regex = /\^([A-Z0-9]+)/g;
  const elements = [];
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    elements.push(text.substring(lastIndex, match.index));
    elements.push(<sup key={match.index}>{match[1]}</sup>);
    lastIndex = regex.lastIndex;
  }
  elements.push(text.substring(lastIndex));
  
  return <>{elements}</>;
};

const ResultsPanel = ({ results }) => {
  if (!results || !results.analysis) {
    return (
      <div className="p-6 bg-white shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100 flex items-center justify-center h-full min-h-[300px]">
        <p className="text-slate-400 font-medium">Submit code to see the complexity analysis.</p>
      </div>
    );
  }

  const { timeComplexity, spaceComplexity, details } = results.analysis;

  // Helper to determine badge colors based on complexity
  const getBadgeColor = (complexity) => {
    if (!complexity) return 'bg-gray-100 text-gray-700';
    if (complexity === 'O(1)') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (complexity === 'O(N)') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (complexity === 'O(N^2)') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (complexity.includes('N^')) return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="p-6 bg-white shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-6 text-slate-800 border-b border-slate-100 pb-4">Analysis Results</h2>
      
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="flex flex-col space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time Complexity</span>
          <div className="flex">
            <span className={`px-4 py-1.5 rounded-full font-bold text-sm border ${getBadgeColor(timeComplexity)} shadow-sm transition-all duration-300`}>
              {formatBadgeText(timeComplexity)}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Space Complexity</span>
          <div className="flex">
            <span className={`px-4 py-1.5 rounded-full font-bold text-sm border ${getBadgeColor(spaceComplexity)} shadow-sm transition-all duration-300`}>
              {formatBadgeText(spaceComplexity)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-grow">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Detection Details</h3>
        {details && details.length > 0 ? (
          <ul className="space-y-3 bg-slate-50 rounded-xl p-5 border border-slate-100">
            {details.map((detail, index) => (
              <li key={index} className="flex items-start text-slate-700 text-sm font-medium">
                <span className="text-indigo-500 mr-3 mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400 text-sm italic bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
            No specific loop patterns or dynamic allocations detected.
          </p>
        )}
      </div>
    </div>
  );
};

export default ResultsPanel;
