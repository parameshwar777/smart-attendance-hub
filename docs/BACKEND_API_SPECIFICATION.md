# Backend API Specification for Face Recognition Attendance System

## Overview

This document describes all the backend API endpoints that the frontend expects. The frontend is complete and will call these endpoints. You need to implement these endpoints to make the system functional.

**Frontend Configuration**: Set `VITE_FACE_API_URL` in `.env` to your backend URL.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Single Student Face Training](#2-single-student-face-training)
3. [Bulk Face Training](#3-bulk-face-training)
4. [Face Recognition (Attendance)](#4-face-recognition-attendance)
5. [Model Training](#5-model-training)
6. [Model Status](#6-model-status)
7. [Health Check](#7-health-check)
8. [Database Schema](#8-database-schema)
9. [User Roles & Flows](#9-user-roles--flows)
10. [Implementation Notes](#10-implementation-notes)

---

## 1. Authentication

All API endpoints require authentication. Include the Supabase JWT token in the Authorization header:

```
Authorization: Bearer <supabase-jwt-token>
```

The backend should:
1. Validate the JWT token with Supabase
2. Extract user_id and role from the token
3. Check permissions before processing requests

---

## 2. Single Student Face Training

### `POST /api/face-training`

Train a face recognition model for a single student using multiple face images.

**Request Body:**
```json
{
  "student_id": "uuid-string",
  "roll_number": "22KT1A4301",
  "images": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  ]
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| student_id | UUID | Yes | Supabase student record ID |
| roll_number | string | Yes | Student roll number for identification |
| images | string[] | Yes | Array of base64-encoded JPEG images (min 5, max 10) |

**Success Response (200):**
```json
{
  "success": true,
  "student_id": "uuid-string",
  "face_embedding_id": "embedding-reference-id",
  "message": "Face model trained successfully",
  "confidence_score": 0.95
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": "face_not_detected",
  "message": "No face detected in image 3. Please ensure clear face visibility."
}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| `face_not_detected` | No face found in one or more images |
| `multiple_faces` | More than one face detected (single face training only) |
| `low_quality` | Image quality too low for training |
| `already_registered` | Roll number already has face embeddings |
| `training_failed` | Internal model training error |
| `unauthorized` | User not authorized to train this student |

---

## 3. Bulk Face Training

### `POST /api/face-training/bulk`

Train multiple students from CSV data and ZIP images in a single request.

**Request Body (JSON):**
```json
{
  "section_id": "uuid-string",
  "students": [
    {
      "serial_no": 1,
      "roll_number": "22KT1A4301",
      "student_name": "STUDENT NAME",
      "branch": "CSE-AI",
      "semester": "VIII Semester",
      "gender": "F"
    },
    {
      "serial_no": 2,
      "roll_number": "22KT1A4302",
      "student_name": "ANOTHER STUDENT",
      "branch": "CSE-AI",
      "semester": "VIII Semester",
      "gender": "M"
    }
  ],
  "images": {
    "1": "data:image/jpeg;base64,...",
    "2": "data:image/jpeg;base64,..."
  }
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| section_id | UUID | Yes | Target section for all students |
| students | array | Yes | Array of student objects |
| students[].serial_no | number | Yes | Serial number matching image filename |
| students[].roll_number | string | Yes | Unique student roll number |
| students[].student_name | string | Yes | Full name of student |
| students[].branch | string | No | Branch/department code |
| students[].semester | string | No | Current semester |
| students[].gender | string | No | Gender (M/F) |
| images | object | Yes | Map of serial_no to base64 image |

**Success Response (200):**
```json
{
  "success": true,
  "total": 50,
  "trained": 48,
  "failed": 2,
  "results": [
    {
      "serial_no": 1,
      "roll_number": "22KT1A4301",
      "status": "success",
      "student_id": "uuid-string",
      "face_embedding_id": "embedding-id"
    },
    {
      "serial_no": 5,
      "roll_number": "22KT1A4305",
      "status": "failed",
      "error": "face_not_clear",
      "message": "Face not clearly visible in image"
    }
  ]
}
```

---

## 4. Face Recognition (Attendance)

### `POST /api/face-recognition`

Detect and recognize faces in a live camera frame for attendance marking.

**Request Body:**
```json
{
  "class_id": "uuid-string",
  "section_id": "uuid-string",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "timestamp": "2026-02-02T10:30:00Z"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| class_id | UUID | Yes | Class session ID for attendance |
| section_id | UUID | Yes | Section ID to match against trained model |
| image | string | Yes | Base64-encoded JPEG frame from camera |
| timestamp | ISO8601 | Yes | Capture timestamp |

**Success Response (200):**
```json
{
  "success": true,
  "faces_detected": 5,
  "recognized": [
    {
      "student_id": "uuid-string",
      "roll_number": "22KT1A4301",
      "student_name": "STUDENT NAME",
      "confidence": 0.94,
      "bounding_box": {
        "x": 120,
        "y": 80,
        "width": 150,
        "height": 180
      }
    },
    {
      "student_id": "uuid-string",
      "roll_number": "22KT1A4302",
      "student_name": "ANOTHER STUDENT",
      "confidence": 0.89,
      "bounding_box": {
        "x": 350,
        "y": 100,
        "width": 145,
        "height": 175
      }
    }
  ],
  "unrecognized": [
    {
      "bounding_box": {
        "x": 550,
        "y": 90,
        "width": 140,
        "height": 170
      },
      "message": "Face not registered"
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether recognition completed |
| faces_detected | number | Total faces found in frame |
| recognized | array | Matched students with confidence scores |
| recognized[].confidence | number | Match confidence (0.0 - 1.0) |
| recognized[].bounding_box | object | Face location in image |
| unrecognized | array | Detected but unmatched faces |

---

## 5. Model Training

### `POST /api/model/train`

Train or retrain the recognition model for a specific section. Call this after adding all students to create the final model.

**Request Body:**
```json
{
  "section_id": "uuid-string"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Model trained successfully with 45 students",
  "model_id": "model-uuid",
  "students_count": 45
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "no_students",
  "message": "No students with registered faces found in this section"
}
```

**Notes:**
- This trains a section-level model using all registered face embeddings
- Should be called after bulk upload or after adding multiple students
- The model is used for fast recognition during attendance

---

## 6. Model Status

### `GET /api/model/status/{section_id}`

Get the training status of a section's recognition model.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| section_id | UUID | The section ID to check |

**Success Response (200):**
```json
{
  "section_id": "uuid-string",
  "is_trained": true,
  "last_trained_at": "2026-02-02T10:00:00Z",
  "students_count": 50,
  "trained_students_count": 48
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| section_id | UUID | Section identifier |
| is_trained | boolean | Whether a model exists |
| last_trained_at | ISO8601 | Last training timestamp |
| students_count | number | Total students in section |
| trained_students_count | number | Students with face data |

---

## 7. Health Check

### `GET /health`

Check if the API server is running.

**Response (200):**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

## 8. Database Schema

The frontend uses these Supabase tables. Your backend should interact with them.

### students
```sql
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  section_id UUID NOT NULL REFERENCES sections(id),
  face_registered BOOLEAN DEFAULT FALSE,
  face_embedding_id TEXT,  -- Reference to face model/embedding
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### attendance
```sql
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id),
  student_id UUID NOT NULL REFERENCES students(id),
  status TEXT DEFAULT 'absent',  -- 'present' | 'absent' | 'late'
  marked_at TIMESTAMPTZ DEFAULT now(),
  marked_by UUID,  -- teacher's user_id
  is_manual_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  face_confidence NUMERIC,  -- Recognition confidence score
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### classes
```sql
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  teacher_id UUID,  -- teacher's user_id
  class_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'scheduled',  -- 'scheduled' | 'in_progress' | 'completed'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### sections
```sql
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year_id UUID NOT NULL REFERENCES years(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 9. User Roles & Flows

### Role Hierarchy

| Role | Permissions |
|------|-------------|
| **Admin** | Manage departments, years, sections, teachers, subjects. View all data. |
| **Teacher** | Register students, train faces, take attendance for assigned classes. |
| **Student** | View own attendance and analytics. |

### Admin Flow

1. **Create Department** → Departments page
2. **Add Years** → Add 1st Year, 2nd Year, etc. to department
3. **Add Sections** → Add Section A, B, etc. to each year
4. **Create Teacher Account** → Teachers page → Add Teacher
5. **Assign Subjects** → Assign subjects to teacher (links teacher to sections)

### Teacher Flow

1. **Face Training (Single)** → Face Training page
   - Select section (auto-populated from assigned subjects)
   - Enter student details
   - Capture 5-10 face images via camera
   - Submit → Calls `POST /api/face-training`

2. **Bulk Upload** → Bulk Upload page
   - Select section
   - Upload CSV with student data
   - Upload ZIP with images (named by S.No: 1.jpg, 2.jpg, etc.)
   - Start Training → Calls `POST /api/face-training/bulk`
   - Train Model → Calls `POST /api/model/train`

3. **Take Attendance** → Take Attendance page
   - Select today's class
   - Start camera
   - Start Recognition → Continuously calls `POST /api/face-recognition`
   - Manually adjust if needed
   - Submit Attendance → Writes to `attendance` table

### Student Flow

1. **View Dashboard** → See attendance summary
2. **View Analytics** → See detailed attendance by subject

---

## 10. Implementation Notes

### Face Embedding Storage

- Store face embeddings externally (vector database, file storage, etc.)
- Only store the reference ID in `students.face_embedding_id`
- Options: Pinecone, Milvus, PostgreSQL pgvector, or file-based

### Image Processing

- Images are sent as base64 JPEG data URLs
- Format: `data:image/jpeg;base64,<base64-data>`
- Strip the prefix before processing: `image.split(',')[1]`
- Recommended size: 640x480 for training, 1280x720 for recognition

### Confidence Thresholds

| Threshold | Action |
|-----------|--------|
| ≥ 0.85 | Automatic match - mark present |
| 0.70 - 0.84 | Suggested match - show for confirmation |
| < 0.70 | No match - show as unrecognized |

### Model Architecture Suggestions

1. **Face Detection**: MTCNN, RetinaFace, or MediaPipe
2. **Face Recognition**: FaceNet, ArcFace, or DeepFace
3. **Embedding Storage**: 128-512 dimensional vectors

### API Framework Suggestions

- **Python**: FastAPI + face_recognition library
- **Node.js**: Express + face-api.js
- **Python (Advanced)**: FastAPI + InsightFace + pgvector

### Sample Python Backend Structure

```
backend/
├── main.py              # FastAPI app
├── routers/
│   ├── training.py      # /api/face-training endpoints
│   ├── recognition.py   # /api/face-recognition endpoint
│   └── model.py         # /api/model/* endpoints
├── services/
│   ├── face_detector.py # Face detection service
│   ├── face_encoder.py  # Face encoding/embedding
│   └── face_matcher.py  # Face matching/recognition
├── models/
│   └── embeddings.py    # Embedding storage
└── utils/
    ├── supabase.py      # Supabase client
    └── auth.py          # JWT validation
```

### Environment Variables for Backend

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
EMBEDDING_STORAGE_PATH=/path/to/embeddings
FACE_DETECTION_MODEL=retinaface
FACE_RECOGNITION_MODEL=arcface
CONFIDENCE_THRESHOLD=0.85
```

---

## Quick Start Checklist

1. [ ] Set up backend server (Python FastAPI recommended)
2. [ ] Install face detection/recognition libraries
3. [ ] Configure Supabase connection
4. [ ] Implement `/health` endpoint
5. [ ] Implement `/api/face-training` endpoint
6. [ ] Implement `/api/face-training/bulk` endpoint
7. [ ] Implement `/api/face-recognition` endpoint
8. [ ] Implement `/api/model/train` endpoint
9. [ ] Implement `/api/model/status/{section_id}` endpoint
10. [ ] Set `VITE_FACE_API_URL` in frontend `.env`
11. [ ] Test end-to-end flow

---

## Contact & Support

For questions about the frontend implementation, refer to:
- `src/services/faceRecognitionApi.ts` - API service layer
- `src/hooks/useFaceApi.ts` - React hook for API calls
- `src/pages/FaceTraining.tsx` - Single student training UI
- `src/pages/BulkUpload.tsx` - Bulk training UI
- `src/pages/TakeAttendance.tsx` - Attendance recognition UI
