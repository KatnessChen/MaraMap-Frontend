"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Check, Image as ImageIcon, AlertCircle, XCircle, Trash2, PlusCircle, Activity, Type, FileText, LayoutGrid, Tags, Eye, EyeOff, Calendar, List, MapPin, AlertTriangle, Search, X, Star, Sparkles } from "lucide-react";
import Combobox from "@/components/admin/Combobox";
import MediaManager from "@/components/admin/MediaManager";
import { getApiBase } from "@/utils/apiBase";
import {
  CONTINENTS, getCountries, getCityOptions, ALL_COUNTRIES, ALL_CITY_OPTIONS,
  DISTANCE_KM_MAP, TIME_REGEX, isValidDate,
} from "@/utils/locationData";

interface ParticipantStats {
  FM_count: number | null;
  HM_count: number | null;
  UM_count: number | null;
  distance_km: number | null;
}

interface Participant {
  name: string;
  distance: string | null;
  time: string | null;
  stats: ParticipantStats;
}

interface MarathonMetadata {
  race_name: string | null;
  country: string | null;
  city: string | null;
  continent: string | null;
  trip_id: string | null;
  mountains: string[];
  participants: Participant[];
  fallback_lat: number | null;
  fallback_lng: number | null;
}

interface Media {
  uri: string;
  type: string;
}

interface TripPost {
  postId: string;
  title: string;
  date: string;
  category: string;
  country: string | null;
  city: string | null;
  coverImage: string | null;
  isPrimary: boolean;
}

interface PostSummary {
  id: string;
  title: string;
  event_date: string;
  cover_image?: string;
  category: string;
}

interface TripSuggestion {
  postId: string;
  title: string;
  date: string;
  category: string;
  country: string | null;
  city: string | null;
  coverImage: string | null;
  daysDiff: number;
  alreadyInOtherTrip: boolean;
  reason: string;
}

interface Post {
  id: string;
  title: string;
  event_date: string;
  content: string;
  category: string;
  sub_categories: string[];
  tags: string[];
  is_hidden: boolean;
  is_personal_best: boolean;
  cover_image?: string;
  trip_id?: string | null;
  media: Media[];
  metadata?: MarathonMetadata | null;
}

interface FormData {
  title: string;
  event_date: string;
  content: string;
  category: string;
  sub_categories: string[];
  tags: string;
  is_hidden: boolean;
  is_personal_best: boolean;
  cover_image: string;
  metadata: {
    race_name: string | null;
    continent: string | null;
    country: string | null;
    city: string | null;
    participants: Participant[];
    fallback_lat: number | null;
    fallback_lng: number | null;
  };
}

type FieldErrors = Partial<Record<string, string>>;

