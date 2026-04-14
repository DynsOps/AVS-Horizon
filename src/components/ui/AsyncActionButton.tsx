import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

type AsyncActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isPending: boolean;
  pendingLabel?: string;
  loadingMode?: 'replace-content' | 'spinner-only';
};

export const AsyncActionButton: React.FC<AsyncActionButtonProps> = ({
  isPending,
  pendingLabel = 'Processing request...',
  loadingMode = 'replace-content',
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}) => {
  const isDisabled = Boolean(disabled || isPending);
  const spinner = <Loader2 size={16} className="animate-spin" aria-hidden="true" />;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isPending}
      className={className}
      {...props}
    >
      {isPending ? (
        loadingMode === 'spinner-only' ? (
          spinner
        ) : (
          <span className="inline-flex items-center gap-2">
            {spinner}
            <span>{pendingLabel}</span>
          </span>
        )
      ) : (
        children
      )}
    </button>
  );
};
