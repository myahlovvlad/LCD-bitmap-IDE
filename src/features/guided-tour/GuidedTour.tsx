import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, ChevronRight, X } from 'lucide-react';
import { useProjectStore } from '../../renderer/store/projectStore';
import type { LanguageCode } from '../../renderer/types/domain';
import type { TourStep, StoreSnapshot } from './tourScenarios';

interface GuidedTourProps {
  steps: TourStep[];
  language: LanguageCode;
  onClose: () => void;
}

const LABELS = {
  en: { check: 'Check & Next', next: 'Next', finish: 'Finish tour', skip: 'Skip step', stepOf: 'of', failed: 'Not yet — try again.', close: 'Close tour' },
  ru: { check: 'Проверить и далее', next: 'Далее', finish: 'Завершить', skip: 'Пропустить', stepOf: 'из', failed: 'Ещё нет — попробуйте ещё раз.', close: 'Закрыть' },
  zh: { check: '检查并继续', next: '下一步', finish: '完成向导', skip: '跳过', stepOf: '/', failed: '尚未完成，请再试一次。', close: '关闭向导' }
};

export function GuidedTour({ steps, language, onClose }: GuidedTourProps): React.ReactElement {
  const [stepIndex, setStepIndex] = useState(0);
  const [verifyFailed, setVerifyFailed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const l = LABELS[language] ?? LABELS.en;

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const buildSnapshot = useCallback((): StoreSnapshot => {
    const state = useProjectStore.getState();
    return {
      project: state.project ? {
        fsm: {
          stateOrder: state.project.fsm.stateOrder,
          states: Object.fromEntries(
            Object.entries(state.project.fsm.states).map(([id, st]) => [id, { initial: st.initial, screenId: st.screenId, title: st.title }])
          ),
          transitionOrder: state.project.fsm.transitionOrder,
          events: state.project.fsm.events
        },
        screenOrder: state.project.screenOrder,
        screens: Object.fromEntries(
          Object.entries(state.project.screens).map(([id, sc]) => [id, { objects: sc.objects.map((o) => ({ type: o.type })) }])
        )
      } : null,
      selectedStateId: state.selectedStateId,
      language
    };
  }, [language]);

  const checkVerify = useCallback((): boolean => {
    if (!step?.verify) return true;
    return step.verify(buildSnapshot());
  }, [step, buildSnapshot]);

  const advance = useCallback((): void => {
    if (isLast) {
      setCompleted(true);
      return;
    }
    setStepIndex((i) => i + 1);
    setVerifyFailed(false);
    setTargetRect(null);
  }, [isLast]);

  const handleCheckNext = (): void => {
    if (checkVerify()) {
      advance();
    } else {
      setVerifyFailed(true);
    }
  };

  // Poll for target element to spotlight it
  useEffect(() => {
    if (!step?.targetTestId) {
      setTargetRect(null);
      return;
    }
    const poll = (): void => {
      const el = document.querySelector(`[data-testid="${step.targetTestId}"]`);
      setTargetRect(el ? el.getBoundingClientRect() : null);
    };
    poll();
    pollingRef.current = setInterval(poll, 300);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [step?.targetTestId]);

  // Auto-advance when verify passes (poll every 500ms)
  useEffect(() => {
    if (!step?.verify) return;
    const interval = setInterval(() => {
      if (checkVerify()) {
        clearInterval(interval);
        setVerifyFailed(false);
        advance();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [step, checkVerify, advance]);

  if (completed) {
    return (
      <div className="guided-tour-panel">
        <div className="guided-tour-header">
          <CheckCircle size={18} className="tour-check-icon" />
          <span>{l.finish}</span>
          <button type="button" className="guided-tour-close" onClick={onClose} aria-label={l.close}><X size={15} /></button>
        </div>
        <p className="guided-tour-body">{steps[steps.length - 1]?.body[language]}</p>
        <button type="button" className="guided-tour-btn-primary" onClick={onClose}>{l.finish}</button>
      </div>
    );
  }

  return (
    <>
      {targetRect ? (
        <div
          className="guided-tour-spotlight"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12
          }}
          aria-hidden="true"
        />
      ) : null}
      <div className="guided-tour-panel" role="dialog" aria-modal="false" aria-label="Guided tour">
        <div className="guided-tour-header">
          <span className="guided-tour-progress">{stepIndex + 1} {l.stepOf} {steps.length}</span>
          <button type="button" className="guided-tour-close" onClick={onClose} aria-label={l.close}><X size={15} /></button>
        </div>
        <div className="guided-tour-step-dots">
          {steps.map((_, i) => (
            <div key={i} className={`guided-tour-dot${i < stepIndex ? ' done' : ''}${i === stepIndex ? ' active' : ''}`} />
          ))}
        </div>
        <h3 className="guided-tour-title">{step?.title[language]}</h3>
        <p className="guided-tour-body">{step?.body[language]}</p>
        {verifyFailed && step?.hint ? (
          <p className="guided-tour-hint">{step.hint[language]}</p>
        ) : verifyFailed ? (
          <p className="guided-tour-hint">{l.failed}</p>
        ) : null}
        <div className="guided-tour-actions">
          <button
            type="button"
            className="guided-tour-btn-secondary"
            onClick={() => { setVerifyFailed(false); advance(); }}
          >
            {l.skip}
          </button>
          {step?.verify ? (
            <button type="button" className="guided-tour-btn-primary" onClick={handleCheckNext}>
              {l.check} <ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" className="guided-tour-btn-primary" onClick={advance}>
              {isLast ? l.finish : l.next} <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
