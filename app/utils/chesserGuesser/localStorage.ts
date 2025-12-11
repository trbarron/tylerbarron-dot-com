// LocalStorage utilities for Chesser Guesser

import { DailyGameState, EndlessModePrompt } from './types';
import { getTodayDateString } from './seededRandom';

const STORAGE_KEYS = {
  DAILY_STATE: 'chesserGuesser:dailyState',
  USERNAME: 'chesserGuesser:username',
  ENDLESS_PROMPT: 'chesserGuesser:endlessPrompt',
  ENDLESS_COUNT: 'chesserGuesser:endlessCount',
} as const;

/**
 * Save daily game state to localStorage
 */
export function saveDailyState(state: DailyGameState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_STATE, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save daily state:', e);
  }
}

/**
 * Load daily game state from localStorage
 * Returns null if no state or state is from a different day
 */
export function loadDailyState(): DailyGameState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DAILY_STATE);
    if (!stored) return null;

    const state: DailyGameState = JSON.parse(stored);

    // Check if state is from today
    if (state.date !== getTodayDateString()) {
      // Clear old state
      clearDailyState();
      return null;
    }

    return state;
  } catch (e) {
    console.warn('Failed to load daily state:', e);
    return null;
  }
}

/**
 * Clear daily game state
 */
export function clearDailyState(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.DAILY_STATE);
  } catch (e) {
    console.warn('Failed to clear daily state:', e);
  }
}

/**
 * Save username to localStorage
 */
export function saveUsername(username: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USERNAME, username);
  } catch (e) {
    console.warn('Failed to save username:', e);
  }
}

/**
 * Load username from localStorage
 */
export function loadUsername(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.USERNAME);
  } catch (e) {
    console.warn('Failed to load username:', e);
    return null;
  }
}

/**
 * Save endless mode game count
 */
export function incrementEndlessCount(): number {
  try {
    const current = parseInt(localStorage.getItem(STORAGE_KEYS.ENDLESS_COUNT) || '0', 10);
    const newCount = current + 1;
    localStorage.setItem(STORAGE_KEYS.ENDLESS_COUNT, newCount.toString());
    return newCount;
  } catch (e) {
    console.warn('Failed to increment endless count:', e);
    return 0;
  }
}

/**
 * Get current endless mode game count
 */
export function getEndlessCount(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEYS.ENDLESS_COUNT) || '0', 10);
  } catch (e) {
    console.warn('Failed to get endless count:', e);
    return 0;
  }
}

/**
 * Reset endless mode game count
 */
export function resetEndlessCount(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ENDLESS_COUNT, '0');
  } catch (e) {
    console.warn('Failed to reset endless count:', e);
  }
}

/**
 * Check if should show endless mode prompt
 * Show after 3-5 games (randomly determined per session)
 */
export function shouldShowEndlessPrompt(): boolean {
  try {
    const count = getEndlessCount();
    const promptData = localStorage.getItem(STORAGE_KEYS.ENDLESS_PROMPT);

    if (!promptData) {
      // First time - set random threshold between 3-5
      const threshold = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
      const data: EndlessModePrompt = {
        show: false,
        gamesPlayed: count,
        threshold
      };
      localStorage.setItem(STORAGE_KEYS.ENDLESS_PROMPT, JSON.stringify(data));
      return false;
    }

    const data: EndlessModePrompt = JSON.parse(promptData);

    // Update games played
    data.gamesPlayed = count;

    // Show prompt if threshold reached and not already shown
    if (count >= data.threshold && !data.show) {
      data.show = true;
      localStorage.setItem(STORAGE_KEYS.ENDLESS_PROMPT, JSON.stringify(data));
      return true;
    }

    return false;
  } catch (e) {
    console.warn('Failed to check endless prompt:', e);
    return false;
  }
}

/**
 * Dismiss the endless mode prompt
 */
export function dismissEndlessPrompt(): void {
  try {
    const promptData = localStorage.getItem(STORAGE_KEYS.ENDLESS_PROMPT);
    if (promptData) {
      const data: EndlessModePrompt = JSON.parse(promptData);
      data.show = false;
      localStorage.setItem(STORAGE_KEYS.ENDLESS_PROMPT, JSON.stringify(data));
    }
  } catch (e) {
    console.warn('Failed to dismiss endless prompt:', e);
  }
}

/**
 * Clear all Chesser Guesser data from localStorage
 */
export function clearAllData(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (e) {
    console.warn('Failed to clear all data:', e);
  }
}
