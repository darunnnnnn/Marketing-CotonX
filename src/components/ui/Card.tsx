import type { ReactNode } from "react";
import "./card.css";

type CardProps = {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  flushBody?: boolean;
  className?: string;
};

export function Card({ title, action, children, flushBody, className }: CardProps) {
  return (
    <section className={["card", className].filter(Boolean).join(" ")}>
      {(title || action) && (
        <header className="card__head">
          {title && <h2 className="card__title">{title}</h2>}
          {action}
        </header>
      )}
      <div className={flushBody ? "card__body card__body--flush" : "card__body"}>{children}</div>
    </section>
  );
}
