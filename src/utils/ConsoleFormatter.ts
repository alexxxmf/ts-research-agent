/**
 * Console formatting utilities
 * Provides colored output and emojis for different research stages
 */

import type { ProgressStage } from '../types/index.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',

  // Colors (avoid red/orange for errors)
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',

  // Bright versions
  brightBlue: '\x1b[94m',
  brightCyan: '\x1b[96m',
  brightGreen: '\x1b[92m',
  brightMagenta: '\x1b[95m',
  brightYellow: '\x1b[93m',
};

// Stage-specific styling
const stageConfig: Record<ProgressStage, { emoji: string; color: string; label: string }> = {
  planning: {
    emoji: '🧠',
    color: colors.brightBlue,
    label: 'PLANNING'
  },
  searching: {
    emoji: '🔍',
    color: colors.brightCyan,
    label: 'SEARCHING'
  },
  scraping: {
    emoji: '📥',
    color: colors.brightMagenta,
    label: 'SCRAPING'
  },
  summarizing: {
    emoji: '📝',
    color: colors.brightGreen,
    label: 'SUMMARIZING'
  },
  evaluating: {
    emoji: '🎯',
    color: colors.magenta,
    label: 'EVALUATING'
  },
  reporting: {
    emoji: '📊',
    color: colors.green,
    label: 'REPORTING'
  }
};

export class ConsoleFormatter {
  /**
   * Format a progress message with emoji and color
   */
  static formatProgress(stage: ProgressStage, message: string, progress?: number): string {
    const config = stageConfig[stage];
    const progressBar = progress !== undefined ? ` (${progress}%)` : '';

    return `${config.emoji} ${config.color}${config.label}${colors.reset}${progressBar} ${message}`;
  }

  /**
   * Format a stage label with color
   */
  static formatStage(stage: ProgressStage): string {
    const config = stageConfig[stage];
    return `${config.emoji} ${config.color}${config.label}${colors.reset}`;
  }

  /**
   * Format a success message
   */
  static success(message: string): string {
    return `${colors.brightGreen}✅ ${message}${colors.reset}`;
  }

  /**
   * Format a warning message
   */
  static warning(message: string): string {
    return `${colors.brightYellow}⚠️  ${message}${colors.reset}`;
  }

  /**
   * Format an info message
   */
  static info(message: string): string {
    return `${colors.brightCyan}ℹ️  ${message}${colors.reset}`;
  }

  /**
   * Format a metric/stat message
   */
  static stat(message: string): string {
    return `${colors.brightMagenta}📊 ${message}${colors.reset}`;
  }

  /**
   * Check if terminal supports colors
   */
  static get supportsColor(): boolean {
    // Check common environment variables
    if (process.env.NO_COLOR || process.env.NODE_DISABLE_COLORS) {
      return false;
    }

    // Check if stdout is a TTY
    if (process.stdout && !process.stdout.isTTY) {
      return false;
    }

    // Check for color support
    if (process.env.COLORTERM || process.env.TERM === 'xterm-256color') {
      return true;
    }

    return true; // Default to color support
  }

  /**
   * Strip ANSI codes if colors not supported
   */
  private static stripColors(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Format with automatic color detection
   */
  static format(stage: ProgressStage, message: string, progress?: number): string {
    const formatted = this.formatProgress(stage, message, progress);
    return this.supportsColor ? formatted : this.stripColors(formatted);
  }
}
