import { api } from '../../services/api';
import { useApiMutation } from '../useApiMutation';
import type { User } from '../../types';

export function useUpdateProfile() {
  return useApiMutation(
    ({ userId, data }: { userId: string; data: Partial<User> }) =>
      api.auth.updateProfile(userId, data),
    {
      successToast: 'Profile updated',
    },
  );
}
