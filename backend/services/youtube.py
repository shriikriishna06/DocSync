from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

#yt links fetch
class YouTubeService:
    def __init__(self):
        self.api_key = os.getenv("YOUTUBE_API_KEY")
        self.youtube = None

    def _client(self):
        if not self.api_key:
            raise RuntimeError("YOUTUBE_API_KEY is not set")

        if not self.youtube:
            self.youtube = build(
                "youtube",
                "v3",
                developerKey=self.api_key
            )

        return self.youtube

    def search(self, topics):
        result = []
        for topic in topics:
            query = topic
            response = (
                self._client().search()
                .list(
                    q=query,
                    part="snippet",
                    type="video",
                    maxResults=5,
                    order="relevance",
                    videoDuration="medium",
                    # regionCode="IN"
                )
            )

            try:
                response = response.execute()
            except HttpError as e:
                raise RuntimeError("YouTube API request failed") from e

            videos=[]

            for item in response.get("items",[]):
                video_id=(
                    item["id"]["videoId"]
                )

                videos.append({
                    "title":
                    item["snippet"]["title"],
                    "channel":
                    item["snippet"]["channelTitle"],
                    "thumbnail":
                    self._thumbnail_url(
                        item["snippet"]
                    ),
                    "url":
                    f"https://youtube.com/watch?v={video_id}"
                })

            result.append({
                "topic":
                topic,
                "videos":
                videos
            })
        return result

    def _thumbnail_url(self, snippet):
        thumbnails = snippet.get("thumbnails", {})
        for size in ("high", "medium", "default"):
            thumbnail = thumbnails.get(size)
            if thumbnail and thumbnail.get("url"):
                return thumbnail["url"]
        return None
