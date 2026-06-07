import { buildMultipartRequest, requestApiEnvelope } from "./api-client";

export type FacePoseSlot = "front" | "left_45" | "right_45" | "left_profile" | "right_profile";

export type AllowlistFace = {
  personId: string;
  label: string;
  note: string | null;
  filename: string;
  enrollmentId: string | null;
  poseSlot: FacePoseSlot | null;
  embeddingStatus: string;
  createdAt: string;
};

export type FacePoseEstimate = {
  detected: boolean;
  poseSlot: FacePoseSlot | null;
  poseLabel: string | null;
  confidence: number;
  faceBbox: number[] | null;
  alreadyCaptured: boolean;
  completedCount: number;
  requiredCount: number;
  nextSlots: FacePoseSlot[];
  guidance: string;
};

type AllowlistFaceWire = {
  person_id: string;
  label: string;
  note?: string | null;
  filename: string;
  enrollment_id?: string | null;
  pose_slot?: FacePoseSlot | null;
  embedding_status: string;
  created_at: string;
};

type FacePoseEstimateWire = {
  detected: boolean;
  pose_slot?: FacePoseSlot | null;
  pose_label?: string | null;
  confidence: number;
  face_bbox?: number[] | null;
  already_captured: boolean;
  completed_count: number;
  required_count: number;
  next_slots: FacePoseSlot[];
  guidance: string;
};

function fromAllowlistFaceWire(item: AllowlistFaceWire): AllowlistFace {
  return {
    personId: item.person_id,
    label: item.label,
    note: item.note ?? null,
    filename: item.filename,
    enrollmentId: item.enrollment_id ?? null,
    poseSlot: item.pose_slot ?? null,
    embeddingStatus: item.embedding_status,
    createdAt: item.created_at,
  };
}

function fromFacePoseEstimateWire(item: FacePoseEstimateWire): FacePoseEstimate {
  return {
    detected: item.detected,
    poseSlot: item.pose_slot ?? null,
    poseLabel: item.pose_label ?? null,
    confidence: item.confidence,
    faceBbox: item.face_bbox ?? null,
    alreadyCaptured: item.already_captured,
    completedCount: item.completed_count,
    requiredCount: item.required_count,
    nextSlots: item.next_slots,
    guidance: item.guidance,
  };
}

export async function estimateFacePose(input: { frame: Blob; completedSlots: FacePoseSlot[] }): Promise<FacePoseEstimate> {
  const formData = new FormData();
  formData.append("frame", input.frame, "guided-face-pose.jpg");
  formData.append("completed_slots", JSON.stringify(input.completedSlots));

  const result = await requestApiEnvelope<FacePoseEstimateWire>(
    "/realtime/face-pose",
    buildMultipartRequest(formData, { method: "POST" }),
  );

  return fromFacePoseEstimateWire(result.data);
}

export async function createAllowlistFace(input: {
  image: Blob;
  label: string;
  note?: string;
  poseSlot?: FacePoseSlot;
  enrollmentId?: string;
}): Promise<AllowlistFace> {
  const formData = new FormData();
  formData.append("image", input.image, `${input.poseSlot ?? "face"}.jpg`);
  formData.append("label", input.label);
  if (input.note) {
    formData.append("note", input.note);
  }
  if (input.poseSlot) {
    formData.append("pose_slot", input.poseSlot);
  }
  if (input.enrollmentId) {
    formData.append("enrollment_id", input.enrollmentId);
  }

  const result = await requestApiEnvelope<AllowlistFaceWire>(
    "/allowlist/faces",
    buildMultipartRequest(formData, { method: "POST" }),
  );

  return fromAllowlistFaceWire(result.data);
}

export async function listAllowlistFaces(): Promise<AllowlistFace[]> {
  const result = await requestApiEnvelope<{ items: AllowlistFaceWire[] }>("/allowlist/faces", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  return result.data.items.map(fromAllowlistFaceWire);
}
