import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Campus Connect ErrorBoundary caught an error]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA] p-6 text-[#18233F]">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-[#E7EAF0] shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold text-[#18233F]">Something went wrong</h2>
            <p className="text-xs text-[#747D91] mt-2 leading-relaxed">
              Campus Connect encountered an unexpected issue while rendering. You can reload the page to restore your session.
            </p>
            {this.state.error?.message && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl font-mono text-left break-all border border-red-100">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-[#0F1B3D] text-[#FFC93C] font-bold text-xs hover:bg-[#18284F] transition-all inline-flex items-center justify-center gap-2 shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Campus Connect</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
