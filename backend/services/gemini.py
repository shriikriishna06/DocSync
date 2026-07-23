import os
import json
import logging
from pathlib import Path
from google import genai
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

#LLM for queries for RAG
class Gemini:
    def __init__(self, api_key: str):
        api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set. Add it to the project root .env file.")
        self.client = genai.Client(api_key=api_key)
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

    def _clean_text(self, text: str):
        text = (text or "").strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return text.strip()

    def generate(self,query,chunks,memory):
        context = "\n\n".join([c["content"][:1200] for c in chunks])

        history = "\n".join(
            f"{m['role']}: {m['content']}" for m in memory
        )

        PROMPT = f"""
                    You are a precise study assistant.

                    Rules:
                    - Use ONLY provided context
                    - If answer not found → say clearly
                    - Be structured
                    - Prefer bullet points

                    Chat History:
                    {history}

                    Context:
                    {context}

                    Question:
                    {query}

                    Answer:
                """

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=PROMPT
            )

            text = self._clean_text(response.text)

            if not text or len(text.split()) < 20:
                retry_prompt = PROMPT + "\n\nGive a more detailed answer."
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=retry_prompt
                )
                text = self._clean_text(response.text)

            return text

        except Exception as e:
            logger.error(f"Gemini generate error: {e}")
            return "Unable to generate a response right now. Please try again shortly."

    #quiz generator    
    def generate_quiz(self, chunks):
        context = "\n\n".join(c["content"][:1200] for c in chunks)

        PROMPT = f"""
                    You are an exam generator.
                    Generate the maximum number of HIGH QUALITY MCQs possible from the provided context.
                    Rules:
                    - Use ONLY the provided context
                    - No hallucinations
                    - Avoid repetitive questions
                    - Avoid weak/trivial questions
                    - Each question must have:
                    - question
                    - 4 options
                    - correct answer
                    - Only one correct answer
                    - Return ONLY valid JSON
                    - Do NOT return markdown
                    Format:
                    [
  {{
    "question": "...",
    "options": {{
      "A": "...",
      "B": "...",
      "C": "...",
      "D": "..."
    }},
    "answer": "A"
  }}
]
Context:
{context}
"""

        try:

            response = self.client.models.generate_content(
            model=self.model_name,
            contents=PROMPT
        )

            text = self._clean_text(response.text)
            if not text or "[" not in text:

                retry_prompt = (PROMPT+ "\n\nReturn ONLY valid JSON array.")
                response = self.client.models.generate_content(
                model=self.model_name,
                contents=retry_prompt
            )
                text = self._clean_text(response.text)
            return json.loads(text)
        except Exception as e:
            logger.error(f"Gemini quiz error: {e}")
            return {
            "error": "Unable to generate quiz right now. Please try again shortly."
        }
