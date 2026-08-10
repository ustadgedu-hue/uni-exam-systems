import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../utils/api';
import { PaperView } from '../Admin/AdminDashboard';

export default function ResultsPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get(`/student/results/${attemptId}`)
      .then(r => setAttempt(r.data))
      .catch(() => navigate('/student'))
      .finally(() => setLoading(false));
  }, [attemptId, navigate]);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 20 }} onClick={() => navigate('/student')}>← Back to Dashboard</button>
      <PaperView attempt={attempt} showHighlights={true} role="student" />
    </div>
  );
}
