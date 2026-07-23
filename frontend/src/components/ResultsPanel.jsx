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
      <div className="card bg-base-200 shadow-xl border border-base-300 flex items-center justify-center h-full min-h-[300px]">
        <div className="card-body items-center justify-center text-center">
          <p className="text-base-content/70 font-medium">Submit code to see the complexity analysis.</p>
        </div>
      </div>
    );
  }

  const { timeComplexity, spaceComplexity, details } = results.analysis;

  const getBadgeColor = (complexity) => {
    if (!complexity) return 'badge-neutral';
    if (complexity === 'O(1)' || complexity === 'O(log N)') {
       return 'badge-success';
    }
    if (complexity === 'O(N)' || complexity === 'O(V + E)') {
       return 'badge-warning';
    }
    return 'badge-error';
  };

  return (
    <div className="card bg-base-200 shadow-xl border border-base-300 h-full transition-all duration-500 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="card-body flex flex-col h-full">
        <h2 className="card-title text-xl font-bold mb-4 text-base-content border-b border-base-300 pb-4">
          Analysis Results
        </h2>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="flex flex-col space-y-3">
            <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider">Time Complexity</span>
            <div className="flex">
              <span className={`badge badge-lg p-4 font-bold text-lg ${getBadgeColor(timeComplexity)} shadow-sm transition-all duration-300`}>
                {formatBadgeText(timeComplexity)}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col space-y-3">
            <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider">Space Complexity</span>
            <div className="flex">
              <span className={`badge badge-lg p-4 font-bold text-lg ${getBadgeColor(spaceComplexity)} shadow-sm transition-all duration-300`}>
                {formatBadgeText(spaceComplexity)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-grow">
          <h3 className="text-xs font-bold text-base-content/70 uppercase tracking-wider mb-4">Detection Details</h3>
          {details && details.length > 0 ? (
            <ul className="space-y-3 bg-base-300/50 rounded-xl p-5 border border-base-300">
              {details.map((detail, index) => (
                <li key={index} className="flex items-start text-base-content text-sm font-medium">
                  <span className="text-success mr-3 mt-0.5 flex-shrink-0">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base-content/60 text-sm italic bg-base-300/50 rounded-xl p-4 border border-base-300 text-center">
              No specific loop patterns or dynamic allocations detected.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsPanel;
