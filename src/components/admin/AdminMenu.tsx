"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Languages,
  LayoutList,
  LogOut,
  Menu,
  MessageCircle,
  PlusCircle,
  UploadCloud,
  X,
} from "lucide-react";
import { clearStoredToken, getStoredToken } from "@/hooks/useAdminAuth";

const ITEMS = [
  { href: "/admin", label: "文章管理", title: "搜尋和管理所有文章", icon: LayoutList },
  { href: "/admin/new", label: "新增文章", title: "手動新增單篇文章", icon: PlusCircle },
  { href: "/admin/chat", label: "足跡問答", title: "用聊天查詢文章內容", icon: MessageCircle },
  { href: "/admin/import", label: "匯入資料", title: "匯入 Facebook 資料", icon: UploadCloud },
  { href: "/admin/glossary", label: "譯名管理", title: "審核賽事、山岳和城市的英文名稱", icon: Languages },
];

const ITEM_CLASS =
  "inline-flex items-center shrink-0 gap-2 min-h-[44px] sm:px-2 whitespace-nowrap font-sans text-sm font-bold border-b-2 transition-colors";
const IDLE_CLASS = "border-transparent text-ink/60 hover:text-brand";
const ACTIVE_CLASS = "border-brand text-ink";

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/edit");
  return pathname === href || pathname.startsWith(`${href}/`);
}

const subscribeToNothing = () => () => {};

/** Stays at the top of every admin page. Sticky headers below it offset by --admin-menu-height. */
export default function AdminMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const isSignedIn = useSyncExternalStore(subscribeToNothing, () => !!getStoredToken(), () => false);
  const [isOpen, setIsOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // The bar's height changes when its items wrap or the phone menu opens.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--admin-menu-height", `${bar.offsetHeight}px`);
    });
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--admin-menu-height");
    };
  }, [isSignedIn]);

  // On the window: Safari doesn't focus a button when it's clicked.
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOnOutsidePress);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOnOutsidePress);
    };
  }, [isOpen]);

  if (!isSignedIn) return null;

  const logout = () => {
    setIsOpen(false);
    clearStoredToken();
    router.push("/admin/login");
  };

  return (
    <div ref={barRef} className="sticky top-0 z-50 shrink-0 bg-paper/95 backdrop-blur border-b border-line px-4 sm:px-6 md:px-12 py-2">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <span className="shrink-0 font-serif font-black text-base text-ink">
          MaraMap <span className="text-brand">後台</span>
        </span>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls="admin-menu"
          aria-label={isOpen ? "關閉選單" : "開啟選單"}
          className="sm:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full bg-ink/5 text-ink/60 hover:bg-ink/10 transition-colors"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav
          id="admin-menu"
          aria-label="後台選單"
          className={`${isOpen ? "flex" : "hidden"} absolute left-0 right-0 top-full flex-col gap-2 bg-paper border-b border-line shadow-lg p-4 sm:static sm:flex sm:flex-1 sm:flex-row sm:flex-wrap sm:gap-4 sm:bg-transparent sm:border-0 sm:shadow-none sm:p-0 sm:ml-4`}
        >
          {ITEMS.map(({ href, label, title, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                title={title}
                aria-current={active ? "page" : undefined}
                onClick={() => setIsOpen(false)}
                className={`${ITEM_CLASS} ${active ? ACTIVE_CLASS : IDLE_CLASS}`}
              >
                <Icon size={18} aria-hidden /> {label}
              </Link>
            );
          })}
          <Link href="/" title="回到公開網站" onClick={() => setIsOpen(false)} className={`${ITEM_CLASS} ${IDLE_CLASS} sm:ml-auto`}>
            <ArrowLeft size={18} aria-hidden /> 回網站首頁
          </Link>
          <button type="button" onClick={logout} title="登出系統" className={`${ITEM_CLASS} ${IDLE_CLASS}`}>
            <LogOut size={18} aria-hidden /> 登出
          </button>
        </nav>
      </div>
    </div>
  );
}
