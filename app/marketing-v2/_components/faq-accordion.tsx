"use client";

import { ChevronDown } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { faqItems } from "./landing-data";
import styles from "../page.module.css";

export function FaqAccordion() {
  const [openItems, setOpenItems] = useState<ReadonlySet<string>>(
    () => new Set([faqItems[0].id]),
  );
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const toggle = (id: string) => {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle(faqItems[index].id);
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % faqItems.length;
    if (event.key === "ArrowUp") nextIndex = (index - 1 + faqItems.length) % faqItems.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = faqItems.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div className={styles.faqList}>
      {faqItems.map((item, index) => {
        const open = openItems.has(item.id);
        return (
          <article key={item.id} className={styles.faqItem}>
            <h3>
              <button
                ref={(element) => {
                  buttonRefs.current[index] = element;
                }}
                id={`faq-control-${item.id}`}
                type="button"
                aria-expanded={open}
                aria-controls={`faq-panel-${item.id}`}
                onClick={() => toggle(item.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                <span>{item.question}</span>
                <ChevronDown aria-hidden="true" />
              </button>
            </h3>
            <div
              id={`faq-panel-${item.id}`}
              className={styles.faqPanel}
              role="region"
              aria-labelledby={`faq-control-${item.id}`}
              hidden={!open}
            >
              <p>{item.answer}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
