import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Error boundary for one sheet of the desk (view, inspector, analysis, lab).
 * A render error in one sheet no longer unmounts the whole app: the sheet
 * shows what failed and offers to draw it again. `resetKey` (e.g. the lesson
 * id) clears the error when the student moves on.
 */
export class SheetBoundary extends Component<{ children: ReactNode; label: string; resetKey?: unknown }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(`[${this.props.label}] 그리기 오류`, error, info.componentStack);
  }
  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="grid h-full min-h-[160px] place-items-center p-4">
        <div className="max-w-[420px] rounded-[3px] border border-bad/40 bg-bad-soft px-4 py-3 text-[13px] text-ink-2">
          <div className="font-semibold text-ink">{this.props.label}을(를) 그리는 중 오류가 났다</div>
          <div className="mt-1 break-words font-mono text-[11.5px] text-ink-3">{this.state.error.message}</div>
          <button type="button" onClick={() => this.setState({ error: null })}
            className="mt-2 rounded-[3px] border border-ink px-2.5 py-1 text-[12.5px] font-medium text-ink hover:bg-paper">다시 그리기</button>
        </div>
      </div>
    );
  }
}
