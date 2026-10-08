import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./button.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
};

export function Button({ variant = "secondary", children, className, ...rest }: ButtonProps) {
  return (
    <button className={["btn", `btn--${variant}`, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </button>
  );
}
