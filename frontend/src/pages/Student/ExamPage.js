import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../utils/api';
import { toast } from 'react-toastify';

export default function ExamPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [lockedMCQs, setLockedMCQs] = useState({});
  const [skippedQs, setSkippedQs] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cheatingCount, setCheatingCount] = useState(0);
  const [activeWarning, setActiveWarning] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const attemptRef = useRef(null);
  const submittingRef = useRef(false);
  const timerRef = useRef(null);
  const cheatCountRef = useRef({});

  const handleSubmit = useCallback(async (auto = false) => {
    if (submittingRef.current) return;
    if (!auto && !window.confirm('Are you sure you want to submit the exam?')) return;
    submittingRef.current = true; setSubmitting(true);
    clearTimeout(timerRef.current);
    try {
      await API.post(`/exam/attempt/${attemptRef.current._id}/submit`, { autoSubmit: auto });
      toast.success(auto ? '⏰ Time up! Auto-submitted.' : '✅ Submitted successfully!');
      navigate('/student');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submit failed');
      submittingRef.current = false; setSubmitting(false);
    }
  }, [navigate]);

  // Start exam
  useEffect(() => {
    API.post(`/exam/${examId}/start`).then(res => {
      setExam(res.data.exam);
      setAttempt(res.data.attempt);
      attemptRef.current = res.data.attempt;
      if (res.data.attempt.answers?.length) {
        const restored = {}, locked = {}, skipped = {};
        res.data.attempt.answers.forEach(a => {
          // FIX: Only restore real answers, not skipped placeholder text
          if (a.skipped) {
            skipped[a.questionId] = true;
          } else {
            restored[a.questionId] = a.selectedOption ?? a.writtenAnswer ?? '';
            if (a.questionType === 'mcq' && a.selectedOption !== null && a.selectedOption !== undefined) {
              locked[a.questionId] = true;
            }
          }
        });
        setAnswers(restored); setLockedMCQs(locked); setSkippedQs(skipped);
      }
      const examEnd = new Date(res.data.exam.endTime).getTime();
      const durationMs = res.data.exam.duration * 60 * 1000;
      const allowedEnd = Math.min(examEnd, new Date(res.data.attempt.startedAt).getTime() + durationMs);
      setTimeLeft(Math.max(0, Math.floor((allowedEnd - Date.now()) / 1000)));
      setLoading(false);
    }).catch(err => { toast.error(err.response?.data?.message || 'Failed'); navigate('/student'); });
  }, [examId, navigate]);

  // Timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, handleSubmit]);

  // Cheating detection — 2 warnings per question then SKIP
  const logFlag = useCallback(async (type, detail) => {
    const att = attemptRef.current;
    if (!att) return;
    setCheatingCount(c => c + 1);
    await API.post(`/exam/attempt/${att._id}/flag`, { type, detail }).catch(() => {});

    const questions = exam?.questions;
    if (!questions || currentQIndex >= questions.length) return;
    const currentQ = questions[currentQIndex];
    const qid = currentQ._id.toString();

    // FIX: Don't increment skip counter if question already answered/locked
    if (lockedMCQs[qid] || skippedQs[qid]) return;

    cheatCountRef.current[qid] = (cheatCountRef.current[qid] || 0) + 1;
    const count = cheatCountRef.current[qid];

    if (count === 1) {
      setActiveWarning({ questionId: qid, message: `⚠️ Warning 1/2: ${type.replace(/_/g,' ')} detected! One more and this question will be skipped.`, count: 1 });
      toast.warning('⚠️ Warning 1 of 2 — stop or question will be skipped!', { autoClose: 4000 });
    } else if (count === 2) {
      setActiveWarning({ questionId: qid, message: `🚨 Warning 2/2: Question skipped due to cheating!`, count: 2 });
      API.post(`/exam/attempt/${att._id}/skip`, { questionId: qid }).catch(() => {});
      setSkippedQs(prev => ({ ...prev, [qid]: true }));
      toast.error('🚨 Question skipped! Moving to next question...', { autoClose: 3000 });
      setTimeout(() => {
        setCurrentQIndex(i => Math.min(i + 1, (exam?.questions?.length || 1) - 1));
        setActiveWarning(null);
      }, 2000);
    }
  }, [exam, currentQIndex, lockedMCQs, skippedQs]);

  useEffect(() => {
    if (!attempt) return;
    const onVis = () => { if (document.hidden) logFlag('tab_switch', 'Switched tab/minimized'); };
    const onCopy = (e) => { e.preventDefault(); logFlag('copy_paste', 'Copy blocked'); };
    const onPaste = (e) => { e.preventDefault(); logFlag('copy_paste', 'Paste blocked'); };
    const onCtx = (e) => { e.preventDefault(); logFlag('right_click', 'Right-click blocked'); };
    const onBlur = () => logFlag('window_blur', 'Window lost focus');
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['c','v','x','a'].includes(e.key.toLowerCase())) {
        e.preventDefault(); logFlag('keyboard_shortcut', `Ctrl+${e.key.toUpperCase()}`);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onCtx);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onCtx);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, [attempt, logFlag]);

  const saveAnswer = async (questionId, questionType, selectedOption = null, writtenAnswer = null) => {
    if (!attempt || lockedMCQs[questionId] || skippedQs[questionId]) return;
    try {
      await API.post(`/exam/attempt/${attempt._id}/answer`, { questionId, selectedOption, writtenAnswer });
      if (questionType === 'mcq') {
        setLockedMCQs(prev => ({ ...prev, [questionId]: true }));
        toast.success('🔒 Locked', { autoClose: 800, hideProgressBar: true });
      }
    } catch (err) {
      if (err.response?.data?.message?.includes('locked'))
        setLockedMCQs(prev => ({ ...prev, [questionId]: true }));
    }
  };

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  const questions = exam?.questions || [];

  const answeredCount = questions.filter(q => {
    const hasAnswer = answers[q._id] !== undefined && answers[q._id] !== '';
    return hasAnswer || skippedQs[q._id];
  }).length;

  return (
    <div style={{ maxWidth:860, margin:'0 auto', padding:'20px 16px' }}>
      <div className="card" style={{ marginBottom:20, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:17 }}>{exam?.title}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>Marks: {exam?.totalMarks} | Q{currentQIndex+1}/{questions.length} | Answered: {answeredCount}/{questions.length}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:10, color:'#6b7280' }}>TIME LEFT</div>
            <div className={`exam-timer ${timeLeft !== null && timeLeft <= 120 ? 'timer-danger' : ''}`}>{timeLeft !== null ? formatTime(timeLeft) : '--:--'}</div>
          </div>
        </div>
        <div style={{ marginTop:10, height:6, background:'#e5e7eb', borderRadius:4 }}>
          <div style={{ height:'100%', width:`${questions.length ? (answeredCount/questions.length)*100 : 0}%`, background:'#0e9f6e', borderRadius:4, transition:'width 0.3s' }} />
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:12 }}>
          {questions.map((q, i) => {
            const hasAnswer = answers[q._id] !== undefined && answers[q._id] !== '';
            const skipped = skippedQs[q._id];
            const active = i === currentQIndex;
            let bg = '#f3f4f6'; let color = '#374151';
            if (active) { bg = '#1a56db'; color = '#fff'; }
            else if (skipped) { bg = '#fef3c7'; color = '#92400e'; }
            else if (hasAnswer) { bg = '#d1fae5'; color = '#065f46'; }
            return (
              <button key={q._id} onClick={() => setCurrentQIndex(i)}
                style={{ width:32, height:32, borderRadius:6, border:'none', cursor:'pointer', fontWeight:700, fontSize:12, background:bg, color }}>
                {i+1}
              </button>
            );
          })}
        </div>
      </div>

      {activeWarning && (
        <div style={{ padding:'12px 16px', background: activeWarning.count===1?'#fef3c7':'#fee2e2', border:`1px solid ${activeWarning.count===1?'#fde68a':'#fecaca'}`, borderRadius:8, marginBottom:16, fontWeight:600, color: activeWarning.count===1?'#92400e':'#dc2626' }}>
          {activeWarning.message}
        </div>
      )}

      {cheatingCount > 0 && !activeWarning && (
        <div className="cheating-banner">🚨 Total cheating flags: {cheatingCount}. All activity is recorded.</div>
      )}

      {exam?.instructions && currentQIndex === 0 && (
        <div className="alert alert-warning" style={{ marginBottom:16 }}>
          <strong>📋 Instructions:</strong> {exam.instructions}
        </div>
      )}

      <div className="alert" style={{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1e40af', marginBottom:16, fontSize:13 }}>
        ℹ️ MCQ answers are <strong>locked after first selection</strong>. Written answers saved when you click outside.
      </div>

      {questions.length > 0 && (() => {
        const q = questions[currentQIndex];
        const isLocked = lockedMCQs[q._id];
        const isSkipped = skippedQs[q._id];
        const answered = answers[q._id] !== undefined && answers[q._id] !== '';
        return (
          <div className={`question-card ${answered || isSkipped ? 'answered' : ''}`} style={{ minHeight:200 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <span style={{ fontWeight:700, fontSize:16 }}>Question {currentQIndex+1} of {questions.length}</span>
              <span style={{ fontSize:13, color:'#6b7280' }}>[{q.marks} mark{q.marks>1?'s':''}]</span>
            </div>
            <div style={{ fontSize:15, marginBottom:18, lineHeight:1.6 }}>{q.questionText}</div>

            {isSkipped ? (
              <div style={{ padding:16, background:'#fef3c7', borderRadius:8, color:'#92400e', fontWeight:600 }}>
                ⏭️ This question was skipped due to cheating warning.
              </div>
            ) : q.questionType === 'mcq' ? (
              <div>
                {q.options?.map((opt, oi) => (
                  <label key={oi} className={`option-label ${answers[q._id]===String(oi)?'selected':''} ${isLocked?'locked':''}`}>
                    <input type="radio" className="option-radio" name={`q-${q._id}`}
                      value={oi} checked={answers[q._id]===String(oi)}
                      onChange={() => {
                        if (isLocked) { toast.warning('🔒 Locked!'); return; }
                        setAnswers(p=>({...p,[q._id]:String(oi)}));
                        saveAnswer(q._id, 'mcq', String(oi));
                      }} disabled={isLocked} />
                    <span style={{ fontSize:14 }}>{opt}</span>
                    {isLocked && answers[q._id]===String(oi) && <span style={{ marginLeft:'auto', color:'#0e9f6e', fontSize:12, fontWeight:600 }}>🔒 Locked</span>}
                  </label>
                ))}
                {isLocked && <div style={{ fontSize:12, color:'#6b7280', marginTop:6 }}>🔒 Answer locked and saved.</div>}
              </div>
            ) : (
              <textarea className="form-control" rows={6}
                placeholder="Write your answer here... (auto-saved when you click outside)"
                value={answers[q._id]||''}
                onChange={e => setAnswers(p=>({...p,[q._id]:e.target.value}))}
                onBlur={() => saveAnswer(q._id, 'short_answer', null, answers[q._id]||'')}
                style={{ resize:'vertical', fontSize:14 }} />
            )}
          </div>
        );
      })()}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:20 }}>
        <button className="btn btn-outline" onClick={() => setCurrentQIndex(i => Math.max(0, i-1))} disabled={currentQIndex===0}>← Previous</button>
        <button className="btn btn-success" style={{ padding:'10px 28px' }} onClick={() => handleSubmit(false)} disabled={submitting}>
          {submitting ? 'Submitting...' : '✅ Submit Exam'}
        </button>
        <button className="btn btn-outline" onClick={() => setCurrentQIndex(i => Math.min(questions.length-1, i+1))} disabled={currentQIndex===questions.length-1}>Next →</button>
      </div>
    </div>
  );
}
