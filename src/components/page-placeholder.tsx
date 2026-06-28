import type { ReactNode } from "react";
import { Badge } from "@/components/ui";

type PagePlaceholderProps = {
  title: string;
  note: string;
  children?: ReactNode;
};

/**
 * Honest placeholder for the walking skeleton: a titled section that still
 * exercises the Harbor typography, spacing, and color tokens. A "Placeholder"
 * badge makes it obvious the surrounding copy is a stub, not final content.
 */
export function PagePlaceholder({ title, note, children }: PagePlaceholderProps) {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <div className="flex flex-col gap-3">
        <Badge variant="primary" className="w-fit">
          Placeholder
        </Badge>
        <h1 className="text-h1 font-bold text-text">{title}</h1>
        <p className="max-w-2xl text-body text-text-muted">{note}</p>
      </div>
      {children ? <div className="mt-10">{children}</div> : null}
    </section>
  );
}
