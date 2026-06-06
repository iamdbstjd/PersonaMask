from __future__ import annotations

from collections import Counter
from pathlib import Path
import tempfile
import unittest

import cv2

from app.pipelines.frame_processor import CandidateReference, apply_video_review_effects, identity_detector_available
from app.services.video_candidate_service import extract_video_face_candidates


TEST_VIDEO = Path(__file__).resolve().parents[1] / "test_video.mp4"


@unittest.skipUnless(TEST_VIDEO.exists(), "test_video.mp4 is required for real-video identity regression")
@unittest.skipUnless(identity_detector_available(), "InsightFace buffalo_l models are required for identity regression")
class TestVideoIdentityQuality(unittest.TestCase):
    def test_test_video_clusters_three_people_and_matches_detected_faces(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            candidate_dir = Path(temp_dir) / "candidates"
            candidates = extract_video_face_candidates(TEST_VIDEO, candidate_dir, max_frames=90, max_candidates=6)

            self.assertEqual(len(candidates), 3)
            self.assertTrue(all(candidate.embedding is not None for candidate in candidates))
            self.assertGreaterEqual(min(candidate.cluster_size for candidate in candidates), 10)

            references = [
                CandidateReference(
                    candidate_id=candidate.candidate_id,
                    action="preserve",
                    image_bgr=cv2.imread(str(candidate.image_path)),
                    embedding=candidate.embedding,
                )
                for candidate in candidates
            ]

            capture = cv2.VideoCapture(str(TEST_VIDEO))
            self.assertTrue(capture.isOpened())
            frame_index = 0
            sampled_frames = 0
            frames_with_faces = 0
            frames_with_matches = 0
            candidate_matches: Counter[str] = Counter()
            try:
                while True:
                    ok, frame = capture.read()
                    if not ok:
                        break
                    if frame_index % 6 != 0:
                        frame_index += 1
                        continue

                    result = apply_video_review_effects(
                        frame,
                        mode="blur",
                        blur_faces=True,
                        blur_plates=False,
                        blur_text=False,
                        allowlist_enabled=False,
                        candidate_references=references,
                    )
                    sampled_frames += 1
                    if result.detections.faces_total > 0:
                        frames_with_faces += 1
                    if result.candidate_matches:
                        frames_with_matches += 1
                    for candidate_id, count in result.candidate_matches.items():
                        candidate_matches[candidate_id] += count
                    frame_index += 1
            finally:
                capture.release()

            self.assertGreaterEqual(sampled_frames, 50)
            self.assertGreaterEqual(frames_with_faces, 35)
            self.assertEqual(frames_with_matches, frames_with_faces)
            self.assertEqual(set(candidate_matches), {candidate.candidate_id for candidate in candidates})
            self.assertGreaterEqual(min(candidate_matches.values()), 8)


if __name__ == "__main__":
    unittest.main()
