"use client";

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
  preserve: "Preserve",
  character: "Character",
  blur: "Blur",
  track: "Track",
};

const actionDescriptions: Record<CandidateAction, string> = {
  preserve: "Keep visible",
  character: "Replace face",
  blur: "Redact face",
  track: "Audit across frames",
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
    <section className="candidate-board" aria-label="Candidate review board">
      <div className="candidate-board__header">
        <div className="stack-xs">
          <p className="eyebrow">Candidate Review Board</p>
          <h3 className="surface-heading">Identity decisions before render</h3>
        </div>
        <div className="cluster">
          <StatusBadge label={`${candidateCount} candidates`} tone={candidateCount > 0 ? "success" : "neutral"} />
          <StatusBadge label={`${selectedCount} decisions`} tone={selectedCount > 0 ? "warning" : "neutral"} />
          <Button disabled={!canAnalyze || disabled} onClick={() => void onAnalyze()} variant="primary" size="sm">
            {isAnalyzing ? "Analyzing" : "Analyze faces"}
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
                  <Image src={candidate.image_url} alt={`Candidate ${index + 1}`} width={180} height={180} unoptimized />
                  <div className="candidate-card__index">{String(index + 1).padStart(2, "0")}</div>
                </div>

                <div className="candidate-card__body">
                  <div className="cluster-between">
                    <div className="stack-xs">
                      <h4>Candidate {index + 1}</h4>
                      <p>Frame {candidate.frame_index}</p>
                    </div>
                    <StatusBadge label={actionLabels[selectedAction]} tone={getActionTone(selectedAction)} />
                  </div>

                  <div className="candidate-card__metrics" aria-label={`Candidate ${index + 1} metadata`}>
                    <span>Confidence {Math.round(candidate.confidence * 100)}%</span>
                    <span>{candidate.bbox.join(", ")}</span>
                  </div>

                  <div className="candidate-action-grid" role="group" aria-label={`Candidate ${index + 1} action`}>
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
            ? "Reading sampled frames and preparing candidate crops."
            : analysis
              ? "No reviewable face candidates were detected in the sampled frames."
              : "Run candidate analysis after choosing a video file."}
        </div>
      )}
    </section>
  );
}
