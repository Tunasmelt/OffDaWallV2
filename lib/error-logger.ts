/**
 * Error Logging and Reporting
 * Centralized error handling and logging for production
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorLog {
  id: string;
  message: string;
  severity: ErrorSeverity;
  context: Record<string, unknown>;
  stack?: string;
  timestamp: number;
  userAgent?: string;
  url?: string;
}

class ErrorLogger {
  private errors: ErrorLog[] = [];
  private maxErrorsSize = 500;

  /**
   * Log an error
   */
  log(
    error: Error | string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Record<string, unknown> = {}
  ): void {
    const errorLog: ErrorLog = {
      id: this.generateId(),
      message: typeof error === 'string' ? error : error.message,
      severity,
      context,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    this.errors.push(errorLog);

    // Keep only recent errors
    if (this.errors.length > this.maxErrorsSize) {
      this.errors.shift();
    }

    // Log to console based on severity
    const logMethod = this.getLogMethod(severity);
    logMethod('[OffDaWallV2] Error logged:', {
      severity,
      message: errorLog.message,
      context,
    });

    // In production, you could send to external service like Sentry
    if (process.env.NODE_ENV === 'production' && severity === ErrorSeverity.CRITICAL) {
      this.reportToExternalService(errorLog);
    }
  }

  /**
   * Log API error
   */
  logAPIError(
    endpoint: string,
    error: Error | string,
    statusCode?: number,
    context: Record<string, unknown> = {}
  ): void {
    const severity = this.determineAPISeverity(statusCode);
    this.log(error, severity, {
      ...context,
      endpoint,
      statusCode,
      type: 'API_ERROR',
    });
  }

  /**
   * Log client error
   */
  logClientError(
    error: Error | string,
    componentName?: string,
    context: Record<string, unknown> = {}
  ): void {
    this.log(error, ErrorSeverity.MEDIUM, {
      ...context,
      componentName,
      type: 'CLIENT_ERROR',
    });
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): ErrorLog[] {
    return this.errors.slice(-limit).reverse();
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorLog[] {
    return this.errors.filter(e => e.severity === severity).reverse();
  }

  /**
   * Get error count summary
   */
  getSummary(): Record<ErrorSeverity, number> {
    return {
      [ErrorSeverity.LOW]: this.errors.filter(e => e.severity === ErrorSeverity.LOW).length,
      [ErrorSeverity.MEDIUM]: this.errors.filter(e => e.severity === ErrorSeverity.MEDIUM).length,
      [ErrorSeverity.HIGH]: this.errors.filter(e => e.severity === ErrorSeverity.HIGH).length,
      [ErrorSeverity.CRITICAL]: this.errors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
    };
  }

  /**
   * Clear errors
   */
  clear(): void {
    this.errors = [];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLogMethod(severity: ErrorSeverity): typeof console.log {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return console.error;
      case ErrorSeverity.MEDIUM:
        return console.warn;
      default:
        return console.log;
    }
  }

  private determineAPISeverity(statusCode?: number): ErrorSeverity {
    if (!statusCode) return ErrorSeverity.MEDIUM;
    if (statusCode >= 500) return ErrorSeverity.HIGH;
    if (statusCode === 429) return ErrorSeverity.MEDIUM;
    if (statusCode >= 400) return ErrorSeverity.LOW;
    return ErrorSeverity.LOW;
  }

  private reportToExternalService(errorLog: ErrorLog): void {
    // In production, send to Sentry, LogRocket, etc.
    console.log('[OffDaWallV2] Would send to external error tracking:', errorLog);
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

// Global error handler for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorLogger.logClientError(event.error, undefined, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorLogger.logClientError(
      event.reason instanceof Error ? event.reason : String(event.reason),
      undefined,
      { type: 'UNHANDLED_REJECTION' }
    );
  });
}

