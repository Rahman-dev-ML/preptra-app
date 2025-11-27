// Type definitions for revision notes
export interface RevisionNote {
  id: string;
  title: string;
  content: string;
  keyTakeaways?: string[];
  resources?: Resource[];
  importance?: 'high' | 'medium' | 'low';
  category?: string;
  topics?: string[];
}

export interface Resource {
  title: string;
  url?: string;
  type: 'book' | 'article' | 'video' | 'website' | 'pdf' | 'other';
  description?: string;
}

export interface SubjectRevisionNotes {
  subject: string;
  lastUpdated?: string;
  totalNotes?: number;
  categories?: string[];
  notes: RevisionNote[];
}

// Map of subject names to their revision notes
export type RevisionNotesMap = {
  [subject: string]: SubjectRevisionNotes;
};
