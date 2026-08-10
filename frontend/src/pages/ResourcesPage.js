import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Common/Sidebar';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;   // backend ki limit ke barabar

export default function ResourcesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('past_paper');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [courses, setCourses] = useState([]);
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', type: 'past_paper', courseId: '', year: '', semester: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const canUpload = user?.role === 'instructor' || user?.role === 'admin';

  useEffect(() => {
    search();
    if (canUpload) {
      const endpoint = user.role === 'admin' ? '/admin/courses' : '/instructor/courses';
      API.get(endpoint).then(r => setCourses(r.data)).catch(() => {});
    }
    // eslint-disable-next-line
  }, [tab]);

  const search = async () => {
    setLoading(true);
    try {
      const r = await API.get(`/resources/search?query=${encodeURIComponent(query)}&type=${tab}`);
      setResults(r.data);
    } catch (err) {
      toast.error('Search failed');
    } finally { setLoading(false); }
  };

  const handleSearch = (e) => { e.preventDefault(); search(); };

  // Backend ab file stream nahi karta — sirf Cloudinary ka URL deta hai.
  // downloadCount bhi wahin barhta hai.
  const download = async (id, fileName) => {
    try {
      const r = await API.get(`/resources/${id}/download`);
      const a = document.createElement('a');
      a.href = r.data.url;
      a.download = r.data.fileName || fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { toast.error('Download failed'); }
  };

  // Upload 3 qadam mein: signature lo → file seedha Cloudinary bhejo →
  // metadata backend ko do. File backend se hoti hui nahi jati, isliye
  // Vercel ki 4.5MB request limit aari nahi aati (20MB tak chalta hai).
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    if (file.size > MAX_UPLOAD_BYTES) return toast.error('File is larger than the 20MB limit');

    setUploading(true);
    try {
      // Qadam 1 — backend se signed upload permission lo
      const { data: sig } = await API.post('/resources/signature', { fileName: file.name });

      // Qadam 2 — file seedha Cloudinary pe bhejo
      const cloudForm = new FormData();
      cloudForm.append('file', file);
      cloudForm.append('api_key', sig.apiKey);
      cloudForm.append('timestamp', sig.timestamp);
      cloudForm.append('signature', sig.signature);
      cloudForm.append('folder', sig.folder);
      cloudForm.append('public_id', sig.publicId);
      // 'private' — file ka aam CDN link kaam nahi karega, sirf backend ka
      // banaya hua signed link chalega
      cloudForm.append('type', sig.deliveryType);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`,
        { method: 'POST', body: cloudForm }
      );
      if (!cloudRes.ok) {
        const errBody = await cloudRes.json().catch(() => ({}));
        throw new Error(errBody.error?.message || 'Cloudinary upload failed');
      }
      const cloudData = await cloudRes.json();

      // Qadam 3 — backend ko batao. Wo Cloudinary se khud tasdeeq karega.
      // cloudinaryPublicId isliye bhejte hain kyunki Cloudinary 'raw' files
      // ke public_id ke aakhir mein extension khud laga deta hai.
      await API.post('/resources/upload', {
        ...uploadForm,
        publicId: sig.publicId,
        cloudinaryPublicId: cloudData.public_id,
        fileName: file.name
      });

      toast.success('Uploaded successfully!');
      setUploadModal(false);
      setFile(null);
      setUploadForm({ title: '', description: '', type: tab, courseId: '', year: '', semester: '' });
      search();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const deleteResource = async (id) => {
    if (!window.confirm('Delete this resource?')) return;
    try { await API.delete(`/resources/${id}`); toast.success('Deleted'); search(); }
    catch { toast.error('Delete failed'); }
  };

  const getFileIcon = (type) => {
    if (type === 'pdf') return '📄';
    if (['jpg','jpeg','png'].includes(type)) return '🖼️';
    return '📎';
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1048576).toFixed(1)} MB`;
  };

  // ✅ FIX #7: uploadedBy comes back as a populated object {_id, name}, not a string
  const isMyResource = (r) => {
    if (!r.uploadedBy || !user?._id) return false;
    const uploaderId = typeof r.uploadedBy === 'object' ? r.uploadedBy._id : r.uploadedBy;
    return String(uploaderId) === String(user._id);
  };

  return (
    <div className="layout">
      <Sidebar role={user?.role} />
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">📚 Resources Library</span>
          <div className="topbar-user">
            <div className="user-avatar">{user?.name?.[0]}</div>
            <span style={{ fontSize: 14 }}>{user?.name}</span>
          </div>
        </div>
        <div className="page-content">

          <div className="tabs">
            <button className={`tab-btn ${tab === 'past_paper' ? 'active' : ''}`} onClick={() => { setTab('past_paper'); setResults([]); }}>📄 Past Papers</button>
            <button className={`tab-btn ${tab === 'course_material' ? 'active' : ''}`} onClick={() => { setTab('course_material'); setResults([]); }}>📘 Course Materials</button>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10 }}>
              <input className="form-control" style={{ flex: 1 }} placeholder="Search by course code or name (e.g. CS301, Data Structures)..."
                value={query} onChange={e => setQuery(e.target.value)} />
              <button type="submit" className="btn btn-primary">🔍 Search</button>
              {canUpload && (
                <button type="button" className="btn btn-success" onClick={() => { setUploadForm(f => ({ ...f, type: tab })); setUploadModal(true); }}>
                  ⬆️ Upload
                </button>
              )}
            </form>
          </div>

          {loading
            ? <div className="loading-inline"><div className="spinner"></div></div>
            : results.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">{tab === 'past_paper' ? '📄' : '📘'}</div><h3>No {tab === 'past_paper' ? 'past papers' : 'materials'} found</h3><p>Try a different search or ask your instructor to upload.</p></div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {results.map(r => (
                  <div key={r._id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 36 }}>{getFileIcon(r.fileType)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{r.courseCode} — {r.courseName}</div>
                      </div>
                    </div>
                    {r.description && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{r.description}</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                      {r.year && <span>📅 {r.year}</span>}
                      {r.semester && <span>| {r.semester}</span>}
                      <span>| {r.fileType?.toUpperCase()}</span>
                      {r.fileSize && <span>| {formatSize(r.fileSize)}</span>}
                      <span>| ⬇️ {r.downloadCount} downloads</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                      <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => download(r._id, r.fileName)}>⬇️ Download</button>
                      {/* ✅ FIX #7: Use the helper that handles populated objects */}
                      {(canUpload && (isMyResource(r) || user?.role === 'admin')) && (
                        <button className="btn btn-danger btn-sm" onClick={() => deleteResource(r._id)}>🗑️</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {uploadModal && (
        <div className="modal-overlay" onClick={() => setUploadModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Upload {tab === 'past_paper' ? 'Past Paper' : 'Course Material'}</span>
              <button className="modal-close" onClick={() => setUploadModal(false)}>×</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="form-group"><label className="form-label">Title*</label>
                <input className="form-control" required value={uploadForm.title} onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })} placeholder="e.g. CS301 Final Exam 2023" /></div>
              <div className="form-group"><label className="form-label">Course*</label>
                <select className="form-control" required value={uploadForm.courseId} onChange={e => setUploadForm({ ...uploadForm, courseId: e.target.value })}>
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c._id} value={c._id}>{c.courseCode} — {c.courseName}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Description</label>
                <textarea className="form-control" rows="2" value={uploadForm.description} onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })} /></div>
              {tab === 'past_paper' && (
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Year</label>
                    <input className="form-control" type="number" value={uploadForm.year} onChange={e => setUploadForm({ ...uploadForm, year: e.target.value })} placeholder="2023" /></div>
                  <div className="form-group"><label className="form-label">Semester</label>
                    <select className="form-control" value={uploadForm.semester} onChange={e => setUploadForm({ ...uploadForm, semester: e.target.value })}>
                      <option value="">Select</option><option>Spring</option><option>Fall</option><option>Summer</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="form-group"><label className="form-label">File* (PDF, JPG, PNG — max 20MB)</label>
                <input type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png" required onChange={e => setFile(e.target.files[0])} /></div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setUploadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
