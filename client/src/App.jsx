import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import History from './pages/History';

function App() {
  return (
    <Router>
      <div className="min-h-screen w-full bg-gray-900 text-gray-100 flex flex-col font-sans">
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#374151',
            color: '#f3f4f6',
          }
        }} />
        {/* Navigation Bar */}
        <nav className="bg-gray-900/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-800">
          <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-4xl font-extrabold text-center py-8 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              AST Complexity
            </h1>
            <div className="space-x-6">
              <Link to="/" className="text-gray-300 hover:text-cyan-400 font-semibold transition-colors duration-200">
                Editor
              </Link>
              <Link to="/history" className="text-gray-300 hover:text-cyan-400 font-semibold transition-colors duration-200">
                History
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="max-w-[1400px] mx-auto w-full flex-grow p-6 mt-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
