export { supabase } from "@/integrations/supabase/client";

export type LeadStatus = "new" | "qualified" | "in_progress" | "won" | "lost";
export type DealStage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type ChatRole = "user" | "assistant" | "system";

export interface Lead {
  id: string;
  name: string;
  contact: string;
  channel: string;
  source: string;
  status: LeadStatus;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  lead_id: string | null;
  status: "active" | "qualified" | "closed";
  visitor_name: string;
  visitor_contact: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

export interface Deal {
  id: string;
  lead_id: string;
  title: string;
  value: number;
  stage: DealStage;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  lead_id: string;
  content: string;
  created_at: string;
}

export interface Activity {
  id: string;
  lead_id: string | null;
  type: string;
  description: string;
  created_at: string;
}
