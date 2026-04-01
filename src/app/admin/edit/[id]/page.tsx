"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Check, Image as ImageIcon, AlertCircle, XCircle, Trash2, PlusCircle, User, Activity, Type, FileText, LayoutGrid, Tags, Eye, EyeOff } from "lucide-react";

// --- API Data Interfaces ---
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
  trip_id: string | null;
  continent: string | null;
  mountains: string[];
  participants: Participant[];
}

interface Media {
  uri: string;
  type: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_hidden: boolean;
  cover_image?: string;
  media: Media[];
  metadata?: MarathonMetadata | null;
}

interface FormData {
  title: string;
  content: string;
  category: string;
  tags: string;
  is_hidden: boolean;
  cover_image: string;
  metadata: {
    race_name: string | null;
    country: string | null;
    city: string | null;
    participants: Participant[];
  };
}

export default function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    content: "",
    category: "",
    tags: "",
    is_hidden: false,
    cover_image: "",
    metadata: {
      race_name: "",
      country: "",
      city: "",
      participants: []
    }
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | null, msg: string }>({ type: null, msg: "" });

  // 驗證 Token 是否有效且未過期
  const checkAuth = () => {
    const token = localStorage.getItem("maramap_admin_token");
    const loginTime = localStorage.getItem("maramap_admin_login_time");
    
    if (!token || !loginTime) return null;

    const oneHour = 60 * 60 * 1000;
    const now = Date.now();
    
    if (now - parseInt(loginTime) > oneHour) {
      localStorage.removeItem("maramap_admin_token");
      localStorage.removeItem("maramap_admin_login_time");
      return null;
    }
    
    return token;
  };

  useEffect(() => {
    const token = checkAuth();
    if (!token) {
      router.push("/admin/login");
      return;
    }

    const fetchPost = async () => {
      try {
        const { id } = await (params as Promise<{ id: string }>);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
        const res = await fetch(`${apiUrl}/api/v1/posts/${id}`, { cache: 'no-store' });
        if (res.ok) {
          const data: Post = await res.json();
          setPost(data);
          setFormData({
            title: data.title || "",
            content: data.content || "",
            category: data.category || "",
            tags: (data.tags || []).join(", "),
            is_hidden: data.is_hidden || false,
            cover_image: data.cover_image || "",
            metadata: data.metadata || { race_name: "", country: "", city: "", participants: [] }
          });
        }
      } catch (error) {
        console.error("Failed to fetch post:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPost();
  }, [params, router]);

  const handleSave = async () => {
    const token = checkAuth();
    if (!token) {
      router.push("/admin/login");
      return;
    }

    if (!post) return;
    setIsSaving(true);
    setFeedback({ type: null, msg: "" });
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
      const res = await fetch(`${apiUrl}/api/v1/posts/${post.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean)
        }),
      });
      
      if (res.ok) {
        setFeedback({ type: 'success', msg: "文章已成功儲存！" });
        setTimeout(() => setFeedback({ type: null, msg: "" }), 5000);
      } else if (res.status === 401) {
        setFeedback({ type: 'error', msg: "登入已過期，請重新登入。" });
        router.push("/admin/login");
      } else {
        const errorData = await res.json();
        setFeedback({ type: 'error', msg: `儲存失敗：${errorData.message || '發生錯誤'}` });
      }
    } catch (error) {
      setFeedback({ type: 'error', msg: "連線失敗，請檢查網路狀態。" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateParticipant = (index: number, field: string, value: string | number | null) => {
    const newParticipants = [...formData.metadata.participants] as (Participant & Record<string, unknown>)[];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      newParticipants[index][parent] = { ...(newParticipants[index][parent] as Record<string, unknown>), [child]: value === "" ? null : value };
    } else {
      newParticipants[index][field] = value;
    }
    setFormData({ ...formData, metadata: { ...formData.metadata, participants: newParticipants as Participant[] } });
  };

  const addParticipant = () => {
    const newParticipant: Participant = {
      name: "Davis",
      distance: "全馬",
      time: "0:00:00",
      stats: { FM_count: null, HM_count: null, UM_count: null, distance_km: 42.195 }
    };
    setFormData({ ...formData, metadata: { ...formData.metadata, participants: [...formData.metadata.participants, newParticipant] } });
  };

  const removeParticipant = (index: number) => {
    const newParticipants = formData.metadata.participants.filter((_: Participant, i: number) => i !== index);
    setFormData({ ...formData, metadata: { ...formData.metadata, participants: newParticipants } });
  };

  if (isLoading) return <div className="min-h-screen bg-paper flex items-center justify-center font-sans text-lg animate-pulse text-ink/40">正在載入紀錄...</div>;
  if (!post) return <div className="p-12 text-center font-sans text-xl font-bold text-ink">找不到該文章。</div>;

  const categories = ["馬拉松", "海外馬", "國內馬", "旅遊", "跑步訓練", "日常生活"];
  const distances = ["全馬", "半馬", "超馬", "10K", "5K"];

  return (
    <div className="min-h-screen bg-paper pb-24 text-ink">
      {feedback.type && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[2000] px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 border-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
          feedback.type === 'success' ? "bg-green-50 border-green-500 text-green-800" : "bg-red-50 border-brand text-brand"
        }`}>
          {feedback.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="font-sans text-lg font-bold">{feedback.msg}</span>
          <button onClick={() => setFeedback({ type: null, msg: "" })} className="ml-4 opacity-40 hover:opacity-100"><XCircle size={18} /></button>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6 md:p-12">
        <header className="flex items-center justify-between mb-12 border-b-2 border-ink pb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-ink/40 hover:text-brand font-sans text-base font-black transition-colors">
            <ArrowLeft size={20} /> 回文章列表
          </Link>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-ink text-paper px-12 py-4 rounded-full font-sans text-xl font-black tracking-widest hover:bg-brand transition-all flex items-center gap-3 disabled:opacity-50 shadow-2xl"
          >
            {isSaving ? <Loader2 className="animate-spin" size={24} /> : feedback.type === 'success' ? <Check size={24} /> : <Save size={24} />}
            {isSaving ? "儲存中..." : "儲存變更"}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8 space-y-16">
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <Type size={28} className="text-brand" /> 文章標題
              </label>
              <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-white border border-line p-6 font-serif font-black text-4xl focus:outline-none focus:border-brand shadow-sm rounded-sm" />
            </div>

            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <ImageIcon size={28} className="text-brand" /> 設定封面圖片
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 bg-white p-6 border border-line shadow-sm">
                {post.media && post.media.filter(m => m.type !== 'video').map((m, idx) => (
                  <button key={idx} onClick={() => setFormData({ ...formData, cover_image: m.uri })} className={`relative aspect-square border-2 transition-all overflow-hidden rounded-md ${formData.cover_image === m.uri ? "border-brand ring-4 ring-brand/10 shadow-lg scale-[1.05] z-10" : "border-line opacity-40 hover:opacity-100"}`}>
                    <img src={m.uri} alt="預覽" className="w-full h-full object-cover" />
                    {formData.cover_image === m.uri && <div className="absolute top-2 right-2 bg-brand text-white p-1 rounded-full shadow-md"><Check size={12} /></div>}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-3xl border-b border-line pb-4">
                <FileText size={28} className="text-brand" /> 文章內容
              </label>
              <textarea value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} rows={20} className="w-full bg-white border border-line p-10 font-sans text-2xl leading-relaxed focus:outline-none focus:border-brand whitespace-pre-wrap shadow-sm rounded-sm" />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-16">
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                <LayoutGrid size={24} className="text-brand" /> 文章類別
              </label>
              <div className="relative">
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full bg-white border border-line p-5 font-sans text-lg font-black appearance-none cursor-pointer focus:border-brand outline-none shadow-sm">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-xl">▼</div>
              </div>
            </div>

            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                <Tags size={24} className="text-brand" /> 標籤編輯
              </label>
              <input type="text" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} className="w-full bg-white border border-line p-5 font-sans text-lg focus:outline-none focus:border-brand shadow-sm" placeholder="例如：東京, 2024, 全馬" />
            </div>

            <div className="space-y-6">
              <label className="flex items-center gap-3 font-serif font-black text-2xl border-b border-line pb-4">
                {formData.is_hidden ? <EyeOff size={24} className="text-brand" /> : <Eye size={24} className="text-brand" />} 顯示設定
              </label>
              <div className="flex items-center gap-5 p-6 border-2 border-line bg-white rounded-lg shadow-sm">
                <input type="checkbox" id="is_hidden" checked={formData.is_hidden} onChange={e => setFormData({ ...formData, is_hidden: e.target.checked })} className="w-7 h-7 accent-brand cursor-pointer" />
                <label htmlFor="is_hidden" className="font-sans text-lg font-black cursor-pointer select-none">隱藏此文章</label>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <h3 className="font-serif font-black text-2xl flex items-center gap-3"><Activity size={24} className="text-brand" /> 成績小卡</h3>
                <button onClick={addParticipant} className="text-brand hover:opacity-70 transition-opacity"><PlusCircle size={28} /></button>
              </div>

              <div className="space-y-8">
                {formData.metadata.participants.map((p, idx) => (
                  <div key={idx} className="bg-white border-2 border-line p-6 shadow-sm relative space-y-6 rounded-sm">
                    <button onClick={() => removeParticipant(idx)} className="absolute top-4 right-4 text-ink/20 hover:text-brand transition-colors"><Trash2 size={18} /></button>
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 font-sans text-xs font-black text-ink/40 uppercase tracking-widest"><User size={12} /> 參賽者</label>
                      <select value={p.name} onChange={e => updateParticipant(idx, 'name', e.target.value)} className="w-full bg-paper p-2 font-sans text-base font-bold border border-line">
                        <option value="Davis">Davis</option>
                        <option value="Rose">Rose</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block font-sans text-[10px] font-black text-ink/40 uppercase tracking-widest">賽事距離</label>
                        <select value={p.distance ?? ""} onChange={e => updateParticipant(idx, 'distance', e.target.value)} className="w-full bg-paper p-2 font-sans text-sm font-bold border border-line">
                          {distances.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block font-sans text-[10px] font-black text-ink/40 uppercase tracking-widest">完賽時間</label>
                        <input type="text" value={p.time || ""} onChange={e => updateParticipant(idx, 'time', e.target.value)} className="w-full bg-paper p-2 font-mono text-sm font-bold border border-line" placeholder="0:00:00" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line/50">
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">里程 (km)</label>
                        <input type="number" step="0.001" value={p.stats?.distance_km || ""} onChange={e => updateParticipant(idx, 'stats.distance_km', parseFloat(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">全馬累計</label>
                        <input type="number" value={p.stats?.FM_count || ""} onChange={e => updateParticipant(idx, 'stats.FM_count', parseInt(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">半馬累計</label>
                        <input type="number" value={p.stats?.HM_count || ""} onChange={e => updateParticipant(idx, 'stats.HM_count', parseInt(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                      <div className="space-y-1">
                        <label className="block font-sans text-[9px] font-black text-ink/30 uppercase tracking-tighter">超馬累計</label>
                        <input type="number" value={p.stats?.UM_count || ""} onChange={e => updateParticipant(idx, 'stats.UM_count', parseInt(e.target.value))} className="w-full bg-paper p-1.5 font-mono text-xs border border-line" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
