import os
import uuid
from pathlib import Path

import chromadb
from dotenv import load_dotenv
from rag_pipeline.embeddings import Embedder


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


# vdb config/fns
class VectorDB:
    def __init__(self):
        self.client = self._create_client()
        self.embedder = Embedder()

    def _required_env(self, *names: str):
        for name in names:
            value = os.getenv(name)
            if value:
                return value

        expected = " or ".join(names)
        raise RuntimeError(f"Missing required environment variable: {expected}")

    def _env(self, name: str, default: str):
        return os.getenv(name) or default

    def _create_client(self):
        return chromadb.CloudClient(
            cloud_port=int(self._env("CHROMA_CLOUD_PORT", "443")),
            cloud_host=self._env("CHROMA_CLOUD_HOST", "europe-west1.gcp.trychroma.com"),
            api_key=self._required_env("CHROMA_API_KEY", "CHROMA_CLOUD_API"),
            tenant=self._required_env("CHROMA_TENANT"),
            database=self._env("CHROMA_DATABASE", "DocSync"),
        )

    def _collection_name(self, user_id: str, doc_id: str):
        return f"user_{user_id}_{doc_id}"

    def _collection_names(self):
        return [
            collection.name if hasattr(collection, "name") else collection
            for collection in self.client.list_collections()
        ]

    def _get_collection(self, user_id: str, doc_id: str):
        return self.client.get_or_create_collection(
            name=self._collection_name(user_id, doc_id)
        )

    def _get_existing_collection(self, user_id: str, doc_id: str):
        try:
            return self.client.get_collection(
                name=self._collection_name(user_id, doc_id)
            )
        except Exception as exc:
            message = str(exc).lower()
            if "does not exist" in message or "not found" in message:
                return None
            raise

    def add(self, user_id: str, doc_id: str, chunks):
        collection = self._get_collection(user_id, doc_id)
        texts = [c["content"] for c in chunks]
        metadatas = []

        for c in chunks:
            metadata = dict(c["metadata"])
            metadata["doc_id"] = doc_id
            metadata["user_id"] = user_id
            metadatas.append(metadata)

        embeddings = self.embedder.embed_chunks(chunks)
        ids = [str(uuid.uuid4()) for _ in texts]

        collection.add(
            documents=texts,
            metadatas=metadatas,
            embeddings=embeddings,
            ids=ids,
        )

    def query_with_rerank(self, user_id: str, doc_id: str, query_text, top_k=15, final_k=5):
        collection = self._get_existing_collection(user_id, doc_id)
        if collection is None:
            return []

        results = collection.query(
            query_embeddings=[self.embedder.embed_query(query_text)],
            n_results=top_k,
        )

        docs = results["documents"][0]
        metas = results["metadatas"][0]
        query_words = set(query_text.lower().split())

        scored = []
        for i, doc in enumerate(docs):
            doc_words = set(doc.lower().split())
            score = len(query_words & doc_words)
            scored.append((score, doc, metas[i]))

        scored.sort(reverse=True, key=lambda x: x[0])

        return [
            {"content": d, "metadata": m}
            for _, d, m in scored[:final_k]
        ]

    def delete_user_collection(self, user_id):
        prefix = f"user_{user_id}_"
        for collection_name in self._collection_names():
            if collection_name.startswith(prefix):
                self.client.delete_collection(name=collection_name)

    def delete_document(self, user_id, doc_id):
        collection_name = self._collection_name(user_id, doc_id)
        if collection_name in self._collection_names():
            self.client.delete_collection(name=collection_name)
