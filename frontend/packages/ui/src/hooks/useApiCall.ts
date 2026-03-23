import { useState } from 'react';
import { useToast } from '../components/Toast';
import { getApiMessage } from '../lib/errors';

interface UseApiCallOptions {
  /**
   * Show a toast notification when the call fails. Defaults to true.
   * Set to false for forms that display inline errors instead of toasts.
   */
  showErrorToast?: boolean;
  /** Optional toast message shown on success. */
  successMessage?: string;
}

/**
 * Error handling framework hook for API calls.
 *
 * All components making API calls MUST use this hook — it manages loading
 * state, catches errors automatically, and shows toast notifications,
 * eliminating repetitive try/catch/setLoading boilerplate.
 *
 * Usage (toast on error, default):
 *   const { execute: runCode, loading } = useApiCall(async () => {
 *     const { data } = await api.post('/execute', { ... });
 *     setOutput(data.stdout);
 *   });
 *   await runCode();  // errors auto-toasted, loading auto-managed
 *
 * Usage (inline error display, forms):
 *   const { execute: doLogin, loading, error } = useApiCall(
 *     async () => { await login(email, password); navigate('/'); },
 *     { showErrorToast: false }
 *   );
 *   // `error` is the message string for inline display; null when no error
 */
export function useApiCall<T>(
  fn: () => Promise<T>,
  options: UseApiCallOptions = {}
): {
  execute: () => Promise<T | null>;
  loading: boolean;
  error: string | null;
  reset: () => void;
} {
  const { showErrorToast = true, successMessage } = options;
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function execute(): Promise<T | null> {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      if (successMessage) toast.success(successMessage);
      return result;
    } catch (err) {
      const message = getApiMessage(err, 'Something went wrong');
      setError(message);
      if (showErrorToast) toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { execute, loading, error, reset: () => setError(null) };
}
