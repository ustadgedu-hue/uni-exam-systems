import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = {
  admin: [
    { path: '/admin', label: 'Dashboard', icon: '📊', end: true },
    { path: '/admin/users', label: 'Manage Users', icon: '👥' },
    { path: '/admin/courses', label: 'Courses', icon: '📚' },
    { path: '/admin/cheating', label: 'Cheating Reports', icon: '🚨' },
    { path: '/admin/student-paper', label: 'View Student Paper', icon: '📄' },
    { path: '/resources', label: 'Resources', icon: '🗂️' },
  ],
  instructor: [
    { path: '/instructor', label: 'Dashboard', icon: '📊', end: true },
    { path: '/instructor/exams', label: 'My Exams', icon: '📝' },
    { path: '/instructor/create-exam', label: 'Create Exam', icon: '➕' },
    { path: '/instructor/results', label: 'Results', icon: '📈' },
    { path: '/instructor/student-paper', label: 'View Student Paper', icon: '🔍' },
    { path: '/resources', label: 'Resources', icon: '🗂️' },
  ],
  student: [
    { path: '/student', label: 'Dashboard', icon: '🏠', end: true },
    { path: '/resources', label: 'Past Papers & Materials', icon: '📚' },
  ],
};

export default function Sidebar({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems[role] || [];
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h2>🎓 ExamPortal</h2>
        <span style={{ fontSize:11, opacity:0.6, textTransform:'capitalize' }}>{role} Panel</span>
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <NavLink key={item.path} to={item.path} end={item.end}
            className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon">{item.icon}</span> {item.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize:13, opacity:0.7, marginBottom:2 }}>{user?.name}</div>
        <div style={{ fontSize:11, opacity:0.5, marginBottom:4 }}>{user?.program} {user?.semester ? `| Sem ${user.semester}` : ''}</div>
        <div style={{ fontSize:11, opacity:0.4, marginBottom:12 }}>{user?.email}</div>
        <button className="btn btn-outline" style={{ width:'100%', justifyContent:'center', color:'#fff', borderColor:'rgba(255,255,255,0.2)', fontSize:13 }}
          onClick={() => { logout(); navigate('/login'); }}>🚪 Logout</button>
      </div>
    </div>
  );
}
