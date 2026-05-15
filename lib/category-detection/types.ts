export interface CategoryMatch {
  gender: string;
  category: string;
  subcategory: string | null;
  subSubcategory?: string | null;
  confidence: number; // 0 to 1
}

export interface CategoryConcept {
  concept: string;
  score: number;
  keyword: string;
}
