import React, { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

const CodeEditor = ({ code, onChange, onSubmit, isLoading, highlightLines = [] }) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const oldDecorationsRef = useRef([]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const newDecorations = highlightLines.map(line => ({
      range: new monacoRef.current.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: 'slow-code-highlight'
      }
    }));

    oldDecorationsRef.current = editorRef.current.deltaDecorations(oldDecorationsRef.current, newDecorations);
  }, [highlightLines]);

  return (
    <div className="flex flex-col space-y-4 bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
      <div className="rounded-xl overflow-hidden border border-gray-700">
        <Editor
          height="60vh"
          language="cpp"
          theme="vs-dark"
          value={code}
          onChange={onChange}
          onMount={handleEditorDidMount}
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
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
