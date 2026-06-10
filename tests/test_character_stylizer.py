from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

import numpy as np

from app.core.config import Settings
from app.pipelines.character_stylizer import build_character_style_assets
from app.pipelines.frame_processor import CandidateReference


class CharacterStylizerTests(unittest.TestCase):
    def test_build_character_style_assets_uses_fallback_when_diffusion_is_disabled(self) -> None:
        image = np.full((64, 64, 3), (80, 140, 210), dtype=np.uint8)
        references = (
            CandidateReference(
                candidate_id="face_0001",
                action="character",
                image_bgr=image,
            ),
        )

        with tempfile.TemporaryDirectory() as tmp:
            result = build_character_style_assets(
                references=references,
                output_dir=Path(tmp),
                settings=Settings(diffusion_enabled=False),
                preset_id="anime_portrait",
            )

            self.assertEqual(set(result.assets), {"face_0001"})
            self.assertEqual(result.report["generated_count"], 1)
            self.assertEqual(result.assets["face_0001"].engine, "opencv_privacy_avatar_fallback")
            self.assertTrue((Path(tmp) / "face_0001-character-style.jpg").exists())


if __name__ == "__main__":
    unittest.main()
