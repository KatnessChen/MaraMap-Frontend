import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Drop-in replacements for next/link and next/navigation that prefix hrefs
// with the current locale automatically. Public components should import
// from here instead of "next/link" / "next/navigation".
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
