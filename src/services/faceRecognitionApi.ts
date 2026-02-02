/**
 * Face Recognition API Service
 * 
 * This service handles all communication with the backend face training
 * and recognition APIs. Configure BASE_URL to point to your backend server.
 */

import { supabase } from "@/integrations/supabase/client";

// ============================================================
// CONFIGURATION - Set this to your backend server URL
// ============================================================
const BASE_URL = import.meta.env.VITE_FACE_API_URL || "http://localhost:8000";

// ============================================================
// Types
// ============================================================

export interface FaceTrainingRequest {
  student_id: string;
  roll_number: string;
  images: string[]; // Array of base64 JPEG images
}

export interface FaceTrainingResponse {
  success: boolean;
  student_id: string;
  face_embedding_id?: string;
  message: string;
  confidence_score?: number;
  error?: string;
}

export interface BulkTrainingStudent {
  serial_no: number;
  roll_number: string;
  student_name: string;
  branch: string;
  semester: string;
  gender: string;
}

export interface BulkTrainingRequest {
  section_id: string;
  students: BulkTrainingStudent[];
  images: Record<string, string>; // serial_no -> base64 image
}

export interface BulkTrainingResult {
  serial_no: number;
  roll_number: string;
  status: "success" | "failed";
  student_id?: string;
  face_embedding_id?: string;
  error?: string;
  message?: string;
}

export interface BulkTrainingResponse {
  success: boolean;
  total: number;
  trained: number;
  failed: number;
  results: BulkTrainingResult[];
}

export interface RecognizedFace {
  student_id: string;
  roll_number: string;
  student_name: string;
  confidence: number;
  bounding_box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface UnrecognizedFace {
  bounding_box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  message: string;
}

export interface FaceRecognitionRequest {
  class_id: string;
  section_id: string;
  image: string; // Base64 JPEG image
  timestamp: string;
}

export interface FaceRecognitionResponse {
  success: boolean;
  faces_detected: number;
  recognized: RecognizedFace[];
  unrecognized: UnrecognizedFace[];
  error?: string;
}

export interface TrainModelRequest {
  section_id: string;
}

export interface TrainModelResponse {
  success: boolean;
  message: string;
  model_id?: string;
  students_count?: number;
  error?: string;
}

export interface ModelStatusResponse {
  section_id: string;
  is_trained: boolean;
  last_trained_at?: string;
  students_count: number;
  trained_students_count: number;
}

// ============================================================
// Helper Functions
// ============================================================

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  
  return {
    "Content-Type": "application/json",
    "Authorization": session?.access_token ? `Bearer ${session.access_token}` : "",
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============================================================
// API Functions
// ============================================================

/**
 * Train a single student's face model
 * 
 * @param data - Student ID, roll number, and array of face images
 * @returns Training result with face embedding ID
 */
export async function trainSingleStudent(data: FaceTrainingRequest): Promise<FaceTrainingResponse> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${BASE_URL}/api/face-training`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  
  return handleResponse<FaceTrainingResponse>(response);
}

/**
 * Train multiple students in bulk
 * 
 * @param data - Section ID, student data array, and image mapping
 * @returns Bulk training results for each student
 */
export async function trainBulkStudents(data: BulkTrainingRequest): Promise<BulkTrainingResponse> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${BASE_URL}/api/face-training/bulk`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  
  return handleResponse<BulkTrainingResponse>(response);
}

/**
 * Recognize faces in a camera frame
 * 
 * @param data - Class ID, section ID, and base64 image
 * @returns Recognized and unrecognized faces
 */
export async function recognizeFaces(data: FaceRecognitionRequest): Promise<FaceRecognitionResponse> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${BASE_URL}/api/face-recognition`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  
  return handleResponse<FaceRecognitionResponse>(response);
}

/**
 * Train/retrain the model for a specific section
 * Call this after adding students to create/update the recognition model
 * 
 * @param sectionId - The section ID to train the model for
 * @returns Training status
 */
export async function trainSectionModel(sectionId: string): Promise<TrainModelResponse> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${BASE_URL}/api/model/train`, {
    method: "POST",
    headers,
    body: JSON.stringify({ section_id: sectionId }),
  });
  
  return handleResponse<TrainModelResponse>(response);
}

/**
 * Get the training status of a section's model
 * 
 * @param sectionId - The section ID to check
 * @returns Model status including training state and student counts
 */
export async function getModelStatus(sectionId: string): Promise<ModelStatusResponse> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${BASE_URL}/api/model/status/${sectionId}`, {
    method: "GET",
    headers,
  });
  
  return handleResponse<ModelStatusResponse>(response);
}

/**
 * Check if the backend API is available
 * 
 * @returns True if the API is reachable
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/health`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the configured API base URL
 */
export function getApiBaseUrl(): string {
  return BASE_URL;
}
