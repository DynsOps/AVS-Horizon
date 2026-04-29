import { useMutation, useQueryClient, MutationFunction } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { ApiError } from '../lib/apiClient';

interface UseApiMutationOptions<TData, TVariables> {
  successToast?: string;
  errorToastFallback?: string;
  invalidates?: readonly (readonly unknown[])[];
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: ApiError | Error, variables: TVariables) => void;
}

export function useApiMutation<TVariables = void, TData = unknown>(
  mutationFn: MutationFunction<TData, TVariables>,
  opts: UseApiMutationOptions<TData, TVariables> = {}
) {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  return useMutation<TData, ApiError | Error, TVariables>({
    mutationFn,
    onSuccess: (data, variables) => {
      if (opts.successToast) addToast({ title: 'Success', message: opts.successToast, type: 'success' });
      if (opts.invalidates?.length) {
        opts.invalidates.forEach((key) => queryClient.invalidateQueries({ queryKey: key as unknown[] }));
      }
      opts.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      const message = error instanceof Error ? error.message : opts.errorToastFallback ?? 'An error occurred';
      addToast({ title: 'Error', message, type: 'error' });
      opts.onError?.(error, variables);
    },
  });
}
