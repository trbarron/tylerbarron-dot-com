import { useState, useEffect } from 'react';

/**
 * Custom hook for syncing state with localStorage.
 * SSR-safe: Returns initialValue during server-side rendering and hydrates from localStorage on client.
 *
 * @param key - The localStorage key
 * @param initialValue - The initial value if no stored value exists
 * @returns A tuple of [value, setValue] similar to useState
 *
 * @example
 * ```tsx
 * const [username, setUsername] = useLocalStorage('username', 'Guest');
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Initialize with initialValue to ensure server and client match during SSR
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Hydrate from localStorage after mount (client-side only)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Update localStorage when value changes
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function for same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      // Only access localStorage on the client
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
