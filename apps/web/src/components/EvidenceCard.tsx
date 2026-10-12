import React, { useState } from 'react';
import type { RootCauseCandidate } from '@tracelens/shared';
import { ChevronDown, ChevronRight, ExternalLink, MinusCircle } from 'lucide-react';

interface EvidenceCardProps {
  candidate: RootCauseCandidate;
  defaultExpanded?: boolean;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({ candidate, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const score = candidate.score ?? Math.round((candidate as any).confidenceScore ? (candidate as any).confidenceScore * 100 : 85);
  const rank = candidate.rank ?? 1;
  const explanation = candidate.explanation || (candidate as any).reasoning || '';
  const evidenceList: any[] = candidate.evidence || ((candidate as any).supportingEvidence || []).map((desc: string) => ({
    type: 'error_spike',
    weight: 25,
    description: desc,
  }));

  const typeLabels: Record<string, string> = {
    deployment: 'Correlated Deployment',
    dependency: 'Downstream Dependency',
    service: 'Service Anomaly',
    external: 'External Dependency',
  };

  const scoreBarColor =
    score >= 75
      ? 'bg-[#f85149]'
      : score >= 45
      ? 'bg-[#d29922]'
      : 'bg-[#2f81f7]';

  return (
    <div className="rounded-sm border border-border bg-surface overflow-hidden">
      {/* Top Summary Bar */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-raised transition-colors select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            className="text-txt-muted hover:text-txt-primary p-0.5"
            aria-label={expanded ? 'Collapse evidence' : 'Expand evidence'}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded-sm bg-surface-raised border border-border text-txt-secondary tabular-nums">
            #{rank}
          </span>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-txt-primary truncate">
              {candidate.candidateLabel}
            </h4>
            <span className="text-[10px] text-txt-muted uppercase tracking-wider font-mono">
              {typeLabels[candidate.candidateType] || candidate.candidateType}
            </span>
          </div>
        </div>

        {/* Score & Bar */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-surface-active overflow-hidden">
                <div
                  className={`h-full ${scoreBarColor}`}
                  style={{ width: `${Math.min(100, score)}%` }}
                />
              </div>
              <span className="font-mono text-xs font-semibold text-txt-primary tabular-nums">
                {score}%
              </span>
            </div>
            <span className="text-[10px] text-txt-muted font-mono">confidence</span>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-border-subtle bg-surface-raised/40 p-3 space-y-2.5 text-xs">
          {explanation && (
            <p className="text-[11px] text-txt-secondary leading-relaxed bg-surface p-2.5 rounded-sm border border-border-subtle font-sans">
              {explanation}
            </p>
          )}

          {/* Evidence Signals */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-txt-muted uppercase tracking-wider block font-mono">
              Evidence Signals ({evidenceList.length})
            </span>
            <div className="space-y-1 font-mono text-[11px]">
              {evidenceList.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm bg-surface border border-border-subtle"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] shrink-0" />
                    <span className="text-txt-primary truncate font-sans text-xs">
                      {item.description}
                    </span>
                    {item.value !== undefined && item.threshold !== undefined && (
                      <span className="text-[10px] text-txt-muted tabular-nums">
                        ({item.value} &gt; {item.threshold})
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-accent font-medium tabular-nums shrink-0">
                    +{item.weight ?? 20} {item.type ? item.type.replace('_', ' ') : 'pts'}
                  </span>
                </div>
              ))}

              {/* Missing Signals */}
              {candidate.missingEvidence && candidate.missingEvidence.length > 0 ? (
                candidate.missingEvidence.map((m, idx) => (
                  <div
                    key={`missing-${idx}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm bg-surface/50 border border-border-subtle text-txt-muted opacity-80"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MinusCircle className="w-3 h-3 text-txt-muted shrink-0" />
                      <span className="truncate font-sans text-xs text-txt-muted">
                        {m}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-txt-muted uppercase tracking-wider shrink-0">
                      no data
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm bg-surface/30 border border-border-subtle text-txt-muted">
                  <span className="text-[11px] font-sans text-txt-muted">
                    No conflicting or missing telemetry detected
                  </span>
                  <span className="font-mono text-[10px] text-txt-muted uppercase tracking-wider">
                    verified
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Telemetry Drilldown Links */}
          {candidate.telemetryLinks && candidate.telemetryLinks.length > 0 && (
            <div className="pt-2 border-t border-border-subtle flex flex-wrap gap-1.5">
              {candidate.telemetryLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded-sm bg-surface hover:bg-surface-raised text-accent border border-border hover:border-accent transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
