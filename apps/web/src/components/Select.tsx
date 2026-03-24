import type { SelectHTMLAttributes, PropsWithChildren } from 'react';

export function Select({ children, ...rest }: PropsWithChildren<SelectHTMLAttributes<HTMLSelectElement>>) {
  return (
    <select className="select" {...rest}>
      {children}
    </select>
  );
}
