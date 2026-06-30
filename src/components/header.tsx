"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav, site } from "@/lib/site";
import {
  TopNav,
  TopNavActions,
  TopNavBrand,
  TopNavLink,
  TopNavLinks,
  TopNavMenuButton,
} from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Site header, built entirely from Canopy's TopNav Branch. The mobile menu
 * button (TopNavMenuButton) is left-aligned by Canopy itself (order-first,
 * since 0.2.1). TopNav owns its own open/close state, Esc/outside-click
 * dismissal, and closing the panel on a link tap - so this component only wires
 * routing (active state from the pathname) and drops the ThemeToggle into the
 * actions cluster. Canopy classes are merged via tailwind-merge: the sticky/
 * translucent/print overrides win over the bar defaults.
 */
export function Header() {
  const pathname = usePathname();

  return (
    <TopNav
      ariaLabel="Primary"
      className="sticky top-0 z-50 px-6 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 print:hidden"
    >
      <TopNavMenuButton />
      <TopNavBrand asChild>
        <Link href="/" className="font-bold tracking-wide uppercase">
          {site.name}
        </Link>
      </TopNavBrand>
      <TopNavLinks>
        {nav.map((item) => (
          <TopNavLink
            key={item.href}
            asChild
            active={isActive(pathname, item.href)}
          >
            <Link href={item.href}>{item.label}</Link>
          </TopNavLink>
        ))}
      </TopNavLinks>
      <TopNavActions>
        <ThemeToggle />
      </TopNavActions>
    </TopNav>
  );
}
