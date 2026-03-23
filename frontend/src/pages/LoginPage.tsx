import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error || 'Login failed');
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Codely</h1>
          <p className="text-gray-400 mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-lg shadow-lg">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="mt-4 text-center text-gray-400 text-sm">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
