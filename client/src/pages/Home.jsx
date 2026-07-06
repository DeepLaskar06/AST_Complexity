import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import CodeEditor from '../components/CodeEditor';
import ResultsPanel from '../components/ResultsPanel';

const Home = () => {
  const [code, setCode] = useState('// Write your C++ code here\n\nint main() {\n  for(int i=0; i<10; i++) {\n    // do something\n  }\n  return 0;\n}');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error("Please enter some C++ code first!");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/analyze', { code });
      setResults(response.data);
      toast.success("Analysis complete!");
    } catch (error) {
      console.error(error);
      toast.error("Backend unreachable. Please ensure the Node.js server is running.", {
        duration: 5000,
        style: {
          background: '#fee2e2',
          color: '#b91c1c',
          border: '1px solid #fca5a5'
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h2 className="text-xl font-bold mb-4 text-slate-800">Code Editor</h2>
        <CodeEditor 
          code={code} 
          onChange={setCode} 
          onSubmit={handleSubmit} 
          isLoading={isLoading}
          details={results?.analysis?.details}
        />
      </div>
      <div>
        <ResultsPanel results={results} />
      </div>
    </div>
  );
};

export default Home;
