import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import History from './pages/History';

function App() {
  return (
    <Router>
      <div className="min-h-screen w-full bg-base-100 text-base-content flex flex-col font-sans">
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#1b2e2b',
            color: '#1eb854',
          }
        }} />
        {/* Navigation Bar */}
        <nav className="navbar bg-base-200/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-base-300 px-6">
          <div className="max-w-[1400px] mx-auto w-full flex justify-between items-center">
            <h1 className="text-3xl font-extrabold text-primary py-4">
              AST Complexity
            </h1>
            <div className="flex space-x-3">
              <Link to="/" className="btn btn-ghost font-semibold">
                Editor
              </Link>
              <Link to="/history" className="btn btn-ghost font-semibold">
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
