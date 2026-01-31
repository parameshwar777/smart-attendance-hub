# Backend API Specification

## Face Training & Attendance System API Endpoints

This document describes the backend API endpoints that the frontend expects. The frontend is complete and ready to connect to these endpoints.

---

## Base URL

```
POST /api/face-training
POST /api/face-recognition
GET  /api/attendance/...
```

---

## 1. Face Training API

### POST `/api/face-training`

Train a face recognition model for a single student.

**Request Body:**
```json
{
  "student_id": "uuid-string",
  "roll_number": "22KT1A4301",
  "images": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  ]
}
```

**Expected Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| student_id | UUID | Yes | Supabase student record ID |
| roll_number | string | Yes | Student roll number for identification |
| images | string[] | Yes | Array of base64-encoded JPEG images (min 5, max 10) |

**Response - Success (200):**
```json
{
  "success": true,
  "student_id": "uuid-string",
  "face_embedding_id": "embedding-reference-id",
  "message": "Face model trained successfully",
  "confidence_score": 0.95
}
```

**Response - Error (400/500):**
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
| face_not_detected | No face found in one or more images |
| multiple_faces | More than one face detected (single face training only) |
| low_quality | Image quality too low for training |
| already_registered | Roll number already has face embeddings |
| training_failed | Internal model training error |

---

## 2. Bulk Face Training API

### POST `/api/face-training/bulk`

Train multiple students from CSV data and ZIP images.

**Request Body (multipart/form-data):**
| Field | Type | Description |
|-------|------|-------------|
| students | JSON | Array of student objects |
| images | Object | Map of serial_no to base64 image |

**Students JSON structure:**
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
    }
  ],
  "images": {
    "1": "data:image/jpeg;base64,...",
    "2": "data:image/jpeg;base64,..."
  }
}
```

**Response - Success (200):**
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
      "message": "Face not clearly visible"
    }
  ]
}
```

---

## 3. Face Recognition (Attendance) API

### POST `/api/face-recognition`

Detect and recognize faces in a live camera frame for attendance marking.

**Request Body:**
```json
{
  "class_id": "uuid-string",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "timestamp": "2026-01-31T10:30:00Z"
}
```

**Response - Success (200):**
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

---

## 4. Mark Attendance API

### POST `/api/attendance/mark`

Submit final attendance for a class session.

**Request Body:**
```json
{
  "class_id": "uuid-string",
  "marked_by": "teacher-user-id",
  "attendance_records": [
    {
      "student_id": "uuid-string",
      "status": "present",
      "face_confidence": 0.94,
      "is_manual_override": false
    },
    {
      "student_id": "uuid-string",
      "status": "present",
      "face_confidence": null,
      "is_manual_override": true,
      "override_reason": "Student arrived late, marked manually"
    },
    {
      "student_id": "uuid-string",
      "status": "absent",
      "face_confidence": null,
      "is_manual_override": false
    }
  ]
}
```

**Response - Success (200):**
```json
{
  "success": true,
  "class_id": "uuid-string",
  "total_students": 50,
  "present": 45,
  "absent": 5,
  "marked_at": "2026-01-31T10:45:00Z"
}
```

---

## 5. Get Class Students API

### GET `/api/classes/{class_id}/students`

Get all students enrolled in a class section for attendance.

**Response (200):**
```json
{
  "class_id": "uuid-string",
  "subject": {
    "id": "uuid-string",
    "name": "Data Structures",
    "code": "CS301"
  },
  "section": {
    "id": "uuid-string",
    "name": "A",
    "year": "3rd Year",
    "department": "Computer Science"
  },
  "students": [
    {
      "id": "uuid-string",
      "roll_number": "22KT1A4301",
      "full_name": "STUDENT NAME",
      "face_registered": true,
      "face_embedding_id": "embedding-id"
    }
  ]
}
```

---

## 6. Attendance Analytics API

### GET `/api/analytics/student/{student_id}`

Get attendance analytics for a specific student.

**Response (200):**
```json
{
  "student_id": "uuid-string",
  "student_name": "STUDENT NAME",
  "roll_number": "22KT1A4301",
  "section": "CSE-AI 4th Year Section A",
  "overall": {
    "total_classes": 120,
    "classes_attended": 98,
    "classes_missed": 22,
    "attendance_percentage": 81.67,
    "risk_level": "safe"
  },
  "subjects": [
    {
      "subject_id": "uuid-string",
      "subject_name": "Data Structures",
      "subject_code": "CS301",
      "total_classes": 40,
      "attended": 35,
      "missed": 5,
      "percentage": 87.5,
      "classes_needed_for_80": 0
    },
    {
      "subject_id": "uuid-string",
      "subject_name": "Operating Systems",
      "subject_code": "CS302",
      "total_classes": 40,
      "attended": 28,
      "missed": 12,
      "percentage": 70.0,
      "classes_needed_for_80": 8
    }
  ],
  "recent_attendance": [
    {
      "date": "2026-01-31",
      "subject": "Data Structures",
      "status": "present"
    }
  ]
}
```

**Risk Levels:**
| Level | Percentage | Description |
|-------|------------|-------------|
| safe | ≥80% | Student is eligible |
| warning | 70-79% | At risk of becoming ineligible |
| risk | <70% | Below minimum requirement |

---

## Database Schema Reference

The frontend uses these Supabase tables:

### students
```sql
- id (UUID, PK)
- roll_number (TEXT, UNIQUE)
- full_name (TEXT)
- email (TEXT, nullable)
- section_id (UUID, FK → sections)
- face_registered (BOOLEAN)
- face_embedding_id (TEXT, nullable) -- Reference to face model
- user_id (UUID, nullable)
- created_at, updated_at (TIMESTAMP)
```

### attendance
```sql
- id (UUID, PK)
- class_id (UUID, FK → classes)
- student_id (UUID, FK → students)
- status (TEXT: 'present' | 'absent' | 'late')
- marked_at (TIMESTAMP)
- marked_by (UUID, teacher's user_id)
- is_manual_override (BOOLEAN)
- override_reason (TEXT, nullable)
- face_confidence (NUMERIC, nullable)
- created_at, updated_at (TIMESTAMP)
```

---

## Implementation Notes

1. **Face Embedding Storage**: Store face embeddings externally (e.g., AWS S3, vector database). Only store the reference ID in `students.face_embedding_id`.

2. **Image Processing**: Images are sent as base64 JPEG. Decode and process on the backend.

3. **Confidence Thresholds**: Recommend using 0.85+ confidence for automatic recognition.

4. **Duplicate Prevention**: Check for existing attendance records before inserting.

5. **Audit Logging**: All attendance changes are logged in `attendance_logs` table automatically via database trigger.

---

## Authentication

All API endpoints require authentication. Include the Supabase JWT token in the Authorization header:

```
Authorization: Bearer <supabase-jwt-token>
```

The backend should validate the token and check user roles before processing requests.
