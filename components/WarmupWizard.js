import { useState } from 'react';
import { WARMUP_PROFILES, STARTING_POINTS, calculateDailyLimit, getDaysRemaining } from '../utils/warmupProfiles';

export default function WarmupWizard({ onComplete, onCancel }) {
    const [step, setStep] = useState(1);
    const [settings, setSettings] = useState({
        profile: 'standard',
        startingPoint: 'new',
        reduceOnWeekends: true,
        customLimit: null
    });

    const profile = WARMUP_PROFILES[settings.profile];
    const startingPoint = STARTING_POINTS[settings.startingPoint];

    // Calculate preview
    const previewData = {
        warmupEnabled: true,
        warmupProfile: settings.profile,
        warmupStartDate: new Date().toISOString().split('T')[0],
        startingPoint: settings.startingPoint,
        customDailyLimit: settings.customLimit
    };
    const initialLimit = calculateDailyLimit(previewData);
    const daysRemaining = getDaysRemaining(previewData);

    const handleComplete = () => {
        onComplete(settings);
    };

    return (
        <div className="warmup-wizard">
            <div className="wizard-header">
                <h3>🔥 Warm-up Configuratie</h3>
                <div className="wizard-steps">
                    {[1, 2, 3, 4].map(s => (
                        <span key={s} className={`step-dot ${s === step ? 'active' : ''} ${s < step ? 'done' : ''}`}>
                            {s < step ? '✓' : s}
                        </span>
                    ))}
                </div>
            </div>

            <div className="wizard-content">
                {/* Step 1: Profile Selection */}
                {step === 1 && (
                    <div className="wizard-step">
                        <h4>Kies je warm-up strategie</h4>
                        <div className="profile-options">
                            {Object.values(WARMUP_PROFILES).map(p => (
                                <label
                                    key={p.id}
                                    className={`profile-option ${settings.profile === p.id ? 'selected' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="profile"
                                        value={p.id}
                                        checked={settings.profile === p.id}
                                        onChange={(e) => setSettings({ ...settings, profile: e.target.value })}
                                    />
                                    <div className="profile-info">
                                        <span className="profile-name">{p.name}</span>
                                        <span className="profile-desc">{p.description}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Starting Point */}
                {step === 2 && (
                    <div className="wizard-step">
                        <h4>Huidige status van dit account</h4>
                        <div className="starting-options">
                            {Object.values(STARTING_POINTS).map(sp => (
                                <label
                                    key={sp.id}
                                    className={`starting-option ${settings.startingPoint === sp.id ? 'selected' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="startingPoint"
                                        value={sp.id}
                                        checked={settings.startingPoint === sp.id}
                                        onChange={(e) => setSettings({ ...settings, startingPoint: e.target.value })}
                                    />
                                    <div className="starting-info">
                                        <span className="starting-label">{sp.label}</span>
                                        <span className="starting-desc">{sp.description}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3: Weekend Mode */}
                {step === 3 && (
                    <div className="wizard-step">
                        <h4>Weekend instellingen</h4>
                        <label className="weekend-toggle">
                            <input
                                type="checkbox"
                                checked={settings.reduceOnWeekends}
                                onChange={(e) => setSettings({ ...settings, reduceOnWeekends: e.target.checked })}
                            />
                            <div className="toggle-content">
                                <span className="toggle-label">📅 Verminder op weekenden</span>
                                <span className="toggle-desc">
                                    50% minder emails op zaterdag en zondag voor een realistischer patroon
                                </span>
                            </div>
                        </label>

                        {settings.profile === 'custom' && (
                            <div className="custom-limit-input">
                                <label>Dagelijks limiet:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="1000"
                                    value={settings.customLimit || 50}
                                    onChange={(e) => setSettings({ ...settings, customLimit: parseInt(e.target.value) || 50 })}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Step 4: Summary */}
                {step === 4 && (
                    <div className="wizard-step">
                        <h4>Overzicht</h4>
                        <div className="summary-card">
                            <div className="summary-row">
                                <span>Strategie:</span>
                                <strong>{profile.name}</strong>
                            </div>
                            <div className="summary-row">
                                <span>Start positie:</span>
                                <strong>{startingPoint.label}</strong>
                            </div>
                            <div className="summary-row">
                                <span>Weekend modus:</span>
                                <strong>{settings.reduceOnWeekends ? '50% limiet' : 'Normaal'}</strong>
                            </div>
                            <hr />
                            <div className="summary-row highlight">
                                <span>Vandaag limiet:</span>
                                <strong>{initialLimit} emails</strong>
                            </div>
                            <div className="summary-row highlight">
                                <span>Volledig opgewarmd over:</span>
                                <strong>{daysRemaining} dagen</strong>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="wizard-footer">
                {step > 1 && (
                    <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                        ← Vorige
                    </button>
                )}
                {step < 4 ? (
                    <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
                        Volgende →
                    </button>
                ) : (
                    <button className="btn btn-primary" onClick={handleComplete}>
                        ✅ Warm-up Starten
                    </button>
                )}
                <button className="btn btn-text" onClick={onCancel}>
                    Annuleren
                </button>
            </div>

            <style jsx>{`
        .warmup-wizard {
          background: #1a1a2e;
          border-radius: 16px;
          padding: 24px;
          max-width: 500px;
        }

        .wizard-header {
          margin-bottom: 24px;
        }

        .wizard-header h3 {
          margin: 0 0 16px 0;
          color: #fff;
        }

        .wizard-steps {
          display: flex;
          gap: 8px;
        }

        .step-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          background: #2a2a4e;
          color: #888;
        }

        .step-dot.active {
          background: #00A4E8;
          color: #fff;
        }

        .step-dot.done {
          background: #22c55e;
          color: #fff;
        }

        .wizard-content {
          min-height: 250px;
        }

        .wizard-step h4 {
          margin: 0 0 16px 0;
          color: #ddd;
          font-size: 16px;
        }

        .profile-options, .starting-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .profile-option, .starting-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: #0d0d1a;
          border: 2px solid #2a2a4e;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .profile-option:hover, .starting-option:hover {
          border-color: #00A4E8;
        }

        .profile-option.selected, .starting-option.selected {
          border-color: #00A4E8;
          background: #1a1a3e;
        }

        .profile-option input, .starting-option input {
          display: none;
        }

        .profile-info, .starting-info {
          display: flex;
          flex-direction: column;
        }

        .profile-name, .starting-label {
          color: #fff;
          font-weight: 600;
        }

        .profile-desc, .starting-desc {
          color: #888;
          font-size: 13px;
        }

        .weekend-toggle {
          display: flex;
          gap: 14px;
          padding: 16px;
          background: #0d0d1a;
          border-radius: 10px;
          cursor: pointer;
        }

        .weekend-toggle input {
          width: 20px;
          height: 20px;
          accent-color: #00A4E8;
        }

        .toggle-content {
          display: flex;
          flex-direction: column;
        }

        .toggle-label {
          color: #fff;
          font-weight: 500;
        }

        .toggle-desc {
          color: #888;
          font-size: 13px;
        }

        .custom-limit-input {
          margin-top: 16px;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .custom-limit-input label {
          color: #ccc;
        }

        .custom-limit-input input {
          width: 100px;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #3a3a5e;
          background: #0d0d1a;
          color: #fff;
        }

        .summary-card {
          background: #0d0d1a;
          border-radius: 12px;
          padding: 20px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          color: #aaa;
        }

        .summary-row strong {
          color: #fff;
        }

        .summary-row.highlight {
          color: #00A4E8;
        }

        .summary-row.highlight strong {
          color: #00A4E8;
        }

        hr {
          border: none;
          border-top: 1px solid #2a2a4e;
          margin: 12px 0;
        }

        .wizard-footer {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .btn {
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #00A4E8;
          color: #fff;
        }

        .btn-primary:hover {
          background: #0090cc;
        }

        .btn-secondary {
          background: #2a2a4e;
          color: #fff;
        }

        .btn-secondary:hover {
          background: #3a3a5e;
        }

        .btn-text {
          background: none;
          color: #888;
          margin-left: auto;
        }

        .btn-text:hover {
          color: #fff;
        }
      `}</style>
        </div>
    );
}
