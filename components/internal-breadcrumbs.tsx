import Link from "next/link";
import { ChevronRight } from "lucide-react";
import styles from "./internal-breadcrumbs.module.css";

export type InternalBreadcrumbItem = {
  label: string;
  href?: string;
};

export function InternalBreadcrumbs({
  items,
  label = "Migas de pan",
}: {
  items: readonly InternalBreadcrumbItem[];
  label?: string;
}) {
  if (!items.length) return null;

  return (
    <nav className={styles.nav} aria-label={label}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          const content = (
            <span className={styles.label} title={item.label}>
              {item.label}
            </span>
          );

          return (
            <li className={styles.item} key={`${item.href ?? "current"}-${item.label}`}>
              {index ? <ChevronRight className={styles.separator} aria-hidden="true" /> : null}
              {current || !item.href ? (
                <span className={styles.current} aria-current={current ? "page" : undefined}>
                  {content}
                </span>
              ) : (
                <Link className={styles.link} href={item.href}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
