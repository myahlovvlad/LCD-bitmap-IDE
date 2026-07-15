import React from 'react';

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('LCD-bitmap IDE renderer failed', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="fatal-error" role="alert">
        <h1>LCD-bitmap IDE</h1>
        <p>Renderer error / Ошибка интерфейса / 界面错误</p>
        <pre>{this.state.error.message}</pre>
        <button type="button" onClick={() => window.location.reload()}>
          Reload / Перезапустить / 重新加载
        </button>
      </main>
    );
  }
}
