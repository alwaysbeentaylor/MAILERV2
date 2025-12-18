import { WARMUP_PROFILES } from '../utils/warmupProfiles';

export default function WarmupStatus({ summary, compact = false }) {
    if (!summary) return null;

    const {
        enabled,
        paused,
        profileName,
        currentPhase,
        totalPhases,
        dailyLimit,
        todaySent,
        remaining,
        progress,
        daysRemaining,
        isComplete
    } = summary;

    if (!enabled) {
        return (
            <div className={`warmup-status ${compact ? 'compact' : ''} disabled`}>
                <span className="status-icon">❄️</span>
                <span className="status-text">Warm-up uit</span>
                <style jsx>{styles}</style>
            </div>
        );
    }

    if (isComplete) {
        return (
            <div className={`warmup-status ${compact ? 'compact' : ''} complete`}>
                <span className="status-icon">🔥</span>
                <span className="status-text">Volledig opgewarmd</span>
                <style jsx>{styles}</style>
            </div>
        );
    }

    if (paused) {
        return (
            <div className={`warmup-status ${compact ? 'compact' : ''} paused`}>
                <span className="status-icon">⏸️</span>
                <span className="status-text">Gepauzeerd</span>
                <style jsx>{styles}</style>
            </div>
        );
    }

    if (compact) {
        return (
            <div className="warmup-status compact">
                <div className="compact-info">
                    <span className="status-icon">🔥</span>
                    <span className="remaining">{remaining} over</span>
                </div>
                <div className="mini-bar">
                    <div className="mini-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <style jsx>{styles}</style>
            </div>
        );
    }

    return (
        <div className="warmup-status">
            <div className="status-header">
                <span className="profile-badge">{profileName}</span>
                <span className="phase-badge">Fase {currentPhase}/{totalPhases}</span>
            </div>

            <div className="progress-section">
                <div className="progress-labels">
                    <span>Vandaag: {todaySent}/{dailyLimit}</span>
                    <span className="remaining-text">{remaining} over</span>
                </div>
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, progress)}%` }}
                    />
                </div>
            </div>

            {remaining === 0 && (
                <div className="limit-warning">
                    ⚠️ Dagelijks limiet bereikt
                </div>
            )}

            <div className="days-remaining">
                {daysRemaining > 0 ? (
                    <span>📅 Volledig over {daysRemaining} dagen</span>
                ) : (
                    <span>✅ Warm-up bijna compleet</span>
                )}
            </div>

            <style jsx>{styles}</style>
        </div>
    );
}

const styles = `
  .warmup-status {
    background: #1a1a2e;
    border-radius: 12px;
    padding: 16px;
    border: 1px solid #2a2a4e;
  }

  .warmup-status.compact {
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .warmup-status.disabled {
    opacity: 0.6;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .warmup-status.complete {
    background: linear-gradient(135deg, #1a2e1a, #1a1a2e);
    border-color: #22c55e;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .warmup-status.paused {
    background: linear-gradient(135deg, #2e2a1a, #1a1a2e);
    border-color: #f59e0b;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-icon {
    font-size: 16px;
  }

  .status-text {
    color: #aaa;
    font-size: 14px;
  }

  .compact-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .remaining {
    color: #00A4E8;
    font-weight: 600;
    font-size: 13px;
  }

  .mini-bar {
    flex: 1;
    height: 6px;
    background: #2a2a4e;
    border-radius: 3px;
    overflow: hidden;
  }

  .mini-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #00A4E8, #06b6d4);
    transition: width 0.3s;
  }

  .status-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .profile-badge {
    font-size: 12px;
    color: #aaa;
  }

  .phase-badge {
    font-size: 12px;
    color: #00A4E8;
    font-weight: 600;
  }

  .progress-section {
    margin-bottom: 12px;
  }

  .progress-labels {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #888;
    margin-bottom: 6px;
  }

  .remaining-text {
    color: #00A4E8;
    font-weight: 600;
  }

  .progress-bar {
    height: 8px;
    background: #2a2a4e;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00A4E8, #06b6d4);
    transition: width 0.3s;
  }

  .limit-warning {
    background: #451a1a;
    color: #ef4444;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    margin-bottom: 12px;
  }

  .days-remaining {
    font-size: 13px;
    color: #888;
  }
`;
