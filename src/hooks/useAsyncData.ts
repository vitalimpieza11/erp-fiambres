import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseAsyncDataOptions<T> {
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (err: any) => void;
  immediate?: boolean;
}

export type AsyncDataCallback<T> = (data: T) => void;
export type AsyncErrorCallback = (err: any) => void;

export type AsyncFn<T> =
  | ((signal: AbortSignal) => Promise<T>)
  | ((onData: AsyncDataCallback<T>, onError: AsyncErrorCallback) => () => void);

export function useAsyncData<T>(
  asyncFn: AsyncFn<T>,
  dependencies: any[] = [],
  options: UseAsyncDataOptions<T> = {}
) {
  const [data, setData] = useState<T>(options.initialData as T);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Track mounted state to prevent memory leaks and state updates on unmounted components
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(() => {
    // 1. Cleanup any existing subscription or pending request
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Reset states safely
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let res;
      if (asyncFn.length === 1) {
        res = (asyncFn as (signal: AbortSignal) => Promise<T>)(controller.signal);
      } else {
        res = (asyncFn as (onData: AsyncDataCallback<T>, onError: AsyncErrorCallback) => () => void)(
          (updatedData: T) => {
            if (controller.signal.aborted || !isMountedRef.current) return;
            setData(updatedData);
            setError(null);
            setLoading(false);
            if (options.onSuccess) {
              options.onSuccess(updatedData);
            }
          },
          (err: any) => {
            if (controller.signal.aborted || !isMountedRef.current) return;
            console.error('useAsyncData subscription error:', err);
            setError(err instanceof Error ? err.message : String(err));
            setLoading(false);
            if (options.onError) {
              options.onError(err);
            }
          }
        );
      }

      if (res instanceof Promise) {
        res.then((val) => {
          if (controller.signal.aborted || !isMountedRef.current) return;
          setData(val);
          if (options.onSuccess) {
            options.onSuccess(val);
          }
        }).catch((err) => {
          if (controller.signal.aborted || !isMountedRef.current) return;
          if (err.name === 'AbortError') return;
          console.error('useAsyncData promise error:', err);
          setError(err instanceof Error ? err.message : String(err));
          if (options.onError) {
            options.onError(err);
          }
        }).finally(() => {
          if (controller.signal.aborted || !isMountedRef.current) return;
          setLoading(false);
        });
      } else if (typeof res === 'function') {
        // Subscription function: store the unsubscribe function
        unsubscribeRef.current = () => {
          controller.abort();
          res();
        };
      } else {
        // Fallback for immediate resolving if result is synchronous or void
        setLoading(false);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('useAsyncData execution error:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
        if (options.onError) {
          options.onError(err);
        }
      }
    }
  }, dependencies);

  useEffect(() => {
    if (options.immediate !== false) {
      execute();
    }
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [execute]);

  return {
    data,
    loading,
    error,
    refetch: execute,
    setData
  };
}
