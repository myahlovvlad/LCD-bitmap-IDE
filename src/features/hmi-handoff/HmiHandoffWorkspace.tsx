import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, FileStack, Link2, PackageCheck, PlugZap, RefreshCw, Tags, Unplug } from 'lucide-react';
import type { TextCanvasObject } from '../../domain/canvas';
import { FontRenderer } from '../../domain/fonts';
import { useProjectStore } from '../../renderer/store/projectStore';
import { LCDCanvas } from '../../renderer/components/LCDCanvas';
import {
  ECROS_5300_DATA_SOURCES,
  ECROS_5300_DYNAMIC_FIELDS,
  ECROS_5300_HMI_TAGS
} from '../../spectrophotometer';
import { buildHandoffPackage } from './handoffPackage';
import { formatHmiValue } from '../../services/runtime/resolveLcdBindings';
import type {
  SpectroSerialPortInfo,
  SpectroSerialStatus
} from '../../shared/spectrophotometerSerial/contracts';

const SAMPLE_VALUES: Record<string, number> = {
  'measurement.concentration': 12.345,
  'measurement.stats.repeatability_percent': 1.2,
  'measurement.stats.mean_concentration': 12.301,
  'measurement.transmittance': 73.4,
  'measurement.absorbance': 0.134,
  'measurement.transmittance_percent': 73.4,
  'measurement.parallel.index': 3,
  'calibration.series.index': 7,
  'measurement.dilution.factor': 2,
  'measurement.pathlength_mm': 10,
  'measurement.parallel.count': 5,
  'calibration.curve.slope_m': 0.0421,
  'calibration.curve.slope_k': 0.0012
};

