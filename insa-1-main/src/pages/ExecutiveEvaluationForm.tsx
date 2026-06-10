import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, runTransaction, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { useParams, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

export default function ExecutiveEvaluationForm() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  const [assignment, setAssignment] = useState<any>(null);
  const [evaluateeName, setEvaluateeName] = useState('');
  const [scale, setScale] = useState(5);
  const [exec_items, setItems] = useState<any[]>([]);
  
  // State for form data
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog states
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (msg: string) => {
    setAlertMessage(msg);
    setAlertModalOpen(true);
  };

  useEffect(() => {
    if (assignmentId) fetchData();
  }, [assignmentId]);

  const fetchData = async () => {
    try {
      // 1. Fetch assignment
      if (!assignmentId) return;
      const assnDoc = await getDoc(doc(db, 'exec_assignments', assignmentId));
      if (!assnDoc.exists()) throw new Error('평가 대상을 찾을 수 없습니다.');
      const assn = { id: assnDoc.id, ...assnDoc.data() } as any;
      setAssignment(assn);
      
      // 2. Fetch Evaluatee Info
      const userDoc = await getDoc(doc(db, 'users', assn.evaluateeId));
      if (userDoc.exists()) setEvaluateeName(userDoc.data().name);

      // 3. Fetch Settings for scale
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      let currentScale = 5;
      if (settingsDoc.exists()) {
        currentScale = settingsDoc.data().scoringScale || 5;
        setScale(currentScale);
      }

      // 4. Fetch Items for this year and group
      // Fetching by groupId avoids the need for a composite Firestore index
      const q = query(
        collection(db, 'exec_items'),
        where('groupId', '==', assn.groupId)
      );
      const snap = await getDocs(q);
      let fetchedItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Filter by year in memory
      fetchedItems = fetchedItems.filter(item => item.year === assn.year);
      fetchedItems.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setItems(fetchedItems);

      // 5. If already completed, fetch result
      if (assn.status === 'completed') {
        setIsCompleted(true);
        const resultDoc = await getDoc(doc(db, 'exec_results', assignmentId));
        if (resultDoc.exists()) {
          setScores(resultDoc.data().scores || {});
          setComment(resultDoc.data().comment || '');
        }
      }

    } catch (err) {
      logger.error(err);
      alert('Failed to load evaluation data.');
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (itemId: string, val: number) => {
    if (isCompleted) return;
    setScores(prev => ({ ...prev, [itemId]: val }));
  };

  const handleSubmitClick = () => {
    if (!assignmentId) return;
    if (Object.keys(scores).length < exec_items.length) {
      return showAlert('모든 문항에 대해 점수를 부여해 주세요.');
    }
    setConfirmModalOpen(true);
  };

  const executeSubmit = async () => {
    setConfirmModalOpen(false);
    if (!assignmentId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const totalScore = Object.values(scores).reduce((a, b) => Number(a) + Number(b), 0);
      const resultRef = doc(db, 'exec_results', assignmentId);
      const assignmentRef = doc(db, 'exec_assignments', assignmentId);

      await runTransaction(db, async (tx) => {
        const assnSnap = await tx.get(assignmentRef);
        if (assnSnap.data()?.status === 'completed') {
          throw new Error('이미 제출된 평가입니다.');
        }
        tx.set(resultRef, { assignmentId, scores, comment, submittedAt: serverTimestamp() });
        tx.set(assignmentRef, { status: 'completed', totalScore }, { merge: true });
      });

      showAlert('평가가 성공적으로 제출되었습니다!');
      setTimeout(() => { navigate('/evaluate-executive'); }, 1500);
    } catch (error: any) {
      logger.error("Submission error:", error);
      showAlert(error.message === '이미 제출된 평가입니다.' ? error.message : '평가 제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      setIsSubmitting(false);
    }
  };

  if (loading) return <div>평가 양식을 불러오는 중입니다...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <header className="flex justify-between items-end mb-12 border-b border-[#1A1A1A] pb-6">
        <div>
          <div className="flex items-center gap-4 mb-4">
             <button 
                onClick={() => navigate('/evaluate-executive')} 
                className="text-[10px] uppercase tracking-widest text-[#777] hover:text-[#1A1A1A] underline underline-offset-4"
             >
                목록으로 돌아가기
             </button>
          </div>
          <h2 className="text-5xl tracking-tighter">평가 대상: {evaluateeName}</h2>
          <p className="mt-2 text-sm text-[#555] uppercase tracking-[0.2em] text-[10px]">
            {scale}점 척도 다면 평가 {isCompleted && <span className="text-emerald-700 font-bold tracking-widest">(완료/제출됨)</span>}
          </p>
        </div>
      </header>

      <div className="space-y-12">
        <div className="border border-[#1A1A1A] p-10 space-y-10 bg-[#FDFDFB]">
          {exec_items.map((item, index) => (
            <div key={item.id} className="space-y-4 pb-10 border-b border-[#EEE] last:border-b-0 last:pb-0">
              <p className=" text-lg leading-relaxed text-[#1A1A1A]">
                <span className="text-[10px] uppercase tracking-widest text-[#999] block mb-2">{String(index + 1).padStart(2, '0')}.</span>
                {item.question}
              </p>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: scale }, (_, i) => i + 1).map(num => (
                  <button
                    key={num}
                    disabled={isCompleted}
                    onClick={() => handleScoreChange(item.id, num)}
                    className={`h-12 w-12 flex items-center justify-center font-sans tracking-widest transition-colors ${
                      scores[item.id] === num 
                        ? 'bg-[#1A1A1A] text-white border border-[#1A1A1A]'
                        : 'bg-transparent text-[#777] border border-[#CCC] hover:border-[#1A1A1A] hover:text-[#1A1A1A] disabled:opacity-50 disabled:hover:border-[#CCC]'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-4 pt-10">
            <p className="text-[10px] uppercase tracking-widest text-[#999]">정성 평가 의견 (선택사항)</p>
            <textarea
              placeholder="평가 대상자에 대한 추가적인 의견이나 맥락을 작성해주세요..."
              rows={5}
              maxLength={2000}
              value={comment}
              onChange={e => setComment(e.target.value)}
              disabled={isCompleted}
              className="w-full bg-[#F9F9F9] border border-[#E5E5E5] p-4 text-sm outline-none focus:border-[#1A1A1A] placeholder-[#AAA] resize-none"
            />
          </div>

          {!isCompleted && (
            <div className="flex justify-end pt-10">
              <button 
                onClick={handleSubmitClick} 
                className="px-8 py-3 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-[0.2em] hover:bg-[#333] transition-colors"
                type="button"
              >
                최종 제출하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="max-w-md border-[#1A1A1A] rounded-none bg-[#FDFDFB] p-0">
          <DialogHeader className="p-6 border-b border-[#E5E5E5] bg-[#F9F9F9]">
            <DialogTitle className="text-xl font-normal leading-none text-[#1A1A1A]">
              평가 제출 확인
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 text-sm text-[#333] leading-relaxed">
            한번 평가하면 규칙상 수정할 수 없습니다. 신중하게 평가하세요.<br/>
            이대로 제출하시겠습니까?
          </div>
          <div className="flex justify-end gap-3 p-6 bg-[#F9F9F9] border-t border-[#E5E5E5]">
            <button 
              className="px-5 py-2 border border-[#CCC] text-[11px] uppercase tracking-widest hover:border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
              onClick={() => setConfirmModalOpen(false)}
            >
              취소
            </button>
            <button
              className="px-5 py-2 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={executeSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? '제출 중...' : '제출하기'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <Dialog open={alertModalOpen} onOpenChange={setAlertModalOpen}>
        <DialogContent className="max-w-md border-[#1A1A1A] rounded-none bg-[#FDFDFB] p-0">
          <DialogHeader className="p-6 border-b border-[#E5E5E5] bg-[#F9F9F9]">
            <DialogTitle className="text-xl font-normal leading-none text-[#1A1A1A]">
              알림
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 text-sm text-[#333] leading-relaxed whitespace-pre-wrap">
            {alertMessage}
          </div>
          <div className="flex justify-end p-6 bg-[#F9F9F9] border-t border-[#E5E5E5]">
            <button 
              className="px-5 py-2 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest hover:bg-[#333] transition-colors"
              onClick={() => setAlertModalOpen(false)}
            >
              확인
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
