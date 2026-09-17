import type { PropsWithChildren } from "react";

interface ClassNameProps {
  className?: string;
}

export const Card = ({
  className,
  ...props
}: PropsWithChildren<ClassNameProps>) => (
  <div
    className={`bg-white border border-gray-300 rounded-sm p-6 ${className ?? ""}`.trim()}
    {...props}
  />
);

export const CardTitle = ({
  className,
  ...props
}: PropsWithChildren<ClassNameProps>) => (
  <h3
    className={`text-lg font-semibold mb-4 ${className ?? ""}`.trim()}
    {...props}
  />
);

