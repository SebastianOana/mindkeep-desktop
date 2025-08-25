// Enhanced logging system for MindKeep
class Logger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Keep last 1000 logs
        this.logLevel = 'info'; // debug, info, warn, error
    }

    // Set log level
    setLevel(level) {
        this.logLevel = level;
    }

    // Log levels hierarchy
    getLevelValue(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        return levels[level] || 1;
    }

    // Should log based on current level
    shouldLog(level) {
        return this.getLevelValue(level) >= this.getLevelValue(this.logLevel);
    }

    // Core logging function
    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            stack: level === 'error' ? new Error().stack : null
        };

        this.logs.push(logEntry);

        // Keep only the last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Console output with styling
        const styles = {
            debug: 'color: #888',
            info: 'color: #4a9eff',
            warn: 'color: #f39c12; font-weight: bold',
            error: 'color: #e74c3c; font-weight: bold'
        };

        console.log(
            `%c[${timestamp}] ${level.toUpperCase()}: ${message}`,
            styles[level] || '',
            data || ''
        );

        // For errors, also log the stack trace
        if (level === 'error' && logEntry.stack) {
            console.error(logEntry.stack);
        }
    }

    // Convenience methods
    debug(message, data) {
        this.log('debug', message, data);
    }

    info(message, data) {
        this.log('info', message, data);
    }

    warn(message, data) {
        this.log('warn', message, data);
    }

    error(message, data) {
        this.log('error', message, data);
    }

    // Get logs for debugging
    getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return this.logs;
    }

    // Clear logs
    clear() {
        this.logs = [];
        this.info('Logs cleared');
    }

    // Export logs as JSON
    export() {
        return JSON.stringify(this.logs, null, 2);
    }

    // Performance timing
    time(label) {
        this.debug(`Timer started: ${label}`);
        console.time(label);
    }

    timeEnd(label) {
        console.timeEnd(label);
        this.debug(`Timer ended: ${label}`);
    }

    // Memory usage (if available)
    logMemoryUsage() {
        if (performance.memory) {
            const memory = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
            this.info('Memory usage', memory);
        }
    }
}

// Error handling utilities
class ErrorHandler {
    constructor(logger) {
        this.logger = logger;
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logger.error('Unhandled promise rejection', {
                reason: event.reason,
                promise: event.promise
            });
            
            // Show user-friendly error
            if (window.showAlert) {
                window.showAlert('❌ Error', 'An unexpected error occurred. Please try again.');
            }
        });

        // Handle general errors
        window.addEventListener('error', (event) => {
            this.logger.error('Global error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });
    }

    // Wrap async functions with error handling
    async wrapAsync(fn, context = 'Unknown operation') {
        try {
            this.logger.debug(`Starting: ${context}`);
            const result = await fn();
            this.logger.debug(`Completed: ${context}`);
            return result;
        } catch (error) {
            this.logger.error(`Failed: ${context}`, error);
            throw error;
        }
    }

    // Wrap functions with try-catch
    wrap(fn, context = 'Unknown operation') {
        try {
            this.logger.debug(`Executing: ${context}`);
            const result = fn();
            this.logger.debug(`Completed: ${context}`);
            return result;
        } catch (error) {
            this.logger.error(`Failed: ${context}`, error);
            throw error;
        }
    }
}

// Performance monitor
class PerformanceMonitor {
    constructor(logger) {
        this.logger = logger;
        this.metrics = new Map();
    }

    // Start measuring an operation
    start(operation) {
        this.metrics.set(operation, performance.now());
        this.logger.debug(`Performance tracking started: ${operation}`);
    }

    // End measuring and log the result
    end(operation) {
        const startTime = this.metrics.get(operation);
        if (startTime) {
            const duration = performance.now() - startTime;
            this.metrics.delete(operation);
            this.logger.info(`Performance: ${operation} took ${duration.toFixed(2)}ms`);
            return duration;
        }
        this.logger.warn(`Performance tracking not found for: ${operation}`);
        return null;
    }

    // Measure a function execution
    async measure(operation, fn) {
        this.start(operation);
        try {
            const result = await fn();
            this.end(operation);
            return result;
        } catch (error) {
            this.end(operation);
            throw error;
        }
    }
}

// Create global instances
const logger = new Logger();
const errorHandler = new ErrorHandler(logger);
const performanceMonitor = new PerformanceMonitor(logger);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Logger, ErrorHandler, PerformanceMonitor, logger, errorHandler, performanceMonitor };
} else {
    window.Logger = Logger;
    window.ErrorHandler = ErrorHandler;
    window.PerformanceMonitor = PerformanceMonitor;
    window.logger = logger;
    window.errorHandler = errorHandler;
    window.performanceMonitor = performanceMonitor;
}
