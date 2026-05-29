import { useState, useCallback, useEffect } from "react";
import { docApi, ApiError } from "./api";

export interface DocRecord {
  doc_id: string;
  file_name: string;
  topics: string[];
  uploaded_at: number;
  duplicate: boolean;
}

export interface AppState {
  documents: DocRecord[];
  activeDoc: DocRecord | null;
  isLoadingDocs: boolean;
  addDocument: (doc: DocRecord) => void;
  removeDocument: (docId: string) => void;
  setActiveDoc: (doc: DocRecord | null) => void;
  resetState: () => void;
  fetchDocuments: () => Promise<void>;
}

const MAX_DOCUMENTS = 50;

export function useAppState(isAuthenticated: boolean): AppState {
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [activeDoc, setActiveDocState] = useState<DocRecord | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await docApi.fetchAll();

      const mapped: DocRecord[] = docs.map((d) => ({
        doc_id: d.doc_id,
        file_name: d.file_name,
        topics: d.topics || [],
        uploaded_at: d.created_at ? new Date(d.created_at).getTime() : 0,
        duplicate: false,
      }));

      setDocuments(mapped);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
      }
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated, fetchDocuments]);

  const addDocument = useCallback((doc: DocRecord) => {
    setDocuments((prev) => {
      const exists = prev.some((d) => d.doc_id === doc.doc_id);
      if (exists) return prev;
      if (prev.length >= MAX_DOCUMENTS) return prev;
      return [doc, ...prev];
    });
  }, []);

  const removeDocument = useCallback((docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.doc_id !== docId));
    setActiveDocState((prev) => (prev?.doc_id === docId ? null : prev));
  }, []);

  const setActiveDoc = useCallback((doc: DocRecord | null) => {
    setActiveDocState(doc);
  }, []);

  const resetState = useCallback(() => {
    setDocuments([]);
    setActiveDocState(null);
  }, []);

  return {
    documents,
    activeDoc,
    isLoadingDocs,
    addDocument,
    removeDocument,
    setActiveDoc,
    resetState,
    fetchDocuments,
  };
}
