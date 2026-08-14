import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../../components/Common/Sidebar';
import API from '../../utils/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, formatDate } from '../../utils/datetime';

// ── OVERVIEW (Clean Database button removed) ────────────────────────────────
function Overview() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    API.get('/admin/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) return <div className="loading-inline"><div className="spinner"></div></div>;

  const validRecent = (stats.recentAttempts || []).filter(a =>
    a.student && a.student.name && a.student.name.trim() !== '' &&
    a.exam && a.exam.title
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Admin Dashboard</h2>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Total Students', value: stats.totalStudents, icon: '👨‍🎓', color: '#dbeafe' },
          { label: 'Instructors', value: stats.totalInstructors, icon: '👨‍🏫', color: '#d1fae5' },
          { label: 'Total Exams', value: stats.totalExams, icon: '📝', color: '#fef3c7' },
          { label: 'Total Attempts', value: stats.totalAttempts, icon: '✅', color: '#fce7f3' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ background: s.color }}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">📊 Recent Submissions</span>
          {validRecent.length > 0 && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Last {validRecent.length} submissions
            </span>
          )}
        </div>
        {validRecent.length === 0 ? (
          <div className="empty-state" style={{ padding: 30 }}>
            <div className="empty-state-icon">📭</div>
            <h3>No submissions yet</h3>
            <p style={{ fontSize: 13, color: '#6b7280' }}>
              When students submit exams, they will appear here.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Student</th><th>Exam</th><th>Score</th><th>Date</th></tr>
              </thead>
              <tbody>
                {validRecent.map(a => (
                  <tr key={a._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{a.student.name}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{a.student.studentId || ''}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{a.exam.title}</td>
                    <td>
                      {a.percentage !== undefined && a.percentage !== null ? (
                        <span className={`badge ${a.percentage >= 50 ? 'badge-success' : 'badge-danger'}`}>
                          {a.percentage}%
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>
                      {formatDate(a.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MANAGE USERS (with course search + password show) ───────────────────────
function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [activeProgram, setActiveProgram] = useState('ALL');
  const [semFilter, setSemFilter] = useState('');
  const [searchId, setSearchId] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'student', studentId:'', department:'', semester:'', program:'', enrolledCourses:[] });
  const [filterRole, setFilterRole] = useState('student');
  const [courseSearch, setCourseSearch] = useState('');  // FIX: search bar state
  const [showPassword, setShowPassword] = useState(false);  // FIX: password visibility toggle

  const load = useCallback(async () => {
    const params = {};
    if (filterRole) params.role = filterRole;
    if (activeProgram !== 'ALL') params.program = activeProgram;
    if (semFilter) params.semester = semFilter;
    if (searchId) params.studentId = searchId;
    const [uRes, pRes, cRes] = await Promise.all([
      API.get('/admin/users', { params }),
      API.get('/admin/programs'),
      API.get('/admin/courses')
    ]);
    setUsers(uRes.data);
    setPrograms(pRes.data);
    setCourses(cRes.data);
  }, [filterRole, activeProgram, semFilter, searchId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ name:'', email:'', password:'', role:'student', studentId:'', department:'', semester:'', program:activeProgram !== 'ALL' ? activeProgram : '', enrolledCourses:[] });
    setEditId(null); setCourseSearch(''); setShowPassword(false); setModal(true);
  };
  const openEdit = (u) => {
    setForm({ name:u.name, email:u.email, password:'', role:u.role, studentId:u.studentId||'', department:u.department||'', semester:u.semester||'', program:u.program||'', enrolledCourses:u.enrolledCourses?.map(c=>c._id||c)||[] });
    setEditId(u._id); setCourseSearch(''); setShowPassword(false); setModal(true);
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form };
      if (editId && !data.password) delete data.password;
      if (editId) await API.put(`/admin/users/${editId}`, data);
      else await API.post('/admin/users', data);
      toast.success(editId ? 'User updated' : 'User created'); setModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };
  const del = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await API.delete(`/admin/users/${id}`); toast.success('Deleted'); load();
  };
  const toggle = async (u) => { await API.put(`/admin/users/${u._id}`, { isActive: !u.isActive }); load(); };

  // FIX: Filter courses by search query
  const filteredCourses = courses.filter(c => {
    if (!courseSearch.trim()) return true;
    const q = courseSearch.toLowerCase();
    return c.courseCode.toLowerCase().includes(q) ||
           c.courseName.toLowerCase().includes(q) ||
           (c.program || '').toLowerCase().includes(q);
  });

  const programTabs = ['ALL', ...programs];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700 }}>Manage Users</h2>
        <button className="btn btn-primary" onClick={openCreate}>+ Add User</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['student','instructor','admin'].map(r => (
          <button key={r} className={`btn btn-sm ${filterRole===r?'btn-primary':'btn-outline'}`} onClick={()=>{ setFilterRole(r); setActiveProgram('ALL'); setSemFilter(''); }}>
            {r.charAt(0).toUpperCase()+r.slice(1)}s
          </button>
        ))}
      </div>

      {filterRole === 'student' && (
        <>
          <div className="tabs" style={{ marginBottom:0 }}>
            {programTabs.map(p => (
              <button key={p} className={`tab-btn ${activeProgram===p?'active':''}`} onClick={()=>{ setActiveProgram(p); setSemFilter(''); }}>
                {p}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, padding:'12px 0', background:'#f9fafb', borderBottom:'1px solid #e5e7eb', marginBottom:16 }}>
            <select className="form-control" style={{ width:160 }} value={semFilter} onChange={e=>setSemFilter(e.target.value)}>
              <option value="">All Semesters</option>
              {[1,2,3,4,5,6,7,8].map(s=><option key={s} value={s}>Semester {s}</option>)}
            </select>
            <input className="form-control" style={{ width:220 }} placeholder="🔍 Search by Student ID..." value={searchId} onChange={e=>setSearchId(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={load}>Search</button>
            {searchId && <button className="btn btn-outline btn-sm" onClick={()=>setSearchId('')}>Clear</button>}
          </div>
        </>
      )}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th>
                {filterRole==='student' && <><th>Student ID</th><th>Program</th><th>Semester</th><th>Courses</th></>}
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={9} style={{ textAlign:'center', color:'#6b7280', padding:30 }}>No users found</td></tr>}
              {users.map(u => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong></td>
                  <td style={{ fontSize:12 }}>{u.email}</td>
                  <td><span className={`badge ${u.role==='admin'?'badge-danger':u.role==='instructor'?'badge-info':'badge-success'}`}>{u.role}</span></td>
                  {filterRole==='student' && <>
                    <td><code style={{ fontSize:12 }}>{u.studentId||'—'}</code></td>
                    <td>{u.program||'—'}</td>
                    <td>{u.semester ? `Sem ${u.semester}` : '—'}</td>
                    <td style={{ fontSize:12 }}>{u.enrolledCourses?.map(c=>c.courseCode).join(', ')||'—'}</td>
                  </>}
                  <td><span className={`badge ${u.isActive?'badge-success':'badge-danger'}`}>{u.isActive?'Active':'Inactive'}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-sm btn-outline" onClick={()=>openEdit(u)}>Edit</button>
                      <button className="btn btn-sm btn-outline" onClick={()=>toggle(u)}>{u.isActive?'Disable':'Enable'}</button>
                      <button className="btn btn-sm btn-danger" onClick={()=>del(u._id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={()=>setModal(false)}>
          <div className="modal" style={{ maxWidth:640 }} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editId?'Edit':'Add'} User</span>
              <button className="modal-close" onClick={()=>setModal(false)}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="form-group"><label className="form-label">Full Name*</label><input className="form-control" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Email*</label><input className="form-control" type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>

                {/* FIX: Password with show/hide toggle */}
                <div className="form-group">
                  <label className="form-label">
                    Password{editId?' (blank = unchanged)':' *'}
                  </label>
                  <div style={{ position:'relative' }}>
                    <input
                      className="form-control"
                      type={showPassword ? 'text' : 'password'}
                      required={!editId}
                      value={form.password}
                      onChange={e=>setForm({...form,password:e.target.value})}
                      style={{ paddingRight:60 }}
                      placeholder={editId ? 'Enter new password to change' : 'Min 6 characters'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#3b82f6', fontWeight:600
                      }}
                    >
                      {showPassword ? '🙈 Hide' : '👁️ Show'}
                    </button>
                  </div>
                  {editId && (
                    <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>
                      ℹ️ Admin can set a new password to update this user's password
                    </div>
                  )}
                </div>

                <div className="form-group"><label className="form-label">Role*</label>
                  <select className="form-control" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                    <option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option>
                  </select>
                </div>
                {form.role === 'student' && <>
                  <div className="form-group"><label className="form-label">Student ID <span style={{fontSize:11,color:'#6b7280'}}>(stays same all 8 semesters)</span></label><input className="form-control" value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value})} placeholder="e.g. BSF2210493" /></div>
                  <div className="form-group"><label className="form-label">Program</label><input className="form-control" value={form.program} onChange={e=>setForm({...form,program:e.target.value})} placeholder="e.g. BSCS, BSPhysics, BBA" /></div>
                  <div className="form-group"><label className="form-label">Current Semester</label>
                    <select className="form-control" value={form.semester} onChange={e=>setForm({...form,semester:e.target.value})}>
                      <option value="">Select</option>{[1,2,3,4,5,6,7,8].map(s=><option key={s} value={s}>Semester {s}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Department</label><input className="form-control" value={form.department} onChange={e=>setForm({...form,department:e.target.value})} /></div>
                </>}
              </div>

              {form.role === 'student' && (
                <div className="form-group">
                  <label className="form-label">📚 Assign Courses (manual — any course from any program)</label>

                  {/* FIX: Course search bar */}
                  <div style={{ marginBottom:8 }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="🔍 Search course by code, name, or program (e.g. COMP1112, Programming, BSCS)..."
                      value={courseSearch}
                      onChange={e => setCourseSearch(e.target.value)}
                      style={{ fontSize:13 }}
                    />
                    {courseSearch && (
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>
                        Showing {filteredCourses.length} of {courses.length} courses
                        {' '}
                        <button
                          type="button"
                          onClick={() => setCourseSearch('')}
                          style={{ background:'none', border:'none', color:'#3b82f6', cursor:'pointer', fontSize:11, padding:0 }}
                        >
                          (clear)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Selected courses summary */}
                  {form.enrolledCourses.length > 0 && (
                    <div style={{ background:'#eff6ff', padding:'8px 12px', borderRadius:6, marginBottom:8, fontSize:12 }}>
                      <strong>✅ Selected ({form.enrolledCourses.length}):</strong>{' '}
                      {courses
                        .filter(c => form.enrolledCourses.includes(c._id))
                        .map(c => c.courseCode)
                        .join(', ')}
                    </div>
                  )}

                  <div style={{ maxHeight:250, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:8, padding:12 }}>
                    {courses.length === 0 && <p style={{ color:'#6b7280', fontSize:13 }}>No courses yet. Add courses first.</p>}
                    {courses.length > 0 && filteredCourses.length === 0 && (
                      <p style={{ color:'#6b7280', fontSize:13, textAlign:'center', padding:20 }}>
                        No courses match "{courseSearch}". Try a different search.
                      </p>
                    )}
                    {filteredCourses.map(c => (
                      <label key={c._id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer', marginBottom:6, padding:'4px 6px', borderRadius:4, background: form.enrolledCourses.includes(c._id) ? '#eff6ff' : 'transparent' }}>
                        <input type="checkbox" checked={form.enrolledCourses.includes(c._id)}
                          onChange={e => setForm({...form, enrolledCourses: e.target.checked ? [...form.enrolledCourses,c._id] : form.enrolledCourses.filter(id=>id!==c._id)})} />
                        <strong>{c.courseCode}</strong> — {c.courseName}
                        {c.semester && <span style={{ color:'#6b7280', fontSize:11 }}>(Sem {c.semester} {c.program})</span>}
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>
                    ℹ️ You can assign any course to any student regardless of program or semester.
                  </div>
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editId?'Update':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MANAGE COURSES (unchanged) ────────────────────────────────────────────────
function ManageCourses() {
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ courseCode:'', courseName:'', department:'', semester:'', program:'', instructor:'', creditHours:3 });
  const [editId, setEditId] = useState(null);

  const load = () => {
    API.get('/admin/courses').then(r=>setCourses(r.data));
    API.get('/admin/users?role=instructor').then(r=>setInstructors(r.data));
  };
  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await API.put(`/admin/courses/${editId}`, form);
      else await API.post('/admin/courses', form);
      toast.success('Saved'); setModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700 }}>Manage Courses</h2>
        <button className="btn btn-primary" onClick={()=>{ setForm({ courseCode:'', courseName:'', department:'', semester:'', program:'', instructor:'', creditHours:3 }); setEditId(null); setModal(true); }}>+ Add Course</button>
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Program</th><th>Sem</th><th>Instructor</th><th>Credits</th><th>Actions</th></tr></thead>
            <tbody>
              {courses.map(c=>(
                <tr key={c._id}>
                  <td><strong>{c.courseCode}</strong></td><td>{c.courseName}</td>
                  <td>{c.program||'—'}</td><td>{c.semester||'—'}</td>
                  <td>{c.instructor?.name||'—'}</td><td>{c.creditHours}</td>
                  <td style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-sm btn-outline" onClick={()=>{ setForm({ courseCode:c.courseCode, courseName:c.courseName, department:c.department||'', semester:c.semester||'', program:c.program||'', instructor:c.instructor?._id||'', creditHours:c.creditHours }); setEditId(c._id); setModal(true); }}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={async()=>{ if(window.confirm('Delete?')){ await API.delete(`/admin/courses/${c._id}`); load(); } }}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <div className="modal-overlay" onClick={()=>setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{editId?'Edit':'Add'} Course</span><button className="modal-close" onClick={()=>setModal(false)}>×</button></div>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="form-group"><label className="form-label">Course Code*</label><input className="form-control" required value={form.courseCode} onChange={e=>setForm({...form,courseCode:e.target.value.toUpperCase()})} placeholder="CS301" /></div>
                <div className="form-group"><label className="form-label">Course Name*</label><input className="form-control" required value={form.courseName} onChange={e=>setForm({...form,courseName:e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Program <span style={{fontSize:11,color:'#6b7280'}}>(optional)</span></label><input className="form-control" value={form.program} onChange={e=>setForm({...form,program:e.target.value})} placeholder="BSCS, BSPhysics..." /></div>
                <div className="form-group"><label className="form-label">Semester <span style={{fontSize:11,color:'#6b7280'}}>(optional)</span></label>
                  <select className="form-control" value={form.semester} onChange={e=>setForm({...form,semester:e.target.value})}>
                    <option value="">Not specified</option>{[1,2,3,4,5,6,7,8].map(s=><option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Department</label><input className="form-control" value={form.department} onChange={e=>setForm({...form,department:e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Credit Hours</label><input className="form-control" type="number" min="1" max="4" value={form.creditHours} onChange={e=>setForm({...form,creditHours:parseInt(e.target.value)})} /></div>
                <div className="form-group"><label className="form-label">Instructor</label>
                  <select className="form-control" value={form.instructor} onChange={e=>setForm({...form,instructor:e.target.value})}>
                    <option value="">Select Instructor</option>{instructors.map(i=><option key={i._id} value={i._id}>{i.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={()=>setModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CHEATING REPORTS (unchanged) ──────────────────────────────────────────────
function CheatingReports() {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  useEffect(()=>{ API.get('/admin/cheating-reports').then(r=>setReports(r.data)).catch(()=>{}); }, []);
  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>🚨 Cheating Reports</h2>
      {!reports.length
        ? <div className="empty-state"><div className="empty-state-icon">✅</div><h3>No cheating flags detected</h3></div>
        : <div className="card">
          <div className="table-container"><table>
            <thead><tr><th>Student</th><th>ID</th><th>Program</th><th>Exam</th><th>Course</th><th>Flags</th><th>Submitted</th><th>Detail</th></tr></thead>
            <tbody>{reports.map(r=>(
              <tr key={r._id}>
                <td>{r.student?.name}</td><td>{r.student?.studentId}</td><td>{r.student?.program||'—'}</td>
                <td>{r.exam?.title}</td><td>{r.exam?.course?.courseCode}</td>
                <td><span className="badge badge-danger">⚠️ {r.totalCheatingFlags}</span></td>
                <td>{formatDate(r.submittedAt)}</td>
                <td><button className="btn btn-sm btn-outline" onClick={()=>setSelected(r)}>View</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      }
      {selected && (
        <div className="modal-overlay" onClick={()=>setSelected(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Cheating Detail — {selected.student?.name}</span><button className="modal-close" onClick={()=>setSelected(null)}>×</button></div>
            <p style={{ color:'#6b7280', fontSize:13, marginBottom:16 }}>Student ID: {selected.student?.studentId} | Program: {selected.student?.program} | Total Flags: {selected.totalCheatingFlags}</p>
            {selected.cheatingFlags?.map((f,i)=>(
              <div key={i} style={{ padding:'10px 14px', background:'#fef2f2', borderRadius:8, border:'1px solid #fecaca', fontSize:13, marginBottom:8 }}>
                <strong style={{ color:'#dc2626' }}>#{i+1} {f.type.replace(/_/g,' ').toUpperCase()}</strong>
                <div style={{ color:'#374151', marginTop:3 }}>{f.detail}</div>
                <div style={{ color:'#9ca3af', fontSize:11, marginTop:2 }}>{formatDateTime(f.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── VIEW STUDENT PAPER (unchanged) ────────────────────────────────────────────
function ViewStudentPaper() {
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState(null);

  const search = async (e) => {
    e.preventDefault(); setLoading(true); setResult(null); setSelectedAttempt(null);
    try {
      const r = await API.get(`/admin/student-paper/${studentId}`);
      setResult(r.data);
      if (r.data.attempts?.length) setSelectedAttempt(r.data.attempts[0]);
    } catch (err) { toast.error(err.response?.data?.message || 'Student not found'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>📄 View Student Paper</h2>
      <div className="card" style={{ marginBottom:20 }}>
        <form onSubmit={search} style={{ display:'flex', gap:10 }}>
          <input className="form-control" style={{ flex:1 }} value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="Enter Student ID (e.g. BSF2210493)" required />
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Searching...':'Search'}</button>
        </form>
      </div>

      {result && (
        <>
          <div className="card" style={{ marginBottom:16, background:'#f0f9ff', border:'1px solid #bae6fd' }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>{result.student?.name}</div>
            <div style={{ fontSize:13, color:'#6b7280' }}>
              ID: {result.student?.studentId} | Program: {result.student?.program} | Semester: {result.student?.semester} | {result.student?.email}
            </div>
            <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>
              Enrolled: {result.student?.enrolledCourses?.map(c=>c.courseCode).join(', ')||'—'}
            </div>
          </div>

          {result.attempts?.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">📭</div><h3>No submitted exams found</h3></div>
            : <>
              <div className="form-group">
                <label className="form-label">Select Exam:</label>
                <select className="form-control" onChange={e=>setSelectedAttempt(result.attempts.find(a=>a._id===e.target.value))}>
                  {result.attempts.map(a=>(
                    <option key={a._id} value={a._id}>
                      {a.exam?.title} — {a.exam?.course?.courseCode} — {formatDate(a.submittedAt)} — {a.percentage}% ({a.grade})
                    </option>
                  ))}
                </select>
              </div>

              {selectedAttempt && <PaperView attempt={selectedAttempt} showHighlights={true} role="admin" />}
            </>
          }
        </>
      )}
    </div>
  );
}

// ── SHARED PAPER VIEW (unchanged) ─────────────────────────────────────────────
export function PaperView({ attempt, showHighlights, role }) {
  if (!attempt) return null;
  const { answers, totalMarksObtained, totalMarks, percentage, grade, cheatingFlags, totalCheatingFlags, autoSubmitted } = attempt;
  return (
    <div>
      <div className="card" style={{ marginBottom:16, background: percentage>=50?'#f0fdf4':'#fef2f2', border:`1px solid ${percentage>=50?'#a7f3d0':'#fecaca'}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:18 }}>{attempt.exam?.title}</div>
            <div style={{ fontSize:13, color:'#6b7280' }}>{attempt.exam?.course?.courseCode} — {attempt.exam?.course?.courseName}</div>
            <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>Submitted: {formatDateTime(attempt.submittedAt)} {autoSubmitted && <span className="badge badge-warning" style={{ marginLeft:6 }}>Auto-submitted</span>}</div>
          </div>
          <div style={{ display:'flex', gap:24, textAlign:'center' }}>
            <div><div style={{ fontSize:32, fontWeight:800 }}>{grade||'—'}</div><div style={{ fontSize:12, color:'#6b7280' }}>Grade</div></div>
            <div><div style={{ fontSize:32, fontWeight:800 }}>{totalMarksObtained}/{totalMarks}</div><div style={{ fontSize:12, color:'#6b7280' }}>Marks</div></div>
            <div><div style={{ fontSize:32, fontWeight:800, color: percentage>=50?'#0e9f6e':'#dc2626' }}>{percentage}%</div><div style={{ fontSize:12, color:'#6b7280' }}>Score</div></div>
          </div>
        </div>
      </div>

      {totalCheatingFlags > 0 && (
        <div className="card" style={{ marginBottom:16, background:'#fef2f2', border:'1px solid #fecaca' }}>
          <div style={{ fontWeight:700, color:'#dc2626', marginBottom:10 }}>🚨 Cheating Flags: {totalCheatingFlags}</div>
          {cheatingFlags?.map((f,i)=>(
            <div key={i} style={{ fontSize:13, padding:'6px 0', borderBottom:'1px solid #fecaca' }}>
              <strong>#{i+1}</strong> {f.type.replace(/_/g,' ')} — {f.detail} <span style={{ color:'#9ca3af', fontSize:11 }}>({formatDateTime(f.timestamp)})</span>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>Answer Sheet</h3>
      {answers?.map((a, i) => {
        const correct = a.isCorrect;
        const skipped = a.skipped;
        let borderColor = '#e5e7eb';
        let bg = '#fff';
        if (showHighlights) {
          if (skipped) { borderColor = '#f59e0b'; bg = '#fffbeb'; }
          else if (a.questionType === 'mcq') { borderColor = correct ? '#a7f3d0' : '#fecaca'; bg = correct ? '#f0fdf4' : '#fef2f2'; }
          else { borderColor = '#bfdbfe'; bg = '#eff6ff'; }
        }
        return (
          <div key={i} style={{ marginBottom:12, padding:16, border:`2px solid ${borderColor}`, borderRadius:10, background: bg }}>
            <div style={{ fontWeight:600, marginBottom:8, fontSize:14 }}>
              Q{i+1}: {a.questionText}
              <span style={{ float:'right', fontWeight:400, color:'#6b7280', fontSize:13 }}>{a.marksObtained}/{a.marksTotal} marks</span>
            </div>
            {skipped
              ? <div style={{ color:'#f59e0b', fontSize:13 }}>⏭️ Question was skipped (cheating warning triggered)</div>
              : a.questionType === 'mcq'
                ? <div style={{ fontSize:13 }}>
                    {a.selectedOption !== null && a.selectedOption !== undefined && a.selectedOption !== ''
                      ? <>{correct ? '✅' : '❌'} Selected: Option {parseInt(a.selectedOption)+1} — {correct ? 'Correct' : 'Incorrect'}</>
                      : <span style={{ color:'#9ca3af' }}>Not answered</span>
                    }
                  </div>
                : <div>
                  <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>Written Answer:</div>
                  <div style={{ background:'#f9fafb', padding:10, borderRadius:6, fontSize:13, minHeight:40, whiteSpace:'pre-wrap' }}>{a.writtenAnswer||'(No answer)'}</div>
                  {role !== 'student' && <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>Marks awarded: {a.marksObtained}/{a.marksTotal}</div>}
                </div>
            }
          </div>
        );
      })}
    </div>
  );
}

// ── MAIN LAYOUT ───────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  return (
    <div className="layout">
      <Sidebar role="admin" />
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">Admin Portal</span>
          <div className="topbar-user">
            <div className="user-avatar">{user?.name?.[0]}</div>
            <span style={{ fontSize:14 }}>{user?.name}</span>
          </div>
        </div>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/users" element={<ManageUsers />} />
            <Route path="/courses" element={<ManageCourses />} />
            <Route path="/cheating" element={<CheatingReports />} />
            <Route path="/student-paper" element={<ViewStudentPaper />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
