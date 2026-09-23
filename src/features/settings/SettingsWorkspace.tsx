import { useRef, type ChangeEvent } from 'react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Globe2, Monitor, Server, RefreshCw } from 'lucide-react';
import { UI_TEXT } from '../../renderer/config/i18n';
import { DISPLAY_PROFILES, SUPPORTED_LANGUAGES } from '../../renderer/config/constants';
import { useProjectStore } from '../../renderer/store/projectStore';
import type { LanguageCode } from '../../domain/localization';
import { bitsForPixelFormat, exportDisplayProfile, importDisplayProfile, normalizeDisplayProfile, validateDisplayProfile, type DisplayPixelFormat } from '../../domain';
import { executeAutomationRequest } from '../../renderer/automation/automationDispatcher';
import { beginOperation, notify } from '../../renderer/notifications/notificationStore';
import { ThemeSelector } from '../../renderer/theme/ThemeSelector';
import type { ThemePreference } from '../../renderer/theme/themePreference';
import { APP_SOFTWARE_VERSION } from '../../renderer/config/constants';
import { checkForUpdate, RELEASES_URL, type AvailableUpdate } from '../../renderer/utils/updateChecker';

const API_PORT = 8766;
const MCP_PORT = 8767;

export function SettingsWorkspace({
  themePreference,
  onThemeChange
}: {
  themePreference: ThemePreference;
  onThemeChange: (preference: ThemePreference) => void;
}): React.ReactElement {
  const { project, language, setLanguage, setAuthoringLanguage, updateProjectMetadata, updateDisplayConfig } = useProjectStore();
  const labels = UI_TEXT[language];
  const isDesktop = Boolean(window.spectroDesigner);
  const hasAutomationStatus = Boolean(window.spectroDesigner?.automationStatus);
  const [automationStatus, setAutomationStatus] = useState<Awaited<ReturnType<NonNullable<NonNullable<typeof window.spectroDesigner>['automationStatus']>>> | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'current' | 'error'>('idle');
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    let active = true;
    const readStatus = window.spectroDesigner?.automationStatus;
    if (!readStatus) return undefined;
    const refresh = (): void => {
      void readStatus().then((status) => {
        if (active) setAutomationStatus(status);
      }).catch(() => {
        if (active) setAutomationStatus(null);
      });
    };
    refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);
  const profileFileInput = useRef<HTMLInputElement>(null);

  if (!project) {
    return <section className="workspace-empty">{labels.noProjectLoaded}</section>;
  }

  const profileDiagnostics = validateDisplayProfile(project.display);

  const exportProfile = (): void => downloadBytes(
    `${project.display.id}.display-profile.json`,
    new TextEncoder().encode(exportDisplayProfile(project.display)),
    'application/json'
  );

  const importProfile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const profile = importDisplayProfile(await file.text());
      const diagnostics = validateDisplayProfile(profile).filter((item) => item.severity === 'error');
      if (diagnostics.length) throw new Error(diagnostics.map((item) => item.message).join(' '));
      updateDisplayConfig(profile);
      notify({ title: labels.settingsProfileImported, message: profile.fingerprint, tone: 'success', source: 'settings' });
    } catch (error) {
      notify({ title: labels.settingsProfileImportFailed, message: error instanceof Error ? error.message : String(error), tone: 'danger', persistent: true, source: 'settings' });
    }
  };

  const runEvidence = async (download: boolean): Promise<void> => {
    const operation = beginOperation(download ? labels.settingsCreatingEvidence : labels.settingsPreviewingRoundTrip, { source: 'settings' });
    const outcome = await executeAutomationRequest({
      command: download ? 'create_evidence_bundle' : 'preview_export',
      input: {},
      correlationId: `ui-evidence-${Date.now()}`,
      source: 'ui',
      permissions: ['project:read']
    });
    if (outcome.status !== 'success') {
      operation.fail(labels.settingsEvidenceFailed, outcome.diagnostics[0]?.message);
      return;
    }
    const output = outcome.output as { filename?: string; content?: string; comparison?: { differentPixels: number; result: string } };
    if (download && output.content) downloadBytes(output.filename ?? 'lcd-evidence.zip', base64ToBytes(output.content), 'application/zip');
    operation.succeed(
      output.comparison?.result === 'passed' ? labels.settingsRoundTripPassed : labels.settingsRoundTripCompleted,
      labels.settingsDifferentPixels.replace('{count}', String(output.comparison?.differentPixels ?? labels.settingsUnknown))
    );
  };

  const checkUpdates = async (): Promise<void> => {
    setUpdateStatus('checking');
    setAvailableUpdate(null);
    try {
      const update = await checkForUpdate(APP_SOFTWARE_VERSION);
      setAvailableUpdate(update);
      setUpdateStatus('current');
    } catch {
      setUpdateStatus('error');
    }
  };

  return (
    <section className="workspace-root settings-workspace" aria-label={labels.settingsWorkspace}>
      <div className="settings-column">
        <section className="inspector-card settings-card">
          <h3><Monitor size={16} /> {labels.theme}</h3>
          <ThemeSelector
            preference={themePreference}
            onChange={onThemeChange}
            labels={labels}
            testId="settings-theme-selector"
          />
          <p className="settings-hint">{labels.themeSystemHint}</p>
        </section>

        <section className="inspector-card settings-card">
          <h3><RefreshCw size={16} /> {labels.settingsSoftwareUpdates}</h3>
          <p className="settings-hint">{labels.settingsCurrentSoftwareVersion}: {APP_SOFTWARE_VERSION}</p>
          <div className="settings-server-row">
            <button type="button" onClick={() => void checkUpdates()} disabled={updateStatus === 'checking'}>
              {updateStatus === 'checking' ? labels.settingsCheckingForUpdates : labels.settingsCheckForUpdates}
            </button>
            <a className="settings-release-link" href={availableUpdate?.releaseUrl ?? RELEASES_URL} target="_blank" rel="noreferrer">
              {labels.settingsOpenReleases}
            </a>
          </div>
          {availableUpdate ? (
            <p className="settings-update-available">{labels.settingsUpdateAvailable.replace('{version}', availableUpdate.version)}</p>
          ) : updateStatus === 'current' ? (
            <p className="settings-hint">{labels.settingsAlreadyUpToDate}</p>
          ) : updateStatus === 'error' ? (
            <p className="settings-update-error">{labels.settingsUpdateCheckFailed}</p>
          ) : null}
        </section>

        <section className="inspector-card settings-card">
          <h3><Globe2 size={16} /> {labels.settingsLanguage}</h3>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsLanguage}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as LanguageCode)}>
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>{code.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsContentLanguage}</span>
            <select value={project.authoringLanguage ?? 'en'} onChange={(event) => setAuthoringLanguage(event.target.value as LanguageCode)}>
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>{code.toUpperCase()}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="inspector-card settings-card">
          <h3>{labels.settingsProjectMeta}</h3>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsProjectName}</span>
            <input
              className="hmi-form-input"
              value={project.meta.name}
              onChange={(event) => updateProjectMetadata({ name: event.target.value })}
            />
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsProjectVersion}</span>
            <input
              className="hmi-form-input"
              value={project.meta.version}
              onChange={(event) => updateProjectMetadata({ version: event.target.value })}
            />
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsAuthor}</span>
            <input
              className="hmi-form-input"
              value={project.meta.author ?? ''}
              onChange={(event) => updateProjectMetadata({ author: event.target.value || null })}
            />
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsFirmwareVersion}</span>
            <input
              className="hmi-form-input"
              value={project.meta.firmwareVersion ?? ''}
              onChange={(event) => updateProjectMetadata({ firmwareVersion: event.target.value || null })}
            />
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsModelId}</span>
            <input
              className="hmi-form-input"
              value={project.meta.modelId}
              onChange={(event) => updateProjectMetadata({ modelId: event.target.value })}
            />
          </label>
        </section>

        <section className="inspector-card settings-card">
          <h3><Monitor size={16} /> {labels.settingsDisplay}</h3>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsDisplayProfile}</span>
            <select
              value={DISPLAY_PROFILES.some((profile) => profile.fingerprint === project.display.fingerprint) ? project.display.fingerprint : 'custom'}
              onChange={(event) => {
                const profile = DISPLAY_PROFILES.find((candidate) => candidate.fingerprint === event.target.value);
                if (profile) updateDisplayConfig(profile);
              }}
            >
              <option value="custom">{labels.settingsDisplayCustom} · {project.display.name}</option>
              {DISPLAY_PROFILES.map((profile) => <option key={profile.fingerprint} value={profile.fingerprint}>{profile.label}</option>)}
            </select>
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsDisplayWidth}</span>
            <input
              type="number"
              min={16}
              max={4096}
              className="hmi-form-input"
              value={project.display.width}
              onChange={(event) => updateDisplayConfig({ ...project.display, width: Number(event.target.value) || project.display.width })}
            />
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsDisplayHeight}</span>
            <input
              type="number"
              min={16}
              max={4096}
              className="hmi-form-input"
              value={project.display.height}
              onChange={(event) => updateDisplayConfig({ ...project.display, height: Number(event.target.value) || project.display.height })}
            />
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsPixelFormat}</span>
            <select value={project.display.pixelFormat} onChange={(event) => {
              const pixelFormat = event.target.value as DisplayPixelFormat;
              const bitsPerPixel = bitsForPixelFormat(pixelFormat);
              const packing = pixelFormat === 'mono1' ? 'vertical-pages' : pixelFormat === 'rgb565' ? 'interleaved' : 'horizontal-row-major';
              updateDisplayConfig(normalizeDisplayProfile({ ...project.display, pixelFormat, bitsPerPixel, packing, pageHeight: packing === 'vertical-pages' ? 8 : undefined }, project.display));
            }}>
              {['mono1', 'gray2', 'gray4', 'rgb565'].map((format) => <option key={format} value={format}>{format}</option>)}
            </select>
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsDisplayPacking}</span>
            <select value={project.display.packing} onChange={(event) => updateDisplayConfig(normalizeDisplayProfile({ ...project.display, packing: event.target.value }, project.display))}>
              {['vertical-pages', 'horizontal-row-major', 'planar', 'interleaved'].map((packing) => <option key={packing} value={packing}>{packing}</option>)}
            </select>
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsBitByteOrder}</span>
            <select value={project.display.bitOrder} onChange={(event) => updateDisplayConfig(normalizeDisplayProfile({ ...project.display, bitOrder: event.target.value }, project.display))}>
              <option value="lsb-first">{labels.settingsBitOrderLsb}</option><option value="msb-first">{labels.settingsBitOrderMsb}</option>
            </select>
            <select value={project.display.byteOrder} onChange={(event) => updateDisplayConfig(normalizeDisplayProfile({ ...project.display, byteOrder: event.target.value }, project.display))}>
              <option value="little-endian">{labels.settingsByteOrderLittle}</option><option value="big-endian">{labels.settingsByteOrderBig}</option>
            </select>
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsTransform}</span>
            <select value={project.display.rotation} onChange={(event) => updateDisplayConfig(normalizeDisplayProfile({ ...project.display, rotation: Number(event.target.value) }, project.display))}>
              {[0, 90, 180, 270].map((rotation) => <option key={rotation} value={rotation}>{rotation}°</option>)}
            </select>
            <input type="checkbox" checked={project.display.mirrorX} onChange={(event) => updateDisplayConfig(normalizeDisplayProfile({ ...project.display, mirrorX: event.target.checked }, project.display))} aria-label={labels.settingsMirrorX} /> {labels.settingsMirrorX}
            <input type="checkbox" checked={project.display.mirrorY} onChange={(event) => updateDisplayConfig(normalizeDisplayProfile({ ...project.display, mirrorY: event.target.checked }, project.display))} aria-label={labels.settingsMirrorY} /> {labels.settingsMirrorY}
            <input type="checkbox" checked={project.display.inverted} onChange={(event) => updateDisplayConfig(normalizeDisplayProfile({ ...project.display, inverted: event.target.checked }, project.display))} aria-label={labels.settingsInvertPixels} /> {labels.settingsInvert}
          </label>
          <p className="settings-hint"><code>{project.display.fingerprint}</code></p>
          {profileDiagnostics.map((issue) => <p key={`${issue.path}:${issue.code}`} className="settings-hint">{issue.severity}: {issue.message}</p>)}
          <div className="settings-server-row">
            <button type="button" onClick={exportProfile}>{labels.settingsExportProfile}</button>
            <button type="button" onClick={() => profileFileInput.current?.click()}>{labels.settingsImportProfile}</button>
            <button type="button" onClick={() => void runEvidence(false)}>{labels.settingsPreviewRoundTrip}</button>
            <button type="button" onClick={() => void runEvidence(true)}>{labels.settingsDownloadEvidence}</button>
            <input ref={profileFileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void importProfile(event)} />
          </div>
        </section>

        <section className="inspector-card settings-card">
          <h3><Server size={16} /> {labels.settingsApiMcp}</h3>
          <p className="settings-hint">{labels.settingsApiMcpDesktopOnly}</p>
          {isDesktop ? (
            <div className="settings-server-status">
              <div className="settings-server-row">
                <span>{labels.settingsApiStatus}</span>
                <code>{automationStatus?.rest.endpoint ?? `http://127.0.0.1:${API_PORT}`}</code>
                <span className={`settings-status-badge${automationStatus && !automationStatus.rest.running ? ' offline' : ''}`}>
                  {automationStatus ? (automationStatus.rest.running ? labels.settingsApiMcpRunning : '—') : (hasAutomationStatus ? '…' : labels.settingsApiMcpRunning)}
                </span>
              </div>
              <div className="settings-server-row">
                <span>{labels.settingsMcpStatus}</span>
                <code>{automationStatus?.mcp.endpoint ?? `http://127.0.0.1:${MCP_PORT}/mcp`}</code>
                <span className={`settings-status-badge${automationStatus && !automationStatus.mcp.running ? ' offline' : ''}`}>
                  {automationStatus ? (automationStatus.mcp.running ? labels.settingsApiMcpRunning : '—') : (hasAutomationStatus ? '…' : labels.settingsApiMcpRunning)}
                </span>
              </div>
              {automationStatus?.mcp.running ? (
                <div className="settings-server-row settings-server-details">
                  <span>{labels.settingsMcpProtocolPrefix} {automationStatus.mcp.protocolVersion}</span>
                  <code>{automationStatus.mcp.healthEndpoint}</code>
                  <span>{automationStatus.authConfigured ? labels.settingsAuthModeToken : labels.settingsAuthModeLocalhost}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function downloadBytes(filename: string, bytes: Uint8Array, mediaType: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mediaType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
