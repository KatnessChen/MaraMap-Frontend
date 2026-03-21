import Link from "next/link";
import PostFeed from "@/components/PostFeed";
import StatisticsBlock from "@/components/StatisticsBlock";
import { ArrowRight } from "lucide-react";
interface Post {
  id: string;
  event_date: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}

interface ApiResponse {
  data: Post[];
  meta: { total: number; limit: number; page: number; last_page: number };
}

export default async function Home() {
  let initialPosts: Post[] = [];
  let initialMeta: ApiResponse["meta"] = { total: 0, limit: 10, page: 1, last_page: 1 };
  
  // Fetch initial data from the backend
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
    const res = await fetch(`${apiUrl}/api/v1/posts?page=1&limit=10`, { 
      cache: 'no-store' 
    });
    if (res.ok) {
      const json: ApiResponse = await res.json();
      initialPosts = json.data;
      initialMeta = json.meta;
    }
  } catch (error) {
    console.error("Failed to fetch posts:", error);
  }

  return (
    <main className="min-h-screen relative overflow-x-hidden pb-24">
      {/* Background Topo - Fixed opacity & blending */}
      <div 
        className="fixed top-0 left-0 w-screen h-screen -z-10 pointer-events-none mix-blend-multiply opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 100 Q 150 200 400 50' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 200 Q 200 300 400 150' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3Cpath d='M0 300 Q 250 400 400 250' fill='none' stroke='%231a1a1a' stroke-width='0.5'/%3E%3C/svg%3E")`
        }}
      />

      <div className="max-w-3xl mx-auto">
        {/* Header - Editorial Style */}
        <header className="px-6 py-12 md:py-20 border-b-2 border-ink flex flex-col md:flex-row md:items-end justify-between gap-6 relative">
          <div>
            <h1 className="font-mono font-bold text-4xl md:text-5xl text-ink tracking-tight mb-4">
              Mara<span className="text-brand">Map</span>
            </h1>
            <p className="font-serif text-2xl font-bold text-ink-light tracking-wider leading-relaxed">
              以配速書寫地理，<br/>用腳步丈量歲月。
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-6">
            <Link 
              href="/map" 
              className="bg-ink text-paper px-6 py-2 font-mono text-sm uppercase tracking-widest hover:bg-brand transition-colors flex items-center gap-2 group"
            >
              Explore Map <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <div className="font-mono text-sm uppercase tracking-widest text-ink-light flex flex-col gap-1 md:text-right">
              <span>Vol. 1</span>
              <span>Geospatial Log</span>
            </div>
          </div>
        </header>

        {/* Aggregate Statistics Section */}
        {/* TODO  */}

        {/* Highlights - High Contrast Data Blocks */}
        <section className="px-6 py-10 bg-ink text-paper grid grid-cols-2 gap-8 border-b-[6px] border-brand shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
          <StatisticsBlock participant="Davis" />
          <StatisticsBlock participant="Rose" />
        </section>

        {/* Feed - Infinite Scroll Client Component */}
        <PostFeed initialPosts={initialPosts} initialMeta={initialMeta} />
      </div>
    </main>
  );
}
