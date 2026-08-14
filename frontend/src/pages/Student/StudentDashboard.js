import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Common/Sidebar';
import API from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, formatDate, formatTime } from '../../utils/datetime';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [activeTab, setActiveTab] = useState('exams');
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([API.get('/exam/available'), API.get('/student/results')])
      .then(([eR, rR]) => { setExams(eR.data); setResults(rR.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const getTimeLeft = (endTime) => {
    const diff = new Date(endTime) - new Date();
    if (diff <= 0) return 'Ended';
    const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  };

  const getTimeUntilStart = (startTime) => {
    const diff = new Date(startTime) - new Date();
    if (diff <= 0) return '';
    const m = Math.floor(diff/60000);
    return m > 0 ? `Starts in ${m} min` : 'Starting now';
  };

  return (
    <div className="layout">
      <Sidebar role="student" />
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">Student Portal</span>
          <div className="topbar-user">
            <div className="user-avatar">{user?.name?.[0]}</div>
            <div>
              <div style={{ fontSize:14, fontWeight:500 }}>{user?.name}</div>
              <div style={{ fontSize:11, color:'#6b7280' }}>{user?.program} | Sem {user?.semester} | {user?.studentId}</div>
            </div>
          </div>
        </div>
        <div className="page-content">
          <div className="stats-grid">
            {[
              { label:'Available', value:exams.filter(e=>!e.attempted&&e.canStart).length, icon:'📝', color:'#dbeafe' },
              { label:'Upcoming', value:exams.filter(e=>!e.attempted&&!e.canStart).length, icon:'⏳', color:'#fef3c7' },
              { label:'Completed', value:results.length, icon:'✅', color:'#d1fae5' },
              { label:'Semester', value:`Sem ${user?.semester||'—'}`, icon:'🎓', color:'#fce7f3' },
            ].map(s=>(
              <div className="stat-card" key={s.label}><div className="stat-icon" style={{ background:s.color }}>{s.icon}</div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
            ))}
          </div>
          <div className="tabs">
            <button className={`tab-btn ${activeTab==='exams'?'active':''}`} onClick={()=>setActiveTab('exams')}>📝 Exams</button>
            <button className={`tab-btn ${activeTab==='results'?'active':''}`} onClick={()=>setActiveTab('results')}>📊 My Results</button>
          </div>
          {loading ? <div className="loading-inline"><div className="spinner"></div></div> : (
            <>
              {activeTab==='exams' && (
                !exams.length
                  ? <div className="empty-state"><div className="empty-state-icon">📭</div><h3>No exams right now</h3><p>Exams will appear here when your instructor schedules them.</p></div>
                  : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
                    {exams.map(e=>(
                      <div key={e._id} className="card" style={{ borderLeft:`4px solid ${e.attempted?'#0e9f6e':e.inProgress?'#f59e0b':e.canStart?'#1a56db':'#f59e0b'}` }}>
                        <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>{e.title}</div>
                        <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>{e.course?.courseCode} — {e.course?.courseName}</div>
                        <div style={{ fontSize:13, display:'flex', flexDirection:'column', gap:4, marginBottom:14 }}>
                          <span>⏱ Duration: {e.duration} min</span>
                          <span>🕐 Start: {formatDateTime(e.startTime)}</span>
                          <span>🕑 End: {formatDateTime(e.endTime)}</span>
                          {!e.canStart && (
                            <span style={{ color:'#f59e0b', fontWeight:500 }}>⏳ {getTimeUntilStart(e.startTime)}</span>
                          )}
                          {e.canStart && (
                            <span style={{ color:'#0e9f6e', fontWeight:500 }}>⏳ {getTimeLeft(e.endTime)}</span>
                          )}
                        </div>
                        {e.attempted
                          ? <span className="badge badge-success" style={{ fontSize:13, display:'block', textAlign:'center', padding:'8px 12px' }}>✅ Submitted</span>
                          : e.inProgress
                            ? <button className="btn btn-warning" style={{ width:'100%', justifyContent:'center', background:'#f59e0b', color:'#fff' }} onClick={()=>navigate(`/student/exam/${e._id}`)}>▶️ Resume Exam</button>
                            : e.canStart
                              ? <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={()=>navigate(`/student/exam/${e._id}`)}>▶️ Start Exam</button>
                              : <div style={{ padding:'8px 12px', background:'#fef3c7', borderRadius:8, fontSize:13, color:'#92400e', textAlign:'center' }}>
                                  ⏳ Starting soon — {formatTime(e.startTime)}
                                </div>
                        }
                      </div>
                    ))}
                  </div>
              )}
              {activeTab==='results' && (
                <div className="card">
                  {!results.length
                    ? <div className="empty-state"><div className="empty-state-icon">📊</div><h3>No results yet</h3></div>
                    : <div className="table-container"><table>
                      <thead><tr><th>Exam</th><th>Course</th><th>Marks</th><th>%</th><th>Grade</th><th>Date</th><th>Action</th></tr></thead>
                      <tbody>{results.map(r=>(
                        <tr key={r._id}>
                          <td><strong>{r.exam?.title}</strong></td>
                          <td>{r.exam?.course?.courseCode}</td>
                          <td>{r.totalMarksObtained}/{r.totalMarks}</td>
                          <td>{r.percentage}%</td>
                          <td><span className={`badge ${r.percentage>=50?'badge-success':'badge-danger'}`}>{r.grade}</span></td>
                          <td>{formatDate(r.submittedAt)}</td>
                          <td>{r.status==='graded'
                            ? <button className="btn btn-sm btn-outline" onClick={()=>navigate(`/student/results/${r._id}`)}>View Paper</button>
                            : <span className="badge badge-warning">Pending Grading</span>
                          }</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                  }
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
