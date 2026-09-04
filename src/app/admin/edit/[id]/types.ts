import type { Post as PostBase } from "@/utils/postHelpers";

export interface ParticipantStats {
  FM_count: number | null;
  HM_count: number | null;
  UM_count: number | null;
  distance_km: number | null;
}

export interface Participant {
  name: string;
  distance: string | null;
  time: string | null;
  stats: ParticipantStats;
}

export interface MarathonMetadata {
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

export interface Media {
  uri: string;
  type: string;
}

export interface TripPost {
  postId: string;
  title: string;
  date: string;
  category: string;
  country: string | null;
  city: string | null;
  coverImage: string | null;
  isPrimary: boolean;
}

export interface PostSummary {
  id: string;
  title: string;
  event_date: string;
  cover_image?: string;
  category: string;
}

export interface TripSuggestion {
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

export interface Post extends PostBase {
  sub_categories: string[];
  is_hidden: boolean;
  cover_image?: string;
  trip_id?: string | null;
  media: Media[];
  metadata?: MarathonMetadata | null;
  title_en?: string | null;
  content_en?: string | null;
  content_status?: "pending" | "done" | "failed" | null;
}

export interface FormData {
  title: string;
  event_date: string;
  content: string;
  category: string;
  sub_categories: string[];
  tags: string;
  is_hidden: boolean;
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

export type FieldErrors = Partial<Record<string, string>>;
