/**
 * Zero-cloud beta metrics tracker: computes local conversion rates.
 */
export function recordBetaInteraction(event) {
  const history = JSON.parse(localStorage.getItem('sentinel_beta_metrics') || '[]');
  history.push({
    timestamp: Date.now(),
    type: event.type, // 'CANCEL_CLICKED' | 'OVERRIDE_CLICKED' | 'REPORT_COPIED' | 'FEEDBACK_FLAGGED'
    verdict: event.verdict,
    category: event.category || 'GENERAL'
  });
  localStorage.setItem('sentinel_beta_metrics', JSON.stringify(history));
}

export function computeBetaStats() {
  const history = JSON.parse(localStorage.getItem('sentinel_beta_metrics') || '[]');
  const total = history.length;
  if (!total) return null;

  const aborted = history.filter(h => h.type === 'CANCEL_CLICKED').length;
  const falseAlarms = history.filter(h => h.type === 'FEEDBACK_FLAGGED').length;

  return {
    totalEvaluations: total,
    abortedScamsRatio: ((aborted / total) * 100).toFixed(1) + '%',
    reportedFalseAlarmRate: ((falseAlarms / total) * 100).toFixed(1) + '%'
  };
}