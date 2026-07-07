import React, { useState, useEffect } from 'react';
import axios from 'axios';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
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
    <div className="bg-gray-900 shadow-xl shadow-black/50 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-700">
        <h2 className="text-xl font-bold text-gray-100">Analysis History</h2>
        <p className="text-sm text-gray-400 mt-1">Review your most recent complexity evaluations.</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Code Snippet</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Time Complexity</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Space Complexity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {history.length > 0 ? (
              history.map((record) => (
                <tr key={record._id} className="odd:bg-gray-900 even:bg-gray-800/50 hover:bg-gray-700 transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-medium">
                    {new Date(record.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 max-w-[12rem] sm:max-w-xs md:max-w-sm lg:max-w-md">
                    <code className="bg-gray-800 text-gray-300 font-mono text-sm px-2 py-1 rounded block truncate border border-gray-700/50">
                      {record.codeSnippet.replace(/\s+/g, ' ')}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold border shadow-sm ${getBadgeColor(record.timeComplexity)}`}>
                      {formatBadgeText(record.timeComplexity)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold border shadow-sm ${getBadgeColor(record.spaceComplexity)}`}>
                      {formatBadgeText(record.spaceComplexity)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="px-6 py-12 text-center text-gray-500 text-sm">
                  No analysis history found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default History;
