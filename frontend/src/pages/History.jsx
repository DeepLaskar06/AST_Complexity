import React, { useState, useEffect } from 'react';
import axios from 'axios';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    if (selectedRecord) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedRecord]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/history');
        setHistory(response.data);
      } catch (err) {
        setError('Failed to fetch history data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

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

  const getBadgeColor = (complexity) => {
    if (!complexity) return 'bg-gray-700 text-gray-300 border-gray-600';
    if (complexity === 'O(1)' || (complexity.includes('log N') && !complexity.includes('*'))) {
       return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
    if (complexity === 'O(N)' || complexity.includes('O(V + E)')) {
       return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 text-red-400 p-4 rounded-xl shadow-sm border border-red-500/30">
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-900 shadow-xl shadow-black/50 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-700">
          <h2 className="text-xl font-bold text-gray-100">Analysis History</h2>
          <p className="text-sm text-gray-400 mt-1">Review your most recent complexity evaluations.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
            <thead>
              <tr className="bg-gray-800 border-b border-gray-700">
                <th className="w-1/6 px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="w-2/6 px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Code Snippet</th>
                <th className="w-1/6 px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Time Complexity</th>
                <th className="w-1/6 px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Space Complexity</th>
                <th className="w-1/6 px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {history.length > 0 ? (
                history.map((record) => (
                  <tr key={record._id} className="odd:bg-gray-900 even:bg-gray-800/50 hover:bg-gray-700 transition-colors duration-200">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 font-medium truncate">
                      {new Date(record.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-300">
                      <div className="flex items-center space-x-2">
                        <code className="bg-gray-800 text-gray-300 font-mono text-sm px-2 py-1 rounded block truncate border border-gray-700/50 flex-1">
                          {record.codeSnippet.replace(/\s+/g, ' ')}
                        </code>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold border shadow-sm ${getBadgeColor(record.timeComplexity)}`}>
                        {formatBadgeText(record.timeComplexity)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold border shadow-sm ${getBadgeColor(record.spaceComplexity)}`}>
                        {formatBadgeText(record.spaceComplexity)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button 
                        onClick={() => setSelectedRecord(record)}
                        className="bg-gray-800 hover:bg-gray-600 text-cyan-400 border border-gray-600 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                      >
                        View Full Code
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500 text-sm">
                    No analysis history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Viewer Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800">
              <h3 className="text-lg font-bold text-gray-100">Full Code Snippet</h3>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-gray-950">
              <pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap">
                {selectedRecord.codeSnippet}
              </pre>
            </div>
            <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
              <div className="flex space-x-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${getBadgeColor(selectedRecord.timeComplexity)}`}>
                  Time: {formatBadgeText(selectedRecord.timeComplexity)}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${getBadgeColor(selectedRecord.spaceComplexity)}`}>
                  Space: {formatBadgeText(selectedRecord.spaceComplexity)}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Analyzed on {new Date(selectedRecord.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default History;
