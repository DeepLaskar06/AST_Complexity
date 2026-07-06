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

  const getBadgeColor = (complexity) => {
    if (!complexity) return 'bg-gray-100 text-gray-700';
    if (complexity.includes('O(1)')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (complexity.includes('O(N)')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (complexity.includes('O(N^2)')) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (complexity.includes('N^')) return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl shadow-sm border border-red-100">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-800">Analysis History</h2>
        <p className="text-sm text-slate-500 mt-1">Review your most recent complexity evaluations.</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Code Snippet</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Time Complexity</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Space Complexity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.length > 0 ? (
              history.map((record) => (
                <tr key={record._id} className="hover:bg-slate-50/50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                    {new Date(record.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-md">
                    <code className="bg-slate-100 text-slate-800 px-2 py-1.5 rounded font-mono text-xs block truncate">
                      {record.codeSnippet.replace(/\s+/g, ' ')}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeColor(record.timeComplexity)}`}>
                      {record.timeComplexity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeColor(record.spaceComplexity)}`}>
                      {record.spaceComplexity}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="px-6 py-12 text-center text-slate-500 text-sm">
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
