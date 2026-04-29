from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile


@dataclass(slots=True)
class StoredMedia:
    url: str
    filename: str
    local_path: str


class LocalMockStorageService:
    def __init__(self, base_dir: Path | None = None):
        self.base_dir = base_dir or Path("./storage/access-events")
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, file: UploadFile, *, folder: str) -> StoredMedia:
        target_dir = self.base_dir / folder
        target_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(file.filename or "upload.bin").suffix
        filename = f"{uuid4().hex}{ext}"
        path = target_dir / filename
        content = await file.read()
        path.write_bytes(content)
        await file.seek(0)
        return StoredMedia(
            url=f"/mock-storage/access-events/{folder}/{filename}",
            filename=filename,
            local_path=str(path),
        )


media_storage_service = LocalMockStorageService()
