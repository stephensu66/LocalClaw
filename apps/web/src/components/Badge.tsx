import type { HTMLAttributes, PropsWithChildren } from 'react';

export function Badge({ children, className = '', ...rest }: PropsWithChildren<HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span className={`badge ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}
