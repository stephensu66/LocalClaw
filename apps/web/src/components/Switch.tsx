import type { InputHTMLAttributes, PropsWithChildren } from 'react';

export function Switch({
  children,
  ...rest
}: PropsWithChildren<InputHTMLAttributes<HTMLInputElement>>) {
  return (
    <label className="switch">
      <input type="checkbox" {...rest} />
      <span>{children}</span>
    </label>
  );
}
