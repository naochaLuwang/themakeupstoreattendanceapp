'use client'
import {runOperation} from '@/lib/store-ops/client-action';
import {prepareImage} from '@/lib/store-ops/image-compression'

import StoreImage from '@/components/store-ops/StoreImage'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Camera, Loader2, ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { submitAuditAnswer, completeAudit, uploadAuditImage } from '@/app/actions/store-ops/audits'
import type { AuditWithRelations } from '@/lib/store-ops/types'

interface AuditRunnerProps {
  audit: AuditWithRelations
}

export default function AuditRunner({ audit }: AuditRunnerProps) {
  const router = useRouter()
  const isCompleted = audit.status === 'completed'

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, { score: number; comment: string; photoUrl: string | null }>>(
    () => {
      const initial: Record<string, {score:number;comment:string;photoUrl:string|null}> = {}
      for (const a of audit.audit_answers) {
        initial[a.question_id] = {
          score: a.score || 0,
          comment: a.comment || '',
          photoUrl: a.photo_url || null,
        }
      }
      return initial
    }
  )
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null)

  const questions = audit.audit_answers.map(a => ({
    answerId: a.id,
    questionId: a.question_id,
    question: a.audit_questions?.question || '',
    maxScore: a.audit_questions?.max_score || 5,
  }))

  const currentQ = questions[currentIndex]
  const currentAnswer = currentQ ? answers[currentQ.questionId] : null
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0
  const answeredCount = Object.values(answers).filter(a => a.score > 0).length
  const totalScore = Object.values(answers).reduce((sum, a) => sum + a.score, 0)
  const totalMax = questions.reduce((sum, q) => sum + q.maxScore, 0)

  const handleScoreChange = (questionId: string, score: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], score: Math.min(score, questions.find(q => q.questionId === questionId)?.maxScore || 5) },
    }))
  }

  const handleCommentChange = (questionId: string, comment: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], comment },
    }))
  }

  const handlePhotoUpload = async (questionId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setUploadingPhoto(questionId)
      try {
      const formData = new FormData()
      const prepared=await prepareImage(file)
      formData.append('file', prepared.file)
      formData.append('thumbnail', prepared.thumbnail)

      const result = await runOperation(() => uploadAuditImage(formData))
      if (result.success && result.url) {
        setAnswers(prev => ({
          ...prev,
          [questionId]: { ...prev[questionId], photoUrl: result.url },
        }))
        toast.success('Photo uploaded')
      } else {
        toast.error(result.error || 'Upload failed')
      }
      } catch(cause) { toast.error(cause instanceof Error?cause.message:'Photo upload failed.') } finally {setUploadingPhoto(null)}
    }
    input.click()
  }

  const saveCurrentAnswer = async () => {
    if (!currentQ || !currentAnswer) return
    const result = await runOperation(() => submitAuditAnswer(
      audit.id,
      currentQ.questionId,
      currentAnswer.score,
      currentAnswer.comment || undefined,
      currentAnswer.photoUrl || undefined
    ))
    if (result.error) { toast.error(result.error); return false }
    return true
  }

  const goNext = async () => {
    if (!await saveCurrentAnswer()) return
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1)
    }
  }

  const goPrev = async () => {
    if (!await saveCurrentAnswer()) return
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
    }
  }

  const handleComplete = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      for (const q of questions) {
        const ans=answers[q.questionId]
        if (!ans) throw new Error('Answer every question first.')
        const saved=await runOperation(() => submitAuditAnswer(audit.id,q.questionId,ans.score,ans.comment||undefined,ans.photoUrl||undefined))
        if(saved.error)throw new Error(saved.error)
      }
      const result = await runOperation(() => completeAudit(audit.id))
      if (result.error) {
        toast.error(result.error)
      } else {
        const pct = result.data && result.data.max_score && result.data.max_score > 0
          ? Math.round((result.data.final_score / result.data.max_score) * 100)
          : 0
        toast.success(`Audit completed! Score: ${pct}%`)
        router.refresh()
      }
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Audit could not be completed.') } finally {
      setSubmitting(false)
    }
  }

  if (isCompleted) {
    const pct = audit.final_score !== null && audit.max_score && audit.max_score > 0
      ? Math.round((audit.final_score / audit.max_score) * 100)
      : 0

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <ClipboardCheck size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase">Audit Complete</h2>
          <div className="text-5xl font-black text-slate-900">{pct}%</div>
          <p className="text-sm font-bold text-slate-500">{audit.final_score} / {audit.max_score} points</p>

          <div className="max-w-xs mx-auto bg-slate-50 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Passing</p>
              <p className="text-2xl font-black text-emerald-600">{pct >= 70 ? 'Yes' : 'No'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Questions</p>
              <p className="text-2xl font-black text-slate-900">{questions.length}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {audit.audit_answers.map((a) => {
            const qScore = a.score || 0
            const qMax = a.audit_questions?.max_score || 5
            return (
              <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900">{a.audit_questions?.question}</p>
                    {a.comment && <p className="text-[10px] font-bold text-slate-500 mt-1">{a.comment}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-lg font-black text-slate-900">{qScore}/{qMax}</span>
                  </div>
                </div>
                {a.photo_url && (
                  <StoreImage src={a.photo_url} alt="" className="mt-3 w-24 h-24 rounded-xl object-cover bg-slate-100" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase">{audit.audit_templates?.name}</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-slate-900">{answeredCount}/{questions.length}</span>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Answered</p>
          </div>
        </div>

        <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-slate-900 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex gap-1 mt-3">
          {questions.map((q, i) => {
            const ans = answers[q.questionId]
            const isFilled = ans && ans.score > 0
            return (
              <button
                key={q.questionId}
                onClick={() => setCurrentIndex(i)}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  i === currentIndex ? 'bg-slate-900' : isFilled ? 'bg-emerald-400' : 'bg-slate-200'
                }`}
              />
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {currentQ && currentAnswer && (
          <motion.div
            key={currentQ.questionId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
            className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  Question {currentIndex + 1}
                </span>
                <span className="text-[8px] font-bold text-slate-300">—</span>
                <span className="text-[8px] font-bold text-slate-400">
                  Max score: {currentQ.maxScore}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900">{currentQ.question}</h3>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Score (0-{currentQ.maxScore})
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max={currentQ.maxScore}
                  value={currentAnswer.score}
                  onChange={(e) => handleScoreChange(currentQ.questionId, parseInt(e.target.value))}
                  className="flex-1 accent-slate-900"
                />
                <span className="text-2xl font-black text-slate-900 w-12 text-right tabular-nums">
                  {currentAnswer.score}
                </span>
              </div>
              <div className="flex justify-between text-[8px] font-bold text-slate-400">
                <span>0</span>
                <span>{currentQ.maxScore}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Comment</label>
              <textarea
                value={currentAnswer.comment}
                onChange={(e) => handleCommentChange(currentQ.questionId, e.target.value)}
                placeholder="Add notes or observations..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/20 transition-all resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Photo</label>
              {currentAnswer.photoUrl ? (
                <div className="relative w-28 aspect-square rounded-xl overflow-hidden bg-slate-100">
                  <StoreImage src={currentAnswer.photoUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setAnswers(prev => ({
                      ...prev,
                      [currentQ.questionId]: { ...prev[currentQ.questionId], photoUrl: null },
                    }))}
                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white text-[8px]"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePhotoUpload(currentQ.questionId)}
                  disabled={uploadingPhoto === currentQ.questionId}
                  className="flex items-center gap-2 px-4 py-3 border border-dashed border-slate-300 rounded-xl text-[10px] font-bold text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-all disabled:opacity-50"
                >
                  {uploadingPhoto === currentQ.questionId ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Camera size={14} />
                  )}
                  {uploadingPhoto === currentQ.questionId ? 'Uploading...' : 'Take Photo'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
        >
          <ChevronLeft size={14} /> Previous
        </button>

        {currentIndex < questions.length - 1 ? (
          <button
            onClick={goNext}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {submitting ? 'Completing...' : `Complete Audit (${totalScore}/${totalMax})`}
          </button>
        )}
      </div>
    </div>
  )
}
