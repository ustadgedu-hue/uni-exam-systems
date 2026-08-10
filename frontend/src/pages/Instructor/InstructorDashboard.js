import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../components/Common/Sidebar';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import API from '../../utils/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { PaperView } from '../Admin/AdminDashboard';
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

function Overview() {
  const [exams, setExams] = useState([]);
  const navigate = useNavigate();
  useEffect(() => { API.get('/instructor/exams').then(r => setExams(r.data)).catch(() => {}); }, []);
  const now = new Date();
  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>Instructor Dashboard</h2>
      <div className="stats-grid">
        {[{ label:'Total Exams', value:exams.length, icon:'📝', color:'#dbeafe' },
          { label:'Active Now', value:exams.filter(e=>new Date(e.startTime)<=now&&new Date(e.endTime)>=now).length, icon:'🟢', color:'#d1fae5' },
          { label:'Upcoming', value:exams.filter(e=>new Date(e.startTime)>now).length, icon:'⏳', color:'#fef3c7' }
        ].map(s=>(
          <div className="stat-card" key={s.label}><div className="stat-icon" style={{ background:s.color }}>{s.icon}</div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">My Exams</span><button className="btn btn-primary btn-sm" onClick={()=>navigate('/instructor/create-exam')}>+ Create Exam</button></div>
        {!exams.length ? <div className="empty-state"><div className="empty-state-icon">📝</div><h3>No exams yet</h3></div> : (
          <div className="table-container"><table>
            <thead><tr><th>Title</th><th>Course</th><th>Start</th><th>End</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{exams.map(e=>{
              const started = new Date(e.startTime)<=now, ended = new Date(e.endTime)<now;
              const status = ended?'Ended':started?'Active':'Upcoming';
              return (<tr key={e._id}>
                <td><strong>{e.title}</strong></td><td>{e.course?.courseCode}</td>
                <td>{new Date(e.startTime).toLocaleString()}</td><td>{new Date(e.endTime).toLocaleString()}</td>
                <td>{e.duration} min</td>
                <td><span className={`badge ${ended?'badge-gray':started?'badge-success':'badge-warning'}`}>{status}</span></td>
                <td style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-sm btn-outline" onClick={()=>navigate(`/instructor/results/${e._id}`)}>Results</button>
                  <button className="btn btn-sm btn-outline" onClick={()=>navigate(`/instructor/analytics/${e._id}`)}>Analytics</button>
                </td>
              </tr>);
            })}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function CreateExam() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ title:'', courseId:'', duration:60, startTime:'', endTime:'', shuffleQuestions:true, shuffleOptions:true, instructions:'' });
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { API.get('/instructor/courses').then(r=>setCourses(r.data)).catch(()=>{}); }, []);

  const addQ = (type) => setQuestions([...questions, { questionText:'', questionType:type, options:type==='mcq'?['','','','']:[], correctAnswer:type==='mcq'?'0':'', marks:1 }]);
  const upQ = (i,f,v) => { const q=[...questions]; q[i]={...q[i],[f]:v}; setQuestions(q); };
  const upO = (qi,oi,v) => { const q=[...questions]; q[qi].options[oi]=v; setQuestions(q); };
  const rmQ = (i) => setQuestions(questions.filter((_,idx)=>idx!==i));

  const submit = async (e) => {
    e.preventDefault();
    if (!questions.length) return toast.error('Add at least one question');
    if (!form.courseId) return toast.error('Select a course');
    setSaving(true);
    try { await API.post('/instructor/exams', { ...form, questions }); toast.success('Exam created!'); navigate('/instructor'); }
    catch (err) { toast.error(err.response?.data?.message||'Error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/instructor')}>← Back</button>
        <h2 style={{ fontSize:20, fontWeight:700 }}>Create Exam</h2>
      </div>
      <form onSubmit={submit}>
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-title" style={{ marginBottom:16 }}>Exam Details</div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Title*</label><input className="form-control" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Course*</label>
              <select className="form-control" required value={form.courseId} onChange={e=>setForm({...form,courseId:e.target.value})}>
                <option value="">Select Course</option>
                {courses.map(c=><option key={c._id} value={c._id}>{c.courseCode} — {c.courseName}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Duration (min)*</label><input className="form-control" type="number" min="5" required value={form.duration} onChange={e=>setForm({...form,duration:parseInt(e.target.value)})} /></div>
            <div></div>
            <div className="form-group"><label className="form-label">Start Date & Time*</label><input className="form-control" type="datetime-local" required value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">End Date & Time*</label><input className="form-control" type="datetime-local" required value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})} /></div>
          </div>
          <div className="form-group"><label className="form-label">Instructions</label><textarea className="form-control" rows="2" value={form.instructions} onChange={e=>setForm({...form,instructions:e.target.value})} /></div>
          <div style={{ display:'flex', gap:24 }}>
            <label style={{ display:'flex', gap:8, fontSize:14, cursor:'pointer' }}><input type="checkbox" checked={form.shuffleQuestions} onChange={e=>setForm({...form,shuffleQuestions:e.target.checked})} /> Shuffle Questions</label>
            <label style={{ display:'flex', gap:8, fontSize:14, cursor:'pointer' }}><input type="checkbox" checked={form.shuffleOptions} onChange={e=>setForm({...form,shuffleOptions:e.target.checked})} /> Shuffle MCQ Options</label>
          </div>
        </div>
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
            <span className="card-title">Questions ({questions.length}) — Total: {questions.reduce((s,q)=>s+(q.marks||1),0)} marks</span>
            <div style={{ display:'flex', gap:8 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={()=>addQ('mcq')}>+ MCQ</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={()=>addQ('short_answer')}>+ Short Answer</button>
            </div>
          </div>
          {questions.length===0 && <div className="empty-state" style={{ padding:30 }}><h3>Add questions above</h3></div>}
          {questions.map((q,i)=>(
            <div key={i} className="question-card" style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontWeight:600, fontSize:13 }}>Q{i+1} — {q.questionType==='mcq'?'🔘 MCQ':'✍️ Short Answer'}</span>
                <button type="button" className="btn btn-sm btn-danger" onClick={()=>rmQ(i)}>Remove</button>
              </div>
              <div className="form-group"><label className="form-label">Question*</label><textarea className="form-control" rows="2" required value={q.questionText} onChange={e=>upQ(i,'questionText',e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Marks</label><input className="form-control" type="number" min="1" value={q.marks} onChange={e=>upQ(i,'marks',parseInt(e.target.value)||1)} style={{ width:80 }} /></div>
              {q.questionType==='mcq' && <>
                <div className="form-label" style={{ marginBottom:8 }}>Options — ● = correct answer</div>
                {q.options.map((opt,oi)=>(
                  <div key={oi} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
                    <input type="radio" name={`c-${i}`} value={String(oi)} checked={q.correctAnswer===String(oi)} onChange={e=>upQ(i,'correctAnswer',e.target.value)} style={{ width:16, height:16 }} />
                    <input className="form-control" required value={opt} onChange={e=>upO(i,oi,e.target.value)} placeholder={`Option ${oi+1}`} />
                  </div>
                ))}
              </>}
              {q.questionType==='short_answer' && (
                <div className="form-group"><label className="form-label">Model Answer (instructor reference)</label><textarea className="form-control" rows="2" value={q.correctAnswer} onChange={e=>upQ(i,'correctAnswer',e.target.value)} /></div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button type="button" className="btn btn-outline" onClick={()=>navigate('/instructor')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Creating...':'✅ Create Exam'}</button>
        </div>
      </form>
    </div>
  );
}

// ✅ FIX #6: ExamResults now actually fetches the full attempt and shows a working grading modal
function ExamResults() {
  const { id } = useParams();
  const [attempts, setAttempts] = useState([]);
  const [examTitle, setExamTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(null);   // full attempt object being graded
  const [grades, setGrades] = useState({});       // { questionId: marksToAward }
  const [loadingGrade, setLoadingGrade] = useState(false);
  const navigate = useNavigate();

  const loadResults = useCallback(async () => {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([
        API.get(`/instructor/exams/${id}/results`),
        API.get(`/instructor/exams/${id}`)
      ]);
      setAttempts(r.data);
      setExamTitle(e.data.title);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (id) loadResults(); }, [id, loadResults]);

  // ✅ FIX #6: Properly load the full attempt with answers for grading
  const openGrade = async (attempt) => {
    if (!attempt.student?.studentId) {
      toast.error('Student ID missing — cannot load paper');
      return;
    }
    setLoadingGrade(true);
    try {
      // Use the instructor's student-paper endpoint to get full attempt with answers
      const r = await API.get(`/instructor/student-paper/${attempt.student.studentId}`);
      const fullAttempt = r.data.attempts?.find(a => a._id === attempt._id);
      if (!fullAttempt) {
        toast.error('Attempt not found');
        return;
      }
      // Pre-fill grades from current marks
      const initial = {};
      fullAttempt.answers?.forEach(a => {
        if (a.questionType === 'short_answer') {
          initial[a.questionId] = a.marksObtained || 0;
        }
      });
      setGrades(initial);
      setGrading(fullAttempt);
    } catch (err) {
      toast.error('Failed to load attempt: ' + (err.response?.data?.message || ''));
    } finally {
      setLoadingGrade(false);
    }
  };

  const submitGrade = async () => {
    try {
      const gradeList = Object.entries(grades).map(([questionId, marksObtained]) => ({
        questionId,
        marksObtained: parseFloat(marksObtained) || 0
      }));
      await API.put(`/instructor/attempts/${grading._id}/grade`, { grades: gradeList });
      toast.success('✅ Graded successfully!');
      setGrading(null);
      setGrades({});
      loadResults();
    } catch (err) {
      toast.error('Grade failed: ' + (err.response?.data?.message || ''));
    }
  };

  if (loading) return <div className="loading-inline"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/instructor')}>← Back</button>
        <h2 style={{ fontSize:20, fontWeight:700 }}>Results: {examTitle}</h2>
      </div>
      <div className="card">
        {!attempts.length ? <div className="empty-state"><div className="empty-state-icon">📭</div><h3>No submissions yet</h3></div> : (
          <div className="table-container"><table>
            <thead><tr><th>Student</th><th>ID</th><th>Program</th><th>Marks</th><th>%</th><th>Grade</th><th>Flags</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{attempts.map(a=>(
              <tr key={a._id}>
                <td>{a.student?.name}</td><td>{a.student?.studentId}</td><td>{a.student?.program||'—'}</td>
                <td>{a.totalMarksObtained}/{a.totalMarks}</td><td>{a.percentage}%</td>
                <td><span className={`badge ${a.percentage>=50?'badge-success':'badge-danger'}`}>{a.grade||'—'}</span></td>
                <td>{a.totalCheatingFlags>0?<span className="badge badge-danger">⚠️{a.totalCheatingFlags}</span>:'—'}</td>
                <td>{a.submittedAt?new Date(a.submittedAt).toLocaleString():'—'}</td>
                <td><span className={`badge ${a.status==='graded'?'badge-success':'badge-warning'}`}>{a.status}</span></td>
                <td>
                  {a.status === 'submitted' ? (
                    <button className="btn btn-sm btn-primary" onClick={()=>openGrade(a)} disabled={loadingGrade}>
                      {loadingGrade ? 'Loading...' : '✏️ Grade'}
                    </button>
                  ) : <span style={{ fontSize:12, color:'#6b7280' }}>—</span>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {/* ✅ FIX #6: Working grading modal */}
      {grading && (
        <div className="modal-overlay" onClick={()=>setGrading(null)}>
          <div className="modal" style={{ maxWidth:760, maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Grade Short Answers — {grading.student?.name}</span>
              <button className="modal-close" onClick={()=>setGrading(null)}>×</button>
            </div>
            <div style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>
              Student ID: {grading.student?.studentId} | Submitted: {new Date(grading.submittedAt).toLocaleString()}
            </div>

            {grading.answers?.filter(a => a.questionType === 'short_answer').length === 0 ? (
              <div className="empty-state">
                <h3>No short answer questions to grade</h3>
                <p>This exam has only MCQs which are auto-graded.</p>
              </div>
            ) : (
              <>
                {grading.answers?.filter(a => a.questionType === 'short_answer').map((a, i) => (
                  <div key={a.questionId} style={{ padding:16, border:'1px solid #e5e7eb', borderRadius:8, marginBottom:12, background:'#f9fafb' }}>
                    <div style={{ fontWeight:600, marginBottom:8 }}>
                      Q{i+1}: {a.questionText}
                      <span style={{ float:'right', fontSize:13, color:'#6b7280' }}>Max: {a.marksTotal} marks</span>
                    </div>
                    <div style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>Student's Answer:</div>
                    <div style={{ background:'#fff', padding:10, borderRadius:6, fontSize:13, minHeight:50, whiteSpace:'pre-wrap', border:'1px solid #e5e7eb', marginBottom:10 }}>
                      {a.writtenAnswer || '(No answer)'}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <label style={{ fontSize:13, fontWeight:500 }}>Marks to award:</label>
                      <input
                        type="number"
                        min="0"
                        max={a.marksTotal}
                        step="0.5"
                        className="form-control"
                        style={{ width:100 }}
                        value={grades[a.questionId] ?? 0}
                        onChange={e => setGrades({ ...grades, [a.questionId]: e.target.value })}
                      />
                      <span style={{ fontSize:13, color:'#6b7280' }}>/ {a.marksTotal}</span>
                    </div>
                  </div>
                ))}
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={()=>setGrading(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={submitGrade}>✅ Submit Grades</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExamAnalytics() {
  const { id } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    if (!id) return;
    API.get(`/instructor/exams/${id}/analytics`).then(r=>setAnalytics(r.data)).catch(()=>toast.error('Failed')).finally(()=>setLoading(false));
  }, [id]);
  if (loading) return <div className="loading-inline"><div className="spinner"></div></div>;
  if (!analytics?.totalAttempts) return (
    <div>
      <button className="btn btn-outline btn-sm" style={{ marginBottom:20 }} onClick={()=>navigate('/instructor')}>← Back</button>
      <div className="empty-state"><div className="empty-state-icon">📊</div><h3>No attempts yet</h3></div>
    </div>
  );
  const gd = analytics.gradeDistribution || {};
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="btn btn-outline btn-sm" onClick={()=>navigate('/instructor')}>← Back</button>
        <h2 style={{ fontSize:20, fontWeight:700 }}>Analytics</h2>
      </div>
      <div className="stats-grid">
        {[{ label:'Attempts', value:analytics.totalAttempts, icon:'👥' },{ label:'Avg Score', value:`${analytics.avgScore}%`, icon:'📊' },{ label:'Highest', value:`${analytics.highestScore}%`, icon:'🏆' },{ label:'Pass Rate', value:`${analytics.passRate}%`, icon:'✅' },{ label:'Cheat Cases', value:analytics.cheatingCases, icon:'🚨' }].map(s=>(
          <div className="stat-card" key={s.label}><div className="stat-icon" style={{ background:'#f3f4f6', fontSize:22 }}>{s.icon}</div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div className="card"><div className="card-title" style={{ marginBottom:16 }}>Grade Distribution</div>
          <Bar data={{ labels:Object.keys(gd), datasets:[{ label:'Students', data:Object.values(gd), backgroundColor:'rgba(26,86,219,0.7)', borderRadius:4 }] }} options={{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, ticks:{stepSize:1}}} }} />
        </div>
        <div className="card"><div className="card-title" style={{ marginBottom:16 }}>Pass vs Fail</div>
          <Doughnut data={{ labels:['Pass','Fail'], datasets:[{ data:[analytics.passRate,100-analytics.passRate], backgroundColor:['#0e9f6e','#e02424'] }] }} />
        </div>
      </div>
    </div>
  );
}

function SearchStudentPaper() {
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState(null);

  const search = async (e) => {
    e.preventDefault(); setLoading(true); setResult(null); setSelectedAttempt(null);
    try {
      const r = await API.get(`/instructor/student-paper/${studentId}`);
      setResult(r.data);
      if (r.data.attempts?.length) setSelectedAttempt(r.data.attempts[0]);
    } catch (err) { toast.error(err.response?.data?.message || 'Not found'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>🔍 View Student Paper</h2>
      <div className="card" style={{ marginBottom:20 }}>
        <form onSubmit={search} style={{ display:'flex', gap:10 }}>
          <input className="form-control" style={{ flex:1 }} value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="Enter Student ID (e.g. BSF2210493)" required />
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Searching...':'Search'}</button>
        </form>
        <div style={{ fontSize:12, color:'#6b7280', marginTop:8 }}>Only shows papers from your own exams.</div>
      </div>
      {result && (
        <>
          <div className="card" style={{ marginBottom:16, background:'#f0f9ff', border:'1px solid #bae6fd' }}>
            <div style={{ fontWeight:700 }}>{result.student?.name}</div>
            <div style={{ fontSize:13, color:'#6b7280' }}>ID: {result.student?.studentId} | {result.student?.program} | Sem {result.student?.semester}</div>
          </div>
          {!result.attempts?.length
            ? <div className="empty-state"><div className="empty-state-icon">📭</div><h3>No submitted papers found for your exams</h3></div>
            : <>
              <div className="form-group">
                <label className="form-label">Select Exam:</label>
                <select className="form-control" onChange={e=>setSelectedAttempt(result.attempts.find(a=>a._id===e.target.value))}>
                  {result.attempts.map(a=>(
                    <option key={a._id} value={a._id}>{a.exam?.title} — {a.exam?.course?.courseCode} — {new Date(a.submittedAt).toLocaleDateString()} — {a.percentage}%</option>
                  ))}
                </select>
              </div>
              {selectedAttempt && <PaperView attempt={selectedAttempt} showHighlights={true} role="instructor" />}
            </>
          }
        </>
      )}
    </div>
  );
}

function AllResults() {
  const [exams, setExams] = useState([]);
  const navigate = useNavigate();
  useEffect(() => { API.get('/instructor/exams').then(r=>setExams(r.data)).catch(()=>{}); }, []);
  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>All Exam Results</h2>
      <div className="card">
        {!exams.length ? <div className="empty-state"><div className="empty-state-icon">📭</div><h3>No exams yet</h3></div>
          : exams.map(e=>(
            <div key={e._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #f3f4f6' }}>
              <div><div style={{ fontWeight:600 }}>{e.title}</div><div style={{ fontSize:12, color:'#6b7280' }}>{e.course?.courseCode}</div></div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-sm btn-outline" onClick={()=>navigate(`/instructor/results/${e._id}`)}>Results</button>
                <button className="btn btn-sm btn-outline" onClick={()=>navigate(`/instructor/analytics/${e._id}`)}>Analytics</button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

export default function InstructorDashboard() {
  const { user } = useAuth();
  return (
    <div className="layout">
      <Sidebar role="instructor" />
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">Instructor Portal</span>
          <div className="topbar-user">
            <div className="user-avatar">{user?.name?.[0]}</div>
            <span style={{ fontSize:14 }}>{user?.name}</span>
          </div>
        </div>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/create-exam" element={<CreateExam />} />
            <Route path="/exams" element={<Overview />} />
            <Route path="/results" element={<AllResults />} />
            <Route path="/results/:id" element={<ExamResults />} />
            <Route path="/analytics/:id" element={<ExamAnalytics />} />
            <Route path="/student-paper" element={<SearchStudentPaper />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
