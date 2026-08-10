import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please enter email and password');
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome, ${user.name}!`);
      navigate(`/${user.role}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div style={{ fontSize: 48, marginBottom: 20 }}>🎓</div>
        <h1>University Online<br />Examination System</h1>
        <p>A secure, modern platform for conducting online exams and quizzes for university students.</p>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['✅ Instant MCQ Grading', '📊 Real-time Analytics', '🔒 Cheating Detection', '📚 Past Papers Library'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9, fontSize: 15 }}>{f}</div>
          ))}
        </div>
      </div>
      <div className="login-right">
        <div className="login-form-box">
          <h2>Sign In</h2>
          <p>Enter your credentials to access your account</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-control" type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-control" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 15 }}
              type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <div style={{ marginTop: 24, padding: 16, background: '#f3f4f6', borderRadius: 8, fontSize: 12, color: '#6b7280' }}>
            <strong>Contact your administrator</strong> to get your login credentials.
          </div>
        </div>
      </div>
    </div>
  );
}
