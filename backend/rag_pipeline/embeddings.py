from sentence_transformers import SentenceTransformer

#vector embeddings
class Embedder:
    def __init__(self, model_name="all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None

    @property
    def model(self):
        if self._model is None:
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def embed_chunks(self, chunks):
        texts = [c["content"] for c in chunks]
        embeddings = self.model.encode(
            texts,
            batch_size=32,
            show_progress_bar=True,
            normalize_embeddings=True
        )
        return embeddings.tolist()

    def embed_query(self, query: str):
        return self.model.encode(
            [query],
            normalize_embeddings=True
        )[0].tolist()
