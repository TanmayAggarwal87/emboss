export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string;
          status: "processing" | "ready_for_review" | "exported" | "failed";
          created_at: string;
          page_count: number;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          status?: "processing" | "ready_for_review" | "exported" | "failed";
          created_at?: string;
          page_count: number;
          error_message?: string | null;
        };
        Update: {
          status?: "processing" | "ready_for_review" | "exported" | "failed";
          error_message?: string | null;
        };
        Relationships: [];
      };
      regions: {
        Row: {
          id: string;
          job_id: string;
          page_number: number;
          type: "text" | "diagram" | "table";
          bounding_box: Json;
          review_status: "pending" | "approved" | "edit_requested" | "rejected";
          extracted_data: Json | null;
          geometry: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          page_number: number;
          type: "text" | "diagram" | "table";
          bounding_box: Json;
          review_status?: "pending" | "approved" | "edit_requested" | "rejected";
          extracted_data?: Json | null;
          geometry?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          review_status?: "pending" | "approved" | "edit_requested" | "rejected";
          extracted_data?: Json | null;
          geometry?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "regions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      emboss_job_status: "processing" | "ready_for_review" | "exported" | "failed";
      emboss_region_type: "text" | "diagram" | "table";
      emboss_review_status: "pending" | "approved" | "edit_requested" | "rejected";
    };
    CompositeTypes: Record<string, never>;
  };
};
