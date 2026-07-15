import type React from 'react';
import { Globe2, Monitor, Server } from 'lucide-react';
import { UI_TEXT } from '../../renderer/config/i18n';
import { SUPPORTED_LANGUAGES } from '../../renderer/config/constants';
import { useProjectStore } from '../../renderer/store/projectStore';
import type { LanguageCode } from '../../domain/localization';

const API_PORT = 8766;
const MCP_PORT = 8767;

export function SettingsWorkspace(): React.ReactElement {
  const { project, language, setLanguage, updateProjectMetadata, updateDisplayConfig } = useProjectStore();
  const labels = UI_TEXT[language];
  const isDesktop = Boolean(window.spectroDesigner);

  if (!project) {
    return <section className="workspace-empty">{labels.noProjectLoaded}</section>;
  }

  return (
    <section className="workspace-root settings-workspace" aria-label={labels.settingsWorkspace}>
      <div className="settings-column">
        <section className="inspector-card settings-card">
          <h3><Globe2 size={16} /> {labels.settingsLanguage}</h3>
          <select value={language} onChange={(event) => setLanguage(event.target.value as LanguageCode)}>
            {SUPPORTED_LANGUAGES.map((code) => (
              <option key={code} value={code}>{code.toUpperCase()}</option>
            ))}
          </select>
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
            <span className="hmi-form-label">{labels.settingsDisplayWidth}</span>
            <input
              type="number"
              min={8}
              max={1024}
              className="hmi-form-input"
              value={project.display.width}
              onChange={(event) => updateDisplayConfig({ ...project.display, width: Number(event.target.value) || project.display.width })}
            />
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsDisplayHeight}</span>
            <input
              type="number"
              min={8}
              max={1024}
              className="hmi-form-input"
              value={project.display.height}
              onChange={(event) => updateDisplayConfig({ ...project.display, height: Number(event.target.value) || project.display.height })}
            />
          </label>
          <label className="hmi-form-row">
            <span className="hmi-form-label">{labels.settingsDisplayPacking}</span>
            <input className="hmi-form-input" value={project.display.packing} disabled />
          </label>
        </section>

        <section className="inspector-card settings-card">
          <h3><Server size={16} /> {labels.settingsApiMcp}</h3>
          <p className="settings-hint">{labels.settingsApiMcpDesktopOnly}</p>
          {isDesktop ? (
            <div className="settings-server-status">
              <div className="settings-server-row">
                <span>{labels.settingsApiStatus}</span>
                <code>http://127.0.0.1:{API_PORT}</code>
                <span className="settings-status-badge">{labels.settingsApiMcpRunning}</span>
              </div>
              <div className="settings-server-row">
                <span>{labels.settingsMcpStatus}</span>
                <code>http://127.0.0.1:{MCP_PORT}/mcp</code>
                <span className="settings-status-badge">{labels.settingsApiMcpRunning}</span>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