export default function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    event_date: "",
    content: "",
    category: "",
    sub_categories: [],
    tags: "",
    is_hidden: false,
    is_personal_best: false,
    cover_image: "",
    metadata: { race_name: "", continent: "", country: "", city: "", participants: [], fallback_lat: null, fallback_lng: null },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | null; msg: string }>({ type: null, msg: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [tripPosts, setTripPosts] = useState<TripPost[]>([]);
  const [showTripSearch, setShowTripSearch] = useState(false);
  const [tripSearchQuery, setTripSearchQuery] = useState("");
  const [tripSearchResults, setTripSearchResults] = useState<PostSummary[]>([]);
  const [isTripSearching, setIsTripSearching] = useState(false);
  const [tripSuggestions, setTripSuggestions] = useState<TripSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");

  const checkAuth = () => {
    const token = localStorage.getItem("maramap_admin_token");
    const loginTime = localStorage.getItem("maramap_admin_login_time");
    if (!token || !loginTime) return null;
    if (Date.now() - parseInt(loginTime) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem("maramap_admin_token");
      localStorage.removeItem("maramap_admin_login_time");
      return null;
    }
    return token;
  };

  useEffect(() => {
    const token = checkAuth();
    if (!token) {
      router.push(`/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const fetchPost = async () => {
      try {
        const { id } = await (params as Promise<{ id: string }>);
        const apiUrl = getApiBase();
        // Send the admin token so hidden posts load — findOne filters out
        // is_hidden posts for unauthenticated (public) requests, which would
        // otherwise 404 the editor for any hidden post.
        const res = await fetch(`${apiUrl}/api/v1/posts/${id}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: Post = await res.json();
          setPost(data);
          setMedia(Array.isArray(data.media) ? data.media : []);
          setFormData({
            title: data.title || "",
            event_date: data.event_date || "",
            content: data.content || "",
            category: data.category || "",
            sub_categories: data.sub_categories || [],
            tags: (data.tags || []).join(", "),
            is_hidden: data.is_hidden || false,
            is_personal_best: data.is_personal_best === true,
            cover_image: data.cover_image || "",
            metadata: {
              race_name: data.metadata?.race_name || "",
              continent: data.metadata?.continent || "",
              country: data.metadata?.country || "",
              city: data.metadata?.city || "",
              participants: data.metadata?.participants || [],
              fallback_lat: data.metadata?.fallback_lat ?? null,
              fallback_lng: data.metadata?.fallback_lng ?? null,
            },
          });

          // Fetch sibling posts in the same trip
          const tripId = data.trip_id;
          if (tripId) {
            try {
              const tripRes = await fetch(`${apiUrl}/api/v1/posts/trip/${tripId}`, { cache: "no-store" });
              if (tripRes.ok) {
                const all: TripPost[] = await tripRes.json();
                setTripPosts(all.filter(p => p.postId !== data.id));
              }
            } catch {
              // non-critical, ignore
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch post:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPost();
  }, [params, router]);

  // ── Validation ──────────────────────────────────────────────
  const validate = (): { errors: FieldErrors; warnings: string[] } => {
    const errs: FieldErrors = {};
    const warns: string[] = [];

    if (!formData.title.trim()) errs["title"] = "標題為必填";
    if (!formData.event_date) errs["event_date"] = "活動日期為必填";
    else if (!isValidDate(formData.event_date)) errs["event_date"] = "日期格式不正確";
    if (!formData.category) errs["category"] = "類別為必填";
    if (!formData.metadata.continent?.trim()) errs["continent"] = "洲別為必填";
    if (!formData.metadata.country?.trim()) errs["country"] = "國家為必填";
    if (!formData.metadata.city?.trim()) errs["city"] = "城市為必填";
    if (!formData.content.trim()) errs["content"] = "文章內容為必填";

    formData.metadata.participants.forEach((p, idx) => {
      if (p.time && p.time !== "0:00:00" && !TIME_REGEX.test(p.time)) {
        errs[`participant_time_${idx}`] = `第 ${idx + 1} 位參賽者時間格式須為 HH:MM:SS`;
      }
    });

    if (!formData.cover_image) warns.push("尚未設定封面圖片。");

    return { errors: errs, warnings: warns };
  };

  const scrollToFirstError = (errs: FieldErrors) => {
    const order = ["title", "event_date", "category", "continent", "country", "city", "content"];
    for (const key of order) {
      if (errs[key]) {
        document.getElementById(`field-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    const participantKey = Object.keys(errs).find(k => k.startsWith("participant_time_"));
    if (participantKey) {
      document.getElementById(`field-${participantKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async (skipWarnings = false) => {
    const { errors: errs, warnings: warns } = validate();
    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      setWarnings([]);
      scrollToFirstError(errs);
      return;
    }

    if (warns.length > 0 && !skipWarnings) {
      // Show warning banner and wait for the user to confirm (which calls
      // handleSave(true)).
      setWarnings(warns);
      return;
    }
    setWarnings([]);

    const token = checkAuth();
    if (!token) { router.push("/admin/login"); return; }
    if (!post) return;

    setIsSaving(true);
    setFeedback({ type: null, msg: "" });

    try {
      const apiUrl = getApiBase();
      const res = await fetch(`${apiUrl}/api/v1/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
          media,
        }),
      });

      if (res.ok) {
        // Sync local state from the response: the backend promotes freshly
        // uploaded media out of tmp/ (and deletes the tmp copies), so the
        // returned post carries the permanent URIs. Without this, a second
        // save would resend now-deleted tmp URIs.
        const updated: Post = await res.json();
        setPost(updated);
        setMedia(Array.isArray(updated.media) ? updated.media : []);
        setFormData(f => ({ ...f, cover_image: updated.cover_image || "" }));
        setFeedback({ type: "success", msg: "文章已成功儲存！" });
        setWarnings([]);
        setTimeout(() => setFeedback({ type: null, msg: "" }), 5000);
      } else if (res.status === 401) {
        setFeedback({ type: "error", msg: "登入已過期，請重新登入。" });
        router.push("/admin/login");
      } else {
        const errorData = await res.json();
        setFeedback({ type: "error", msg: `儲存失敗：${errorData.message || "發生錯誤"}` });
      }
    } catch {
      setFeedback({ type: "error", msg: "連線失敗，請檢查網路狀態。" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!post) return;
    if (!window.confirm(`確定要刪除「${post.title || "此文章"}」嗎？此操作無法復原。`)) return;
    const token = checkAuth();
    if (!token) { router.push("/admin/login"); return; }
    try {
      const apiUrl = getApiBase();
      const res = await fetch(`${apiUrl}/api/v1/posts/${post.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.push("/admin");
      } else if (res.status === 401) {
        router.push("/admin/login");
      } else {
        const errorData = await res.json().catch(() => ({}));
        setFeedback({ type: "error", msg: `刪除失敗：${errorData.message || "發生錯誤"}` });
      }
    } catch {
      setFeedback({ type: "error", msg: "連線失敗，請檢查網路狀態。" });
    }
  };

  // ── Geocode ──────────────────────────────────────────────────
  const handleGeocode = async () => {
    const { country, city } = formData.metadata;
    if (!country?.trim() && !city?.trim()) {
      setGeocodeError("請先填寫國家或城市");
      return;
    }
    const token = checkAuth();
    if (!token) { router.push("/admin/login"); return; }

    setIsGeocoding(true);
    setGeocodeError("");
    try {
      const apiUrl = getApiBase();
      const params = new URLSearchParams();
      if (country?.trim()) params.set("country", country.trim());
      if (city?.trim()) params.set("city", city.trim());
      const res = await fetch(`${apiUrl}/api/v1/geocode?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: { lat: number | null; lng: number | null } = await res.json();
        if (data.lat != null && data.lng != null) {
          setFormData(f => ({ ...f, metadata: { ...f.metadata, fallback_lat: data.lat, fallback_lng: data.lng } }));
        } else {
          setGeocodeError("查無經緯度結果，請手動輸入");
        }
      } else if (res.status === 401) {
        setGeocodeError("登入已過期，請重新登入。");
        router.push("/admin/login");
      } else {
        setGeocodeError("查詢失敗，請稍後再試");
      }
    } catch {
      setGeocodeError("連線失敗，請檢查網路狀態。");
    } finally {
      setIsGeocoding(false);
    }
  };

  // ── Trip helpers ──────────────────────────────────────────────
  const searchForTripAdd = async (q: string) => {
    if (!q.trim()) { setTripSearchResults([]); return; }
    setIsTripSearching(true);
    try {
      const apiUrl = getApiBase();
      const res = await fetch(`${apiUrl}/api/v1/posts/search?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const json = await res.json();
        const results: PostSummary[] = json.data || json;
        const existingIds = new Set([post?.id, ...tripPosts.map(tp => tp.postId)]);
        setTripSearchResults(results.filter(p => !existingIds.has(p.id)));
      }
    } catch { /* non-critical */ }
    finally { setIsTripSearching(false); }
  };

  // Smart recommendations — same country + within ±14 days, not already in this trip.
  const fetchTripSuggestions = async () => {
    if (!post) return;
    const token = checkAuth();
    if (!token) return;
    setIsLoadingSuggestions(true);
    try {
      const apiUrl = getApiBase();
      const res = await fetch(`${apiUrl}/api/v1/posts/${post.id}/trip-suggestions`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      if (res.ok) {
        const data: TripSuggestion[] = await res.json();
        const existing = new Set([post.id, ...tripPosts.map(tp => tp.postId)]);
        setTripSuggestions(data.filter(s => !existing.has(s.postId)));
      }
    } catch { /* non-critical */ }
    finally { setIsLoadingSuggestions(false); }
  };

  const openTripAdd = () => {
    setShowTripSearch(true);
    fetchTripSuggestions();
  };

  const handleAddToTrip = async (targetPostId: string) => {
    const token = checkAuth();
    if (!token || !post) return;
    const apiUrl = getApiBase();
    const res = await fetch(`${apiUrl}/api/v1/posts/${post.id}/trip/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ postId: targetPostId }),
    });
    if (res.ok) {
      const tripArr: TripPost[] = await res.json();
      const newTripId = post.trip_id ?? post.id; // trip auto-created with this post as primary
      setPost(prev => prev ? { ...prev, trip_id: newTripId } : prev);
      setTripPosts(tripArr.filter(p => p.postId !== post.id));
      setTripSuggestions(prev => prev.filter(s => s.postId !== targetPostId));
      setTripSearchResults(prev => prev.filter(p => p.id !== targetPostId));
      setFeedback({ type: "success", msg: "已加入同行文章" });
    } else {
      const err = await res.json().catch(() => ({}));
      setFeedback({ type: "error", msg: err.message || "加入失敗" });
    }
  };

  const handleRemoveFromTrip = async (targetPostId: string) => {
    const token = checkAuth();
    if (!token) return;
    const apiUrl = getApiBase();
    const res = await fetch(`${apiUrl}/api/v1/posts/${targetPostId}/trip/remove`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const tripArr: TripPost[] = await res.json();
      if (targetPostId === post?.id) {
        setPost(prev => prev ? { ...prev, trip_id: null } : prev);
        setTripPosts([]);
      } else {
        setTripPosts(tripArr.filter(p => p.postId !== post?.id));
      }
    } else {
      const err = await res.json().catch(() => ({}));
      setFeedback({ type: "error", msg: err.message || "移除失敗" });
    }
  };

  const handleMakePrimary = async (targetPostId: string) => {
    const token = checkAuth();
    if (!token || !post) return;
    const apiUrl = getApiBase();
    const res = await fetch(`${apiUrl}/api/v1/posts/${targetPostId}/make-primary`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const tripArr: TripPost[] = await res.json();
      setPost(prev => prev ? { ...prev, trip_id: targetPostId } : prev);
      setTripPosts(tripArr.filter(p => p.postId !== post.id));
      setFeedback({ type: "success", msg: "已設為主文" });
    } else {
      const err = await res.json().catch(() => ({}));
      setFeedback({ type: "error", msg: err.message || "設定主文失敗" });
    }
  };

  // ── Participant helpers ───────────────────────────────────────
  const updateParticipant = (index: number, field: string, value: string | number | null) => {
    const newParticipants = [...formData.metadata.participants] as (Participant & Record<string, unknown>)[];
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      newParticipants[index][parent] = { ...(newParticipants[index][parent] as Record<string, unknown>), [child]: value === "" ? null : value };
    } else {
      newParticipants[index][field] = value;
      // Auto-fill distance_km when distance changes
      if (field === "distance" && typeof value === "string") {
        const km = DISTANCE_KM_MAP[value];
        if (km !== undefined) {
          newParticipants[index].stats = { ...(newParticipants[index].stats as ParticipantStats), distance_km: km };
        }
      }
    }
    setFormData({ ...formData, metadata: { ...formData.metadata, participants: newParticipants as Participant[] } });
  };

  const addParticipant = () => {
    const newP: Participant = { name: "Davis", distance: "全馬", time: "0:00:00", stats: { FM_count: null, HM_count: null, UM_count: null, distance_km: 42.195 } };
    setFormData({ ...formData, metadata: { ...formData.metadata, participants: [...formData.metadata.participants, newP] } });
  };

  const removeParticipant = (index: number) => {
    setFormData({ ...formData, metadata: { ...formData.metadata, participants: formData.metadata.participants.filter((_, i) => i !== index) } });
  };

  if (isLoading) return <div className="min-h-screen bg-paper flex items-center justify-center font-sans text-lg animate-pulse text-ink/40">正在載入文章...</div>;
  if (!post) return <div className="p-12 text-center font-sans text-xl font-bold text-ink">找不到該文章。</div>;

  const categories = ["馬拉松", "旅遊", "登山"];
  const distances = ["超馬", "全馬", "半馬"];
  const SUB_CATEGORY_MAP: Record<string, string[]> = {
    馬拉松: ["海外馬", "國內馬", "超馬(44K+)", "高山馬", "九大馬", "普查"],
    旅遊: [],
    登山: ["大百岳", "小百岳", "海外登山"],
  };
  const availableSubs = SUB_CATEGORY_MAP[formData.category] || [];

  const toggleSubCategory = (sub: string) => {
    const next = formData.sub_categories.includes(sub)
      ? formData.sub_categories.filter(s => s !== sub)
      : [...formData.sub_categories, sub];
    setFormData({ ...formData, sub_categories: next });
  };

  const errBorder = (key: string) => errors[key] ? "border-brand" : "border-line";
  const hasWarnings = warnings.length > 0;

  return (
    <div className="min-h-screen bg-paper pb-24 text-ink">
      {/* Toast feedback */}
      {feedback.type && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[2000] px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 border-2 animate-in fade-in slide-in-from-top-4 duration-300 ${feedback.type === "success" ? "bg-green-50 border-green-500 text-green-800" : "bg-red-50 border-brand text-brand"}`}>
          {feedback.type === "success" ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="font-sans text-lg font-bold">{feedback.msg}</span>
          <button onClick={() => setFeedback({ type: null, msg: "" })} className="ml-4 opacity-40 hover:opacity-100"><XCircle size={18} /></button>
        </div>
      )}

      {/* Warning banner — shown when there are soft warnings and save was attempted */}
      {hasWarnings && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-xl px-8 py-5 bg-amber-50 border-2 border-amber-400 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-sans font-black text-base text-amber-900 mb-1">儲存前請確認</p>
              <ul className="space-y-1">
                {warnings.map((w, i) => <li key={i} className="font-sans text-sm text-amber-800">· {w}</li>)}
              </ul>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setWarnings([])} className="font-sans text-sm font-bold text-amber-700 hover:text-amber-900 px-4 py-2 border border-amber-300 hover:border-amber-500 transition-colors">
              取消
            </button>
            <button onClick={() => handleSave(true)} className="font-sans text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 px-6 py-2 transition-colors">
              確認儲存
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur border-b-2 border-ink">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-12 py-3 md:py-6">
          <div className="flex items-center gap-3 md:gap-5">
            <Link href="/admin" className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-sm md:text-base font-black transition-colors">
              <ArrowLeft size={18} /> 回文章列表
            </Link>
            {post && (
              <button
                onClick={handleDelete}
                disabled={isSaving}
                title="刪除此文章"
                className="inline-flex items-center gap-1.5 text-ink/30 hover:text-brand font-sans text-sm md:text-base font-black transition-colors disabled:opacity-40"
              >
                <Trash2 size={18} /> <span className="hidden sm:inline">刪除文章</span>
              </button>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 md:gap-2">
            <button onClick={() => handleSave()} disabled={isSaving} className="bg-ink text-paper px-4 py-2 md:px-12 md:py-4 rounded-full font-sans text-sm md:text-xl font-black tracking-widest hover:bg-brand transition-all flex items-center gap-2 md:gap-3 disabled:opacity-50 shadow-2xl">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : feedback.type === "success" ? <Check size={18} /> : <Save size={18} />}
              {isSaving ? "儲存中..." : "儲存變更"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* ── Left column ── */}
          <div className="lg:col-span-8 space-y-16">

            {/* Title */}
            <div id="field-title" className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <Type size={28} className="text-brand" /> 文章標題
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => { setFormData({ ...formData, title: e.target.value }); setErrors(v => ({ ...v, title: undefined })); }}
                className={`w-full bg-white border-2 ${errBorder("title")} p-6 font-serif font-black text-4xl focus:outline-none focus:border-brand shadow-sm rounded-sm`}
              />
              {errors.title && <p className="text-brand text-sm font-sans font-bold flex items-center gap-1"><AlertCircle size={14} />{errors.title}</p>}
            </div>

            {/* Event date */}
            <div id="field-event_date" className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <Calendar size={28} className="text-brand" /> 活動日期
              </label>
              <input
                type="date"
                value={formData.event_date}
                onChange={e => { setFormData({ ...formData, event_date: e.target.value }); setErrors(v => ({ ...v, event_date: undefined })); }}
                className={`w-full bg-white border-2 ${errBorder("event_date")} p-6 font-mono text-2xl font-bold focus:outline-none focus:border-brand shadow-sm rounded-sm`}
              />
              {errors.event_date && <p className="text-brand text-sm font-sans font-bold flex items-center gap-1"><AlertCircle size={14} />{errors.event_date}</p>}
            </div>

            {/* Media & cover */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <ImageIcon size={28} className="text-brand" /> 圖片與封面
              </label>
              <MediaManager
                media={media}
                onMediaChange={setMedia}
                coverImage={formData.cover_image}
                onCoverChange={(uri) => setFormData((f) => ({ ...f, cover_image: uri }))}
                getToken={checkAuth}
                onAuthFail={() => router.push("/admin/login")}
              />
            </div>

            {/* Content */}
            <div id="field-content" className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <FileText size={28} className="text-brand" /> 文章內容
              </label>
              <textarea
                value={formData.content}
                onChange={e => { setFormData({ ...formData, content: e.target.value }); setErrors(v => ({ ...v, content: undefined })); }}
                rows={20}
                className={`w-full bg-white border-2 ${errBorder("content")} p-10 font-sans text-2xl leading-relaxed focus:outline-none focus:border-brand whitespace-pre-wrap shadow-sm rounded-sm`}
              />
              {errors.content && <p className="text-brand text-sm font-sans font-bold flex items-center gap-1"><AlertCircle size={14} />{errors.content}</p>}
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-4 space-y-16">

            {/* Category */}
            <div id="field-category" className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                <LayoutGrid size={24} className="text-brand" /> 主分類（單選）
              </label>
              <div className="relative">
                <select
                  value={formData.category}
                  onChange={e => { setFormData({ ...formData, category: e.target.value, sub_categories: [] }); setErrors(v => ({ ...v, category: undefined })); }}
                  className={`w-full bg-white border-2 ${errBorder("category")} p-5 font-sans text-lg font-black appearance-none cursor-pointer focus:border-brand outline-none shadow-sm`}
                >
                  <option value="">請選擇類別</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-xl">▼</div>
              </div>
              {errors.category && <p className="text-brand text-sm font-sans font-bold flex items-center gap-1"><AlertCircle size={14} />{errors.category}</p>}
            </div>

            {/* Sub-categories */}
            {availableSubs.length > 0 && (
              <div className="space-y-6">
                <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                  <List size={24} className="text-brand" /> 次分類（多選）
                </label>
                <div className="flex flex-wrap gap-3">
                  {availableSubs.map(sub => {
                    const active = formData.sub_categories.includes(sub);
                    return (
                      <button key={sub} type="button" onClick={() => toggleSubCategory(sub)} className={`px-4 py-2 font-sans text-sm font-bold border-2 transition-all ${active ? "bg-brand text-white border-brand" : "bg-white text-ink/60 border-line hover:border-ink/40"}`}>
                        {sub}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Location */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                <MapPin size={24} className="text-brand" /> 地點資訊
              </label>
              <div className="space-y-4">
                <div id="field-continent">
                  <label className="block font-sans text-xs font-black text-ink/40 uppercase tracking-widest mb-2">洲別</label>
                  <Combobox
                    options={CONTINENTS}
                    value={formData.metadata.continent || ""}
                    onChange={v => {
                      setFormData({ ...formData, metadata: { ...formData.metadata, continent: v, country: "", city: "" } });
                      setErrors(e => ({ ...e, continent: undefined }));
                    }}
                    placeholder="亞洲、歐洲…"
                    hasError={!!errors.continent}
                  />
                  {errors.continent && <p className="text-brand text-xs font-sans font-bold flex items-center gap-1 mt-1"><AlertCircle size={12} />{errors.continent}</p>}
                </div>
                <div id="field-country">
                  <label className="block font-sans text-xs font-black text-ink/40 uppercase tracking-widest mb-2">國家</label>
                  <Combobox
                    options={formData.metadata.continent ? getCountries(formData.metadata.continent) : ALL_COUNTRIES}
                    value={formData.metadata.country || ""}
                    onChange={v => {
                      setFormData({ ...formData, metadata: { ...formData.metadata, country: v, city: "" } });
                      setErrors(e => ({ ...e, country: undefined }));
                    }}
                    placeholder="台灣、日本…"
                    hasError={!!errors.country}
                  />
                  {errors.country && <p className="text-brand text-xs font-sans font-bold flex items-center gap-1 mt-1"><AlertCircle size={12} />{errors.country}</p>}
                </div>
                <div id="field-city">
                  <label className="block font-sans text-xs font-black text-ink/40 uppercase tracking-widest mb-2">城市</label>
                  <Combobox
                    options={
                      formData.metadata.continent && formData.metadata.country
                        ? getCityOptions(formData.metadata.continent, formData.metadata.country)
                        : ALL_CITY_OPTIONS
                    }
                    value={formData.metadata.city || ""}
                    onChange={v => {
                      setFormData({ ...formData, metadata: { ...formData.metadata, city: v } });
                      setErrors(e => ({ ...e, city: undefined }));
                    }}
                    placeholder="台北、東京…"
                    hasError={!!errors.city}
                  />
                  {errors.city && <p className="text-brand text-xs font-sans font-bold flex items-center gap-1 mt-1"><AlertCircle size={12} />{errors.city}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block font-sans text-xs font-black text-ink/40 uppercase tracking-widest">經緯度（選填）</label>
                    <button
                      type="button"
                      onClick={handleGeocode}
                      disabled={isGeocoding}
                      className="flex items-center gap-1 font-sans text-xs font-bold text-brand hover:opacity-70 disabled:opacity-40 transition-opacity"
                    >
                      {isGeocoding ? <Loader2 className="animate-spin" size={12} /> : <MapPin size={12} />}
                      {isGeocoding ? "定位中…" : "自動定位"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      step="any"
                      value={formData.metadata.fallback_lat ?? ""}
                      onChange={e => setFormData({ ...formData, metadata: { ...formData.metadata, fallback_lat: e.target.value === "" ? null : parseFloat(e.target.value) } })}
                      className="w-full bg-white border border-line p-3 font-mono text-sm focus:outline-none focus:border-brand shadow-sm"
                      placeholder="緯度 Lat"
                    />
                    <input
                      type="number"
                      step="any"
                      value={formData.metadata.fallback_lng ?? ""}
                      onChange={e => setFormData({ ...formData, metadata: { ...formData.metadata, fallback_lng: e.target.value === "" ? null : parseFloat(e.target.value) } })}
                      className="w-full bg-white border border-line p-3 font-mono text-sm focus:outline-none focus:border-brand shadow-sm"
                      placeholder="經度 Lng"
                    />
                  </div>
                  {geocodeError && <p className="text-brand text-xs font-sans font-bold flex items-center gap-1 mt-1"><AlertCircle size={12} />{geocodeError}</p>}
                </div>
                <div>
                  <label className="block font-sans text-xs font-black text-ink/40 uppercase tracking-widest mb-2">賽事名稱（選填）</label>
                  <input
                    type="text"
                    value={formData.metadata.race_name || ""}
                    onChange={e => setFormData({ ...formData, metadata: { ...formData.metadata, race_name: e.target.value } })}
                    className="w-full bg-white border border-line p-3 font-sans text-base focus:outline-none focus:border-brand shadow-sm"
                    placeholder="例如：東京馬拉松"
                  />
                </div>
              </div>
            </div>

            {/* PB flag — 馬拉松限定 */}
            {formData.category === "馬拉松" && (
              <div className="space-y-6">
                <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                  <Activity size={24} className="text-brand" /> 個人最佳成績
                </label>
                <div className="flex items-center gap-5 p-6 border-2 border-line bg-white rounded-lg shadow-sm">
                  <input
                    type="checkbox"
                    id="is_personal_best"
                    checked={formData.is_personal_best}
                    onChange={e => setFormData({ ...formData, is_personal_best: e.target.checked })}
                    className="w-7 h-7 accent-brand cursor-pointer"
                  />
                  <label htmlFor="is_personal_best" className="font-sans text-lg font-black cursor-pointer select-none">
                    此場曾創個人最佳成績
                  </label>
                </div>
              </div>
            )}

            {/* Participants */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <h3 className="font-serif font-black text-2xl flex items-center gap-3"><Activity size={24} className="text-brand" /> 成績小卡</h3>
                <button onClick={addParticipant} className="text-brand hover:opacity-70 transition-opacity"><PlusCircle size={28} /></button>
              </div>
              <div className="space-y-8">
                {formData.metadata.participants.map((p, idx) => p.name !== "Davis" ? null : (
                  <div key={idx} className="bg-white border-2 border-line p-6 shadow-sm relative space-y-6 rounded-sm">
                    <button onClick={() => removeParticipant(idx)} className="absolute top-4 right-4 text-ink/20 hover:text-brand transition-colors"><Trash2 size={18} /></button>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block font-sans text-[10px] font-black text-ink/40 uppercase tracking-widest">賽事距離</label>
                        <select value={p.distance ?? ""} onChange={e => updateParticipant(idx, "distance", e.target.value)} className="w-full bg-paper p-2 font-sans text-sm font-bold border border-line">
                          {distances.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div id={`field-participant_time_${idx}`} className="space-y-2">
                        <label className="block font-sans text-[10px] font-black text-ink/40 uppercase tracking-widest">完賽時間</label>
                        <input
                          type="text"
                          value={p.time || ""}
                          onChange={e => { updateParticipant(idx, "time", e.target.value); setErrors(v => ({ ...v, [`participant_time_${idx}`]: undefined })); }}
                          className={`w-full bg-paper p-2 font-mono text-sm font-bold border-2 ${errBorder(`participant_time_${idx}`)}`}
                          placeholder="00:00:00"
                        />
                        {errors[`participant_time_${idx}`] && <p className="text-brand text-[10px] font-sans font-bold">{errors[`participant_time_${idx}`]}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line/50">
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">里程 (km)</label>
                        <input type="number" step="0.001" value={p.stats?.distance_km ?? ""} onChange={e => updateParticipant(idx, "stats.distance_km", parseFloat(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">全馬累計</label>
                        <input type="number" value={p.stats?.FM_count ?? ""} onChange={e => updateParticipant(idx, "stats.FM_count", parseInt(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">半馬累計</label>
                        <input type="number" value={p.stats?.HM_count ?? ""} onChange={e => updateParticipant(idx, "stats.HM_count", parseInt(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">超馬累計</label>
                        <input type="number" value={p.stats?.UM_count ?? ""} onChange={e => updateParticipant(idx, "stats.UM_count", parseInt(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                <Tags size={24} className="text-brand" /> 標籤編輯
              </label>
              <input type="text" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} className="w-full bg-white border border-line p-5 font-sans text-lg focus:outline-none focus:border-brand shadow-sm" placeholder="例如：東京, 2024, 全馬" />
            </div>

            {/* Visibility */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                {formData.is_hidden ? <EyeOff size={24} className="text-brand" /> : <Eye size={24} className="text-brand" />} 顯示設定
              </label>
              <div className="flex items-center gap-5 p-6 border-2 border-line bg-white rounded-lg shadow-sm">
                <input type="checkbox" id="is_hidden" checked={formData.is_hidden} onChange={e => setFormData({ ...formData, is_hidden: e.target.checked })} className="w-7 h-7 accent-brand cursor-pointer" />
                <label htmlFor="is_hidden" className="font-sans text-lg font-black cursor-pointer select-none">隱藏此文章</label>
              </div>
            </div>

            {/* Trip siblings panel */}
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                <List size={24} className="text-brand" /> 同行程文章
              </label>

              <>
                  {/* Current post row */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-ink/5 border border-line">
                    {post.cover_image ? (
                      <div className="w-12 h-12 shrink-0 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={post.cover_image} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 shrink-0 bg-ink/10 flex items-center justify-center">
                        <MapPin size={16} className="text-ink/20" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-sm font-black text-ink leading-tight truncate">{post.title || "（無標題）"}</p>
                      <p className="font-mono text-xs text-ink/30 mt-0.5">{post.event_date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-ink/10 text-ink/50">本文</span>
                      {!post.trip_id
                        ? <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border border-dashed border-line text-ink/30">尚未組行程</span>
                        : post.id === post.trip_id
                          ? <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-brand text-white">主文</span>
                          : <>
                              <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border border-line text-ink/40">次文</span>
                              <button onClick={() => handleMakePrimary(post.id)} title="設為主文" className="p-1 text-ink/30 hover:text-brand transition-colors"><Star size={14} /></button>
                              <button onClick={() => handleRemoveFromTrip(post.id)} title="移出行程" className="p-1 text-ink/20 hover:text-brand transition-colors"><X size={14} /></button>
                            </>
                      }
                    </div>
                  </div>

                  {/* Other trip posts */}
                  {tripPosts.length > 0 && (
                    <ul className="divide-y divide-line border border-line">
                      {tripPosts.map(tp => (
                        <li key={tp.postId} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/5 transition-colors group">
                          <Link href={`/admin/edit/${tp.postId}`} className="flex items-center gap-3 flex-1 min-w-0">
                            {tp.coverImage ? (
                              <div className="w-12 h-12 shrink-0 overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={tp.coverImage} alt="" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-12 h-12 shrink-0 bg-ink/5 flex items-center justify-center">
                                <MapPin size={16} className="text-ink/20" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-sans text-sm font-black text-ink leading-tight truncate group-hover:text-brand transition-colors">
                                {tp.title || "（無標題）"}
                              </p>
                              <p className="font-mono text-xs text-ink/30 mt-0.5">{tp.date}</p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-2 shrink-0">
                            {tp.isPrimary
                              ? <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-brand text-white">主文</span>
                              : <>
                                  <span className="font-mono text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border border-line text-ink/40">次文</span>
                                  <button onClick={() => handleMakePrimary(tp.postId)} title="設為主文" className="p-1 text-ink/30 hover:text-brand transition-colors"><Star size={14} /></button>
                                </>
                            }
                            <button
                              onClick={() => handleRemoveFromTrip(tp.postId)}
                              title="從行程移除"
                              className="p-1 text-ink/20 hover:text-brand transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Add / recommend panel */}
                  {showTripSearch ? (
                    <div className="space-y-3 border border-line p-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" size={14} />
                        <input
                          type="text"
                          autoFocus
                          value={tripSearchQuery}
                          onChange={e => { setTripSearchQuery(e.target.value); searchForTripAdd(e.target.value); }}
                          placeholder="輸入關鍵字模糊搜尋…"
                          className="w-full pl-8 pr-8 py-2 border border-line font-sans text-sm focus:border-brand outline-none bg-white"
                        />
                        {tripSearchQuery && (
                          <button onClick={() => { setTripSearchQuery(""); setTripSearchResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/20 hover:text-ink">
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Keyword search results (when typing) */}
                      {tripSearchQuery ? (
                        <>
                          {isTripSearching && <p className="font-sans text-xs text-ink/30 text-center py-2">搜尋中…</p>}
                          {!isTripSearching && tripSearchResults.length === 0 && (
                            <p className="font-sans text-xs text-ink/30 text-center py-2">找不到結果</p>
                          )}
                          {tripSearchResults.length > 0 && (
                            <ul className="divide-y divide-line border border-line max-h-64 overflow-y-auto">
                              {tripSearchResults.map(p => (
                                <li key={p.id}>
                                  <button onClick={() => handleAddToTrip(p.id)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-ink/5 transition-colors text-left">
                                    {p.cover_image ? (
                                      <div className="w-10 h-10 shrink-0 overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={p.cover_image} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-10 h-10 shrink-0 bg-ink/5 flex items-center justify-center"><MapPin size={12} className="text-ink/20" /></div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-sans text-xs font-black text-ink truncate">{p.title || "（無標題）"}</p>
                                      <p className="font-mono text-[10px] text-ink/30 mt-0.5">{p.event_date}</p>
                                    </div>
                                    <PlusCircle size={14} className="shrink-0 text-brand ml-auto" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        /* Smart recommendations (when not typing) */
                        <div>
                          <p className="flex items-center gap-1.5 font-sans text-xs font-bold text-ink/40 mb-2">
                            <Sparkles size={12} className="text-brand" /> 推薦（同國・鄰近日期）
                          </p>
                          {isLoadingSuggestions && <p className="font-sans text-xs text-ink/30 text-center py-2">載入推薦中…</p>}
                          {!isLoadingSuggestions && tripSuggestions.length === 0 && (
                            <p className="font-sans text-xs text-ink/30 text-center py-2">沒有符合同國・鄰近日期的推薦，可用上方關鍵字搜尋。</p>
                          )}
                          {tripSuggestions.length > 0 && (
                            <ul className="divide-y divide-line border border-line max-h-64 overflow-y-auto">
                              {tripSuggestions.map(s => (
                                <li key={s.postId}>
                                  <button onClick={() => handleAddToTrip(s.postId)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-ink/5 transition-colors text-left">
                                    {s.coverImage ? (
                                      <div className="w-10 h-10 shrink-0 overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={s.coverImage} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-10 h-10 shrink-0 bg-ink/5 flex items-center justify-center"><MapPin size={12} className="text-ink/20" /></div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-sans text-xs font-black text-ink truncate">{s.title || "（無標題）"}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="font-mono text-[10px] text-ink/30">{s.date}</span>
                                        <span className="font-sans text-[10px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded-sm">{s.reason}</span>
                                        {s.alreadyInOtherTrip && <span className="font-sans text-[10px] text-ink/30">已屬其他行程</span>}
                                      </div>
                                    </div>
                                    <PlusCircle size={14} className="shrink-0 text-brand ml-auto" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => { setShowTripSearch(false); setTripSearchQuery(""); setTripSearchResults([]); setTripSuggestions([]); }}
                        className="font-sans text-xs text-ink/30 hover:text-ink transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={openTripAdd}
                      className="flex items-center gap-2 font-sans text-sm font-bold text-ink/40 hover:text-brand transition-colors"
                    >
                      <PlusCircle size={16} /> 增加同行文章
                    </button>
                  )}
                </>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
