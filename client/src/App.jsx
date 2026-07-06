import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import History from './pages/History';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
        <Toaster position="top-right" />
        {/* Navigation Bar */}
        <nav className="bg-white/70 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-slate-200">
          <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              AST Complexity
            </h1>
            <div className="space-x-6">
              <Link to="/" className="text-slate-600 hover:text-indigo-600 font-semibold transition-colors duration-200">
                Editor
              </Link>
              <Link to="/history" className="text-slate-600 hover:text-indigo-600 font-semibold transition-colors duration-200">
                History
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="max-w-[1400px] mx-auto p-6 mt-4">
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
