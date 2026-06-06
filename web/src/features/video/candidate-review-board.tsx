"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { Button } from "../../components/common/button";
import { StatusBadge } from "../../components/common/status-badge";
import type { CandidateAction, VideoCandidateAnalysisData } from "../../services/video-api";

type CandidateReviewBoardProps = {
  analysis: VideoCandidateAnalysisData | null;
  actions: Record<string, CandidateAction>;
  disabled?: boolean;
  isAnalyzing: boolean;
  canAnalyze: boolean;
  onAnalyze: () => Promise<void>;
  onActionChange: (candidateId: string, action: CandidateAction) => void;
};

const actionLabels: Record<CandidateAction, string> = {
  preserve: "보존",
  character: "캐릭터",
  blur: "블러",
  track: "추적",
};

const actionDescriptions: Record<CandidateAction, string> = {
  preserve: "이 얼굴 유지",
  character: "얼굴 대체",
  blur: "얼굴 가림",
  track: "프레임 추적",
};

const actionOrder: CandidateAction[] = ["preserve", "character", "blur", "track"];

function getActionTone(action: CandidateAction): "neutral" | "success" | "warning" | "danger" {
  if (action === "preserve") {
    return "success";
  }
  if (action === "character" || action === "track") {
    return "warning";
  }
  return "neutral";
}

function CandidateImage({ alt, src, accessToken }: { alt: string; src: string; accessToken: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let currentObjectUrl: string | null = null;

    async function loadImage() {
      const response = await fetch(src, { headers: { "X-Access-Token": accessToken } });
      if (!response.ok) {
        return;
      }
      currentObjectUrl = URL.createObjectURL(await response.blob());
      if (active) {
        setObjectUrl(currentObjectUrl);
      } else {
        URL.revokeObjectURL(currentObjectUrl);
      }
    }

    void loadImage();
    return () => {
      active = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [accessToken, src]);

  if (!objectUrl) {
    return <div className="candidate-card__image-placeholder" aria-label={alt} />;
  }

  return <Image src={objectUrl} alt={alt} width={180} height={180} unoptimized />;
}

export function CandidateReviewBoard({
  analysis,
  actions,
  disabled = false,
  isAnalyzing,
  canAnalyze,
  onAnalyze,
  onActionChange,
}: CandidateReviewBoardProps) {
  const candidateCount = analysis?.candidates.length ?? 0;
  const selectedCount = Object.keys(actions).length;

  return (
    <section className="candidate-board" aria-label="후보 리뷰 보드">
      <div className="candidate-board__header">
        <div className="stack-xs">
          <p className="eyebrow">후보 리뷰 보드</p>
          <h3 className="surface-heading">렌더 전 인물 처리 결정</h3>
        </div>
        <div className="cluster">
          <StatusBadge label={`후보 ${candidateCount}개`} tone={candidateCount > 0 ? "success" : "neutral"} />
          <StatusBadge label={`결정 ${selectedCount}개`} tone={selectedCount > 0 ? "warning" : "neutral"} />
          <Button disabled={!canAnalyze || disabled} onClick={() => void onAnalyze()} variant="primary" size="sm">
            {isAnalyzing ? "분석 중" : "얼굴 분석"}
          </Button>
        </div>
      </div>

      {analysis ? (
        <div className="candidate-board__meta">
          <span>{analysis.source_filename}</span>
          <span>{analysis.analysis_id}</span>
        </div>
      ) : null}

      {analysis && analysis.candidates.length > 0 ? (
        <div className="candidate-grid">
          {analysis.candidates.map((candidate, index) => {
            const selectedAction = actions[candidate.candidate_id] ?? "blur";

            return (
              <article key={candidate.candidate_id} className={`candidate-card candidate-card--${selectedAction}`}>
                <div className="candidate-card__media">
                  <CandidateImage accessToken={analysis.access_token} src={candidate.image_url} alt={`후보 ${index + 1}`} />
                  <div className="candidate-card__index">{String(index + 1).padStart(2, "0")}</div>
                </div>

                <div className="candidate-card__body">
                  <div className="cluster-between">
                    <div className="stack-xs">
                      <h4>후보 {index + 1}</h4>
                      <p>프레임 {candidate.frame_index}</p>
                    </div>
                    <StatusBadge label={actionLabels[selectedAction]} tone={getActionTone(selectedAction)} />
                  </div>

                  <div className="candidate-card__metrics" aria-label={`후보 ${index + 1} 메타데이터`}>
                    <span>신뢰도 {Math.round(candidate.confidence * 100)}%</span>
                    <span>{candidate.bbox.join(", ")}</span>
                  </div>

                  <div className="candidate-action-grid" role="group" aria-label={`후보 ${index + 1} 처리 방식`}>
                    {actionOrder.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className={[
                          "candidate-action-button",
                          selectedAction === action ? "candidate-action-button--active" : null,
                          `candidate-action-button--${action}`,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        disabled={disabled}
                        onClick={() => onActionChange(candidate.candidate_id, action)}
                      >
                        <span>{actionLabels[action]}</span>
                        <small>{actionDescriptions[action]}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="candidate-board__empty">
          {isAnalyzing
            ? "샘플 프레임을 읽고 후보 얼굴 crop을 준비하고 있습니다."
            : analysis
              ? "샘플 프레임에서 검토 가능한 얼굴 후보를 찾지 못했습니다."
              : "영상을 선택한 뒤 후보 분석을 실행하세요."}
        </div>
      )}
    </section>
  );
}
