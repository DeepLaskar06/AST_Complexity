import React from 'react';
import Editor from '@monaco-editor/react';

const CodeEditor = ({ code, onChange, onSubmit, isLoading }) => {
  return (
    <div className="flex flex-col space-y-4">
      <div className="rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
        <Editor
          height="60vh"
          language="cpp"
          theme="vs-dark"
          value={code}
          onChange={onChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            padding: { top: 16, bottom: 16 }
          }}
        />
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Analyzing...</span>
            </>
          ) : (
            <span>Submit for Analysis</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default CodeEditor;
