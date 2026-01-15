"use client";

/**
 * React Error Boundary Component
 * Wraps components to catch errors and display fallback UI
 * Enhanced with error recovery and Sentry preparation
 */

import { Component, ReactNode } from "react";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
  retryCount: number;
}

const MAX_RETRIES = 3;

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = crypto.randomUUID
      ? crypto.randomUUID()
      : `err-${Date.now()}`;
    return { hasError: true, error, errorId, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    const { errorId } = this.state;

    logger.exception(error, {
      componentStack: errorInfo.componentStack,
      errorId,
      timestamp: new Date().toISOString(),
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Send to error reporting service (Sentry)
    // Sentry.captureException(error, {
    //   contexts: { react: { componentStack: errorInfo.componentStack } },
    //   tags: { errorId },
    // });
  }

  componentWillUnmount() {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
  }

  handleReset = () => {
    const { retryCount } = this.state;

    if (retryCount >= MAX_RETRIES) {
      logger.warn(`Max retries (${MAX_RETRIES}) reached for error boundary`);
      return;
    }

    this.setState({
      hasError: false,
      error: undefined,
      retryCount: retryCount + 1,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { retryCount } = this.state;
      const canRetry = retryCount < MAX_RETRIES;

      // Default fallback UI
      return (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="text-center">
            <p className="text-sm font-medium text-red-800">
              Something went wrong
            </p>
            <p className="mt-1 text-xs text-red-600">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              {canRetry && (
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200 transition-colors"
                >
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={this.handleReload}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Simplified error boundary for specific components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: { componentStack: string }) => void,
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback} onError={onError}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