export function HmiHandoffWorkspace(): React.ReactElement {
  const {
    project,
    language,
    fontGlyphs,
    selectedScreenId,
    selectScreen,
    setHmiTags,
    updateCanvasObject,
    duplicateScreen,
    duplicateScreenLayout
  } = useProjectStore();
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'building' | 'done' | 'error'>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const [ports, setPorts] = useState<SpectroSerialPortInfo[]>([]);
  const [portPath, setPortPath] = useState('');
  const [serialStatus, setSerialStatus] = useState<SpectroSerialStatus>({ open: false, protocolConnected: false });
  const [serialBusy, setSerialBusy] = useState(false);
  const [serialLog, setSerialLog] = useState<string[]>([]);
  const labels = HANDOFF_TEXT[language];

  const screenId = selectedScreenId && project?.screens[selectedScreenId]
    ? selectedScreenId
    : project?.screenOrder[0] ?? null;
  const screen = screenId && project ? project.screens[screenId] : null;
  const textObjects = useMemo(
    () => screen?.objects.filter((object): object is TextCanvasObject => object.type === 'text') ?? [],
    [screen]
  );
  const selectedObject = textObjects.find((object) => object.id === selectedObjectId) ?? textObjects[0] ?? null;
  const fontRenderer = useMemo(() => new FontRenderer(fontGlyphs), [fontGlyphs]);
  const serialApi = window.spectroDesigner?.spectrophotometerSerial;

  useEffect(() => {
    if (!serialApi) return;
    void Promise.all([serialApi.list(), serialApi.status()]).then(([available, status]) => {
      setPorts(available);
      setSerialStatus(status);
      setPortPath(status.path ?? available[0]?.path ?? '');
    }).catch((error: unknown) => {
      setSerialLog([error instanceof Error ? error.message : String(error)]);
    });
  }, [serialApi]);

  if (!project || !screen || !screenId) {
    return <section className="workspace-empty">{labels.noProject}</section>;
  }

  const installPreset = (): void => {
    setHmiTags(
      { ...(project.tags ?? {}), ...ECROS_5300_HMI_TAGS },
      { ...(project.dataSources ?? {}), ...ECROS_5300_DATA_SOURCES }
    );
    setExportMessage(labels.presetInstalled);
  };

  const bindField = (tagId: string): void => {
    if (!selectedObject) return;
    updateCanvasObject(screenId, {
      ...selectedObject,
      bindings: {
        ...selectedObject.bindings,
        text: { kind: 'tag', tagId }
      }
    });
  };

  const exportPackage = async (): Promise<void> => {
    setExportState('building');
    setExportMessage(labels.building);
    try {
      const result = await buildHandoffPackage(project, fontGlyphs);
      const blob = new Blob([result.zip.buffer as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportState('done');
      setExportMessage(
        `${labels.ready}: ${result.manifest.files.length + 1}; ${labels.missingGlyphs}: ${result.manifest.glyphClosure.missingCharacters.length}`
      );
    } catch (error) {
      setExportState('error');
      setExportMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const refreshPorts = async (): Promise<void> => {
    if (!serialApi) return;
    const available = await serialApi.list();
    setPorts(available);
    setPortPath((current) => current || available[0]?.path || '');
  };

  const connectInstrument = async (): Promise<void> => {
    if (!serialApi || !portPath) return;
    setSerialBusy(true);
    try {
      await serialApi.open(portPath);
      const connected = await serialApi.command({ commandId: 'connect' });
      const identity = [];
      for (const commandId of ['gettype', 'getsoftver', 'getsn'] as const) {
        const result = await serialApi.command({ commandId });
        identity.push(`${commandId}: ${result.raw.trim()}`);
      }
      setSerialStatus(await serialApi.status());
      setSerialLog([`connect: ${connected.raw.trim()}`, ...identity]);
    } catch (error) {
      setSerialStatus(await serialApi.status().catch(() => ({ open: false, protocolConnected: false })));
      setSerialLog((lines) => [...lines, error instanceof Error ? error.message : String(error)]);
    } finally {
      setSerialBusy(false);
    }
  };

  const disconnectInstrument = async (): Promise<void> => {
    if (!serialApi) return;
    setSerialBusy(true);
    try {
      if (serialStatus.protocolConnected) {
        await serialApi.command({ commandId: 'quit' });
      }
      setSerialStatus(await serialApi.close());
      setSerialLog((lines) => [...lines, labels.disconnected]);
    } finally {
      setSerialBusy(false);
    }
  };

  return (
    <section className="workspace-root hmi-handoff-workspace" aria-label={labels.title} data-testid="hmi-handoff-workspace">
      <aside className="workspace-sidebar hmi-handoff-sidebar">
        <header className="workspace-section-header">
          <h2>{labels.screens}</h2>
        </header>
        <div className="entity-list">
          {project.screenOrder.map((id, index) => (
            <button
              key={id}
              type="button"
              className={`entity-card${id === screenId ? ' active' : ''}`}
              onClick={() => { selectScreen(id); setSelectedObjectId(null); }}
            >
              <span className="entity-card-label">{index + 1}. {project.screens[id]?.name ?? id}</span>
              <span className="entity-card-meta">{project.screens[id]?.objects.length ?? 0} {labels.objectsShort}</span>
            </button>
          ))}
        </div>
        <div className="hmi-handoff-clone-actions">
          <button type="button" onClick={() => duplicateScreenLayout(screenId)}>
            <Copy size={14} />{labels.cloneLayout}
          </button>
          <button type="button" onClick={() => duplicateScreen(screenId)}>
            <FileStack size={14} />{labels.cloneWithState}
          </button>
        </div>
      </aside>

      <main className="workspace-canvas-column hmi-handoff-main">
        <header className="workspace-toolbar hmi-handoff-toolbar">
          <button type="button" onClick={installPreset} data-testid="handoff-install-preset"><Tags size={15} />{labels.installPreset}</button>
          <button type="button" className="hmi-btn-primary" onClick={() => void exportPackage()} disabled={exportState === 'building'} data-testid="handoff-export-package">
            <Download size={15} />{labels.exportPackage}
          </button>
          <span role="status" className={`hmi-handoff-status ${exportState}`}>{exportMessage}</span>
        </header>

        <div className="hmi-handoff-preview-card">
          <div>
            <strong>{screen.name}</strong>
            <span>{screen.width}×{screen.height} · 1bpp · vertical-LSB</span>
          </div>
          <LCDCanvas
            canvasData={{
              stateId: screen.id,
              width: screen.width,
              height: screen.height,
              objects: screen.objects,
              selectedObjectIds: selectedObject ? [selectedObject.id] : [],
              updatedAt: screen.updatedAt
            }}
            language={language}
            fontRenderer={fontRenderer}
            interactive
            onSelectObject={(objectId) => setSelectedObjectId(objectId)}
          />
        </div>

        <section className="hmi-handoff-field-section">
          <header>
            <h3>{labels.dynamicFields}</h3>
            <span>{ECROS_5300_DYNAMIC_FIELDS.length}</span>
          </header>
          <div className="hmi-handoff-field-grid">
            {ECROS_5300_DYNAMIC_FIELDS.map((field) => {
              const bound = selectedObject?.bindings?.text?.kind === 'tag' &&
                selectedObject.bindings.text.tagId === field.tagId;
              return (
                <button
                  key={field.objectId}
                  type="button"
                  className={`hmi-handoff-field${bound ? ' active' : ''}`}
                  data-tag-id={field.tagId}
                  onClick={() => bindField(field.tagId)}
                  disabled={!selectedObject}
                  title={selectedObject ? labels.bindHint : labels.selectText}
                >
                  <span className="hmi-field-label">{field.label[language]}</span>
                  <strong>{formatHmiValue(SAMPLE_VALUES[field.tagId] ?? 0, field.format, field.unit)}</strong>
                  <code>{field.tagId}</code>
                  {bound ? <span className="hmi-binding-badge"><Link2 size={11} />{labels.bound}</span> : null}
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <aside className="workspace-inspector hmi-handoff-inspector">
        <header className="workspace-section-header"><h2>{labels.handoff}</h2></header>
        <section className="inspector-card">
          <h3>{labels.selectedText}</h3>
          <select
            value={selectedObject?.id ?? ''}
            onChange={(event) => setSelectedObjectId(event.target.value || null)}
            aria-label={labels.selectedText}
          >
            <option value="">{labels.selectText}</option>
            {textObjects.map((object) => (
              <option key={object.id} value={object.id}>
                {object.id} — {object.text[language] || object.text.en || object.text.ru}
              </option>
            ))}
          </select>
          {selectedObject ? (
            <>
              <code>{selectedObject.id}</code>
              <p>{selectedObject.bindings?.text?.kind === 'tag'
                ? selectedObject.bindings.text.tagId
                : labels.notBound}</p>
            </>
          ) : null}
        </section>
        <section className="inspector-card hmi-handoff-checklist">
          <h3>{labels.packageContents}</h3>
          <p><PackageCheck size={14} />C/H · BIN · XBM · Arduino · Rust</p>
          <p><Tags size={14} />CSV · JSON · RU/EN/ZH · {labels.glyphClosure}</p>
          <p><PlugZap size={14} />{labels.cliContracts} · {labels.formulas} · SHA-256</p>
        </section>
        <section className="inspector-card hmi-serial-card" data-testid="handoff-serial-panel">
          <h3>{labels.instrumentConnection}</h3>
          {!serialApi ? <p>{labels.desktopOnly}</p> : (
            <>
              <label>
                <span>{labels.serialPort}</span>
                <select
                  value={portPath}
                  onChange={(event) => setPortPath(event.target.value)}
                  disabled={serialStatus.open || serialBusy}
                >
                  <option value="">{labels.noPorts}</option>
                  {ports.map((port) => (
                    <option key={port.path} value={port.path}>
                      {port.path}{port.manufacturer ? ` — ${port.manufacturer}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="hmi-serial-actions">
                <button type="button" onClick={() => void refreshPorts()} disabled={serialBusy || serialStatus.open} title={labels.refreshPorts}>
                  <RefreshCw size={13} />
                </button>
                {!serialStatus.protocolConnected ? (
                  <button type="button" onClick={() => void connectInstrument()} disabled={!portPath || serialBusy}>
                    <PlugZap size={13} />{labels.connect}
                  </button>
                ) : (
                  <button type="button" onClick={() => void disconnectInstrument()} disabled={serialBusy}>
                    <Unplug size={13} />{labels.disconnect}
                  </button>
                )}
              </div>
              <p className={`hmi-serial-state ${serialStatus.protocolConnected ? 'connected' : ''}`}>
                {serialStatus.protocolConnected ? labels.connected : serialStatus.open ? labels.portOpen : labels.disconnected}
              </p>
              <pre aria-label={labels.serialLog}>{serialLog.join('\n') || labels.noSerialData}</pre>
            </>
          )}
        </section>
        <section className="inspector-card hmi-handoff-warning">
          <strong>{labels.assumption}</strong>
          <p>{labels.concentrationAssumption}</p>
        </section>
      </aside>
    </section>
  );
}

const HANDOFF_TEXT = {
  en: {
    title: 'HMI Handoff',
    screens: 'Screens',
    noProject: 'No project or screen loaded.',
    cloneLayout: 'Clone layout only',
    cloneWithState: 'Clone with FSM state',
    installPreset: 'Install ECROS preset',
    presetInstalled: 'ECROS tags and sources installed.',
    exportPackage: 'Export supplier ZIP',
    building: 'Building firmware package…',
    ready: 'Files',
    missingGlyphs: 'missing glyphs',
    dynamicFields: 'Dynamic LCD fields',
    bindHint: 'Bind the selected text object to this tag',
    selectText: 'Select a text object',
    bound: 'Bound',
    handoff: 'Supplier handoff',
    selectedText: 'Selected text',
    notBound: 'No runtime tag binding.',
    packageContents: 'Package contents',
    assumption: 'Requires confirmation',
    concentrationAssumption: 'Default concentration formula: A = m·C + k, therefore C = (A − k) / m.',
    instrumentConnection: 'Instrument connection', desktopOnly: 'Real COM connection is available in the Electron desktop build.',
    serialPort: 'COM port', noPorts: 'No serial ports', refreshPorts: 'Refresh ports', connect: 'Connect and identify',
    disconnect: 'Disconnect', connected: 'Instrument connected', portOpen: 'Port open; protocol not connected',
    disconnected: 'Disconnected', serialLog: 'Instrument CLI log', noSerialData: 'No instrument response yet.',
    objectsShort: 'objects', glyphClosure: 'glyph closure', cliContracts: 'CLI contracts', formulas: 'formulas'
  },
  ru: {
    title: 'Передача HMI',
    screens: 'Экраны',
    noProject: 'Проект или экран не загружен.',
    cloneLayout: 'Клон только макета',
    cloneWithState: 'Клон с FSM-состоянием',
    installPreset: 'Установить профиль ЭКРОС',
    presetInstalled: 'Теги и источники ЭКРОС установлены.',
    exportPackage: 'Экспорт ZIP поставщику',
    building: 'Сборка firmware-пакета…',
    ready: 'Файлов',
    missingGlyphs: 'нет глифов',
    dynamicFields: 'Динамические поля LCD',
    bindHint: 'Привязать выбранную надпись к этому тегу',
    selectText: 'Выберите надпись',
    bound: 'Привязано',
    handoff: 'Передача поставщику',
    selectedText: 'Выбранная надпись',
    notBound: 'Runtime-тег не привязан.',
    packageContents: 'Состав пакета',
    assumption: 'Требует подтверждения',
    concentrationAssumption: 'Формула по умолчанию: A = m·C + k, следовательно C = (A − k) / m.',
    instrumentConnection: 'Подключение прибора', desktopOnly: 'Реальное COM-подключение доступно в настольной Electron-версии.',
    serialPort: 'COM-порт', noPorts: 'COM-порты не найдены', refreshPorts: 'Обновить список', connect: 'Подключить и определить',
    disconnect: 'Отключить', connected: 'Прибор подключён', portOpen: 'Порт открыт, CLI connect не выполнен',
    disconnected: 'Отключено', serialLog: 'Журнал CLI прибора', noSerialData: 'Ответов прибора пока нет.',
    objectsShort: 'объектов', glyphClosure: 'набор глифов', cliContracts: 'контракты CLI', formulas: 'формулы'
  },
  zh: {
    title: 'HMI 交付',
    screens: '屏幕',
    noProject: '未加载项目或屏幕。',
    cloneLayout: '仅克隆布局',
    cloneWithState: '克隆布局和 FSM 状态',
    installPreset: '安装 ECROS 预设',
    presetInstalled: '已安装 ECROS 标签和数据源。',
    exportPackage: '导出供应商 ZIP',
    building: '正在构建固件包…',
    ready: '文件数',
    missingGlyphs: '缺失字形',
    dynamicFields: 'LCD 动态字段',
    bindHint: '将所选文本对象绑定到此标签',
    selectText: '选择文本对象',
    bound: '已绑定',
    handoff: '供应商交付',
    selectedText: '所选文本',
    notBound: '未绑定运行时标签。',
    packageContents: '交付包内容',
    assumption: '需要确认',
    concentrationAssumption: '默认浓度公式：A = m·C + k，因此 C = (A − k) / m。',
    instrumentConnection: '仪器连接', desktopOnly: '真实 COM 连接仅在 Electron 桌面版中可用。',
    serialPort: 'COM 端口', noPorts: '未找到串口', refreshPorts: '刷新端口', connect: '连接并识别',
    disconnect: '断开连接', connected: '仪器已连接', portOpen: '端口已打开，CLI 尚未连接',
    disconnected: '已断开', serialLog: '仪器 CLI 日志', noSerialData: '尚无仪器响应。',
    objectsShort: '个对象', glyphClosure: '字形集合', cliContracts: 'CLI 契约', formulas: '公式'
  }
} as const;
