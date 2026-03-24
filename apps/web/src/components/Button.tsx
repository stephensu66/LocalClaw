import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function Button({
  children,
  className = '',
  ...rest
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button className={`btn ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
