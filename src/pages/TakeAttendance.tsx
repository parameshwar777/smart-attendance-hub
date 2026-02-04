import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFaceApi } from "@/hooks/useFaceApi";
import {
  Camera,
  CameraOff,
  Play,
  Square,
  Users,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  WifiOff,
  Save,
  RefreshCw,
} from "lucide-react";

interface DetectedStudent {
  id: string;
  rollNumber: string;
  fullName: string;
  confidence: number;
  status: "present" | "absent" | "late";
  isManual?: boolean;
}

interface ClassInfo {
  id: string;
  subject_name: string;
  subject_code: string;
  section_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

export default function TakeAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionInFlightRef = useRef(false);
  
  const {
    isApiAvailable,
    checkingApi,
    recognize,
    isRecognizing: apiRecognizing,
  } = useFaceApi();
  
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [todaysClasses, setTodaysClasses] = useState<ClassInfo[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [recognitionInterval, setRecognitionIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [lastRecognition, setLastRecognition] = useState<{
    facesDetected: number;
    recognizedCount: number;
    unrecognizedCount: number;
    error?: string;
    at?: string;
  } | null>(null);

  useEffect(() => {
    fetchTodaysClasses();
  }, [user]);

  // Cleanup camera stream when it changes or on unmount.
  // IMPORTANT: Do NOT depend on recognitionInterval here; changing the interval would
  // trigger cleanup and stop the camera, causing the preview to go black.
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Cleanup recognition interval when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (recognitionInterval) {
        clearInterval(recognitionInterval);
      }
    };
  }, [recognitionInterval]);

  // Attach stream after <video> mounts (camera preview was blank when ref was null during startCamera).
  useEffect(() => {
    if (!isCameraActive || !stream || !videoRef.current) return;

    const videoEl = videoRef.current;
    videoEl.srcObject = stream;

    const play = async () => {
      try {
        await videoEl.play();
      } catch {
        // Ignore autoplay/playback errors
      }
    };

    const onLoaded = () => {
      void play();
    };

    if (videoEl.readyState >= 1) {
      void play();
    } else {
      videoEl.onloadedmetadata = onLoaded;
    }

    return () => {
      if (videoEl.onloadedmetadata === onLoaded) {
        videoEl.onloadedmetadata = null;
      }
    };
  }, [isCameraActive, stream]);

  const fetchTodaysClasses = async () => {
    const today = new Date().toISOString().split("T")[0];
    
    const { data, error } = await supabase
      .from("classes")
      .select(`
        id,
        start_time,
        end_time,
        status,
        subjects (
          name,
          code,
          section_id
        )
      `)
      .eq("class_date", today)
      .eq("teacher_id", user?.id);

    if (!error && data) {
      const formattedClasses = data.map((cls: any) => ({
        id: cls.id,
        subject_name: cls.subjects?.name || "Unknown",
        subject_code: cls.subjects?.code || "",
        section_id: cls.subjects?.section_id || "",
        start_time: cls.start_time,
        end_time: cls.end_time,
        status: cls.status,
      }));
      setTodaysClasses(formattedClasses);
    }
  };

  const fetchStudentsForClass = async (classId: string) => {
    const selectedClassInfo = todaysClasses.find(c => c.id === classId);
    if (!selectedClassInfo) return;

    const { data: classData } = await supabase
      .from("classes")
      .select(`
        subjects (
          section_id
        )
      `)
      .eq("id", classId)
      .single();

    if (classData?.subjects?.section_id) {
      const { data: students } = await supabase
        .from("students")
        .select("*")
        .eq("section_id", classData.subjects.section_id);

      setAllStudents(students || []);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: 1280, height: 720, facingMode: { ideal: "user" } },
      });
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (recognitionInterval) {
      clearInterval(recognitionInterval);
      setRecognitionIntervalId(null);
    }
    recognitionInFlightRef.current = false;
    setStream(null);
    setIsCameraActive(false);
    setIsRecognizing(false);
  };

  const captureFrameBase64 = useCallback(async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) {
      console.log("captureFrame: refs not ready", {
        video: !!videoRef.current,
        canvas: !!canvasRef.current,
      });
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return null;

    // Check if video is actually playing with valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log("captureFrame: video dimensions are 0, stream not ready");
      return null;
    }

    // Downscale captures to reduce CPU + bandwidth and avoid UI freezes.
    // Keep enough detail for face detection.
    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const targetW = Math.max(1, Math.round(video.videoWidth * scale));
    const targetH = Math.max(1, Math.round(video.videoHeight * scale));

    canvas.width = targetW;
    canvas.height = targetH;
    context.drawImage(video, 0, 0, targetW, targetH);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return null;

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to encode frame"));
      reader.readAsDataURL(blob);
    });

    console.log("captureFrame: captured frame", { width: canvas.width, height: canvas.height });
    return dataUrl;
  }, []);

  const performRecognition = useCallback(async () => {
    if (recognitionInFlightRef.current) return;
    const selectedClassInfo = todaysClasses.find(c => c.id === selectedClass);
    if (!selectedClassInfo) return;

    recognitionInFlightRef.current = true;
    try {
      const frameData = await captureFrameBase64();
      if (!frameData) return;

      const result = await recognize({
        class_id: selectedClass,
        section_id: selectedClassInfo.section_id,
        image: frameData,
        timestamp: new Date().toISOString(),
      });

      // Log payload to confirm correct base64 format for debugging backend.
      console.log("Recognition payload:", {
        class_id: selectedClass,
        section_id: selectedClassInfo.section_id,
        imagePrefix: frameData.slice(0, 50) + "...",
        imageLength: frameData.length,
      });

      // Always record the latest backend response stats for debugging.
      setLastRecognition({
        facesDetected: result?.faces_detected ?? 0,
        recognizedCount: Array.isArray(result?.recognized) ? result.recognized.length : 0,
        unrecognizedCount: Array.isArray(result?.unrecognized) ? result.unrecognized.length : 0,
        error: result?.error,
        at: new Date().toLocaleTimeString(),
      });

      if (result?.success && result.recognized.length > 0) {
        // Add newly recognized students (avoid duplicates)
        setDetectedStudents(prev => {
          const newStudents = [...prev];
          for (const face of result.recognized) {
            if (!newStudents.find(s => s.id === face.student_id)) {
              newStudents.push({
                id: face.student_id,
                rollNumber: face.roll_number,
                fullName: face.student_name,
                confidence: face.confidence,
                status: "present",
              });
            }
          }
          return newStudents;
        });

        toast({
          title: "Faces Recognized",
          description: `${result.recognized.length} new student(s) detected`,
        });
      }
    } finally {
      recognitionInFlightRef.current = false;
    }
  }, [selectedClass, todaysClasses, captureFrameBase64, recognize, toast]);

  const startRecognition = async () => {
    // Ensure video is fully ready before starting
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast({
        title: "Camera Not Ready",
        description: "Please wait for the camera to fully initialize before starting recognition.",
        variant: "destructive",
      });
      return;
    }

    // Ensure playback stays active when the UI re-renders
    try {
      await video.play();
    } catch {
      // ignore
    }

    setIsRecognizing(true);
    
    toast({
      title: "Recognition Started",
      description: "AI is analyzing the camera feed for faces...",
    });

    // Perform recognition every 2 seconds
    const intervalId = setInterval(() => {
      void performRecognition();
    }, 2000);
    setRecognitionIntervalId(intervalId);
    
    // Do an immediate recognition
    try {
      await performRecognition();
    } catch (error) {
      console.error("Recognition error:", error);
      toast({
        title: "Recognition Error",
        description: error instanceof Error ? error.message : "Failed to perform recognition",
        variant: "destructive",
      });
    }
  };

  const stopRecognition = () => {
    if (recognitionInterval) {
      clearInterval(recognitionInterval);
      setRecognitionIntervalId(null);
    }
    recognitionInFlightRef.current = false;
    setIsRecognizing(false);
    toast({
      title: "Recognition Stopped",
      description: "Face recognition paused",
    });
  };

  const updateStudentStatus = (studentId: string, status: "present" | "absent" | "late") => {
    setDetectedStudents(prev => 
      prev.map(s => s.id === studentId ? { ...s, status } : s)
    );
  };

  const addManualStudent = (student: any) => {
    if (detectedStudents.find(d => d.id === student.id)) return;

    setDetectedStudents(prev => [
      ...prev,
      {
        id: student.id,
        rollNumber: student.roll_number,
        fullName: student.full_name,
        confidence: 1.0,
        status: "present" as const,
        isManual: true,
      },
    ]);
  };

  const removeStudent = (studentId: string) => {
    setDetectedStudents(prev => prev.filter(s => s.id !== studentId));
  };

  const submitAttendance = async () => {
    if (!selectedClass) {
      toast({
        title: "No Class Selected",
        description: "Please select a class before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert attendance records for detected students
      const attendanceRecords = detectedStudents.map(student => ({
        class_id: selectedClass,
        student_id: student.id,
        status: student.status,
        marked_by: user?.id,
        face_confidence: student.isManual ? null : student.confidence,
        // Always send explicit boolean to avoid PostgREST inserting NULL.
        is_manual_override: Boolean(student.isManual),
      }));

      // Also mark absent students
      const absentStudents = allStudents
        .filter(s => !detectedStudents.find(d => d.id === s.id))
        .map(student => ({
          class_id: selectedClass,
          student_id: student.id,
          status: "absent" as const,
          marked_by: user?.id,
          // Always include explicit boolean (fixes: null value violates not-null constraint).
          is_manual_override: false,
          face_confidence: null,
        }));

      const allRecords = [...attendanceRecords, ...absentStudents];

      const { error } = await supabase
        .from("attendance")
        .insert(allRecords);

      if (error) throw error;

      // Update class status to completed
      await supabase
        .from("classes")
        .update({ status: "completed" })
        .eq("id", selectedClass);

      toast({
        title: "Attendance Submitted",
        description: `Attendance recorded for ${allRecords.length} students.`,
      });

      // Reset state
      setDetectedStudents([]);
      stopCamera();
      fetchTodaysClasses();

    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit attendance.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClassInfo = todaysClasses.find(c => c.id === selectedClass);

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Take Attendance</h1>
            <p className="text-muted-foreground">
              Use AI-powered face recognition to mark attendance automatically
            </p>
          </div>
          
          {/* API Status */}
          <div className="flex items-center gap-2">
            {checkingApi ? (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking API...
              </Badge>
            ) : isApiAvailable ? (
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Backend Connected
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" />
                Backend Offline
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Camera Feed */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Camera Feed</CardTitle>
                    <CardDescription>
                      Live camera preview for face recognition
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isRecognizing && (
                      <div className="flex items-center gap-2 text-sm text-accent">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                        </span>
                        Recognizing...
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Class Selector */}
                <Select
                  value={selectedClass}
                  onValueChange={(value) => {
                    setSelectedClass(value);
                    fetchStudentsForClass(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select today's class" />
                  </SelectTrigger>
                  <SelectContent>
                    {todaysClasses.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No classes scheduled today
                      </SelectItem>
                    ) : (
                      todaysClasses.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.subject_name} ({cls.subject_code}) - {cls.start_time} to {cls.end_time}
                          {cls.status === "completed" && " ✓"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {/* Video Preview */}
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  {isCameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* Last recognition status (helps diagnose: no detection vs no match) */}
                      {lastRecognition && (
                        <div className="absolute bottom-2 left-2">
                          <Badge variant={lastRecognition.error ? "destructive" : "secondary"} className="gap-2">
                            <span>Last scan {lastRecognition.at}</span>
                            <span>Faces: {lastRecognition.facesDetected}</span>
                            <span>Rec: {lastRecognition.recognizedCount}</span>
                            <span>Unk: {lastRecognition.unrecognizedCount}</span>
                          </Badge>
                        </div>
                      )}

                      {/* Recognition overlay */}
                      {isRecognizing && (
                        <div className="absolute inset-0 border-4 border-accent/50 rounded-lg pointer-events-none">
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-accent text-accent-foreground gap-1">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              Scanning...
                            </Badge>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <CameraOff className="h-16 w-16 mb-4 opacity-50" />
                      <p className="text-lg">Camera is off</p>
                      <p className="text-sm">Select a class and start the camera</p>
                    </div>
                  )}
                </div>

                {/* Hidden canvas for frame capture */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Controls */}
                <div className="flex gap-2">
                  {!isCameraActive ? (
                    <Button
                      onClick={startCamera}
                      className="flex-1 gap-2"
                      disabled={!selectedClass}
                    >
                      <Camera className="h-4 w-4" />
                      Start Camera
                    </Button>
                  ) : (
                    <>
                      {!isRecognizing ? (
                        <Button
                          onClick={startRecognition}
                          className="flex-1 gap-2 bg-accent hover:bg-accent/90"
                          disabled={!isApiAvailable}
                        >
                          <Play className="h-4 w-4" />
                          Start Recognition
                        </Button>
                      ) : (
                        <Button
                          onClick={stopRecognition}
                          variant="outline"
                          className="flex-1 gap-2"
                        >
                          <Square className="h-4 w-4" />
                          Stop Recognition
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={stopCamera}
                      >
                        <CameraOff className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Submit Button */}
                {detectedStudents.length > 0 && (
                  <Button
                    onClick={submitAttendance}
                    className="w-full gap-2"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Submit Attendance ({detectedStudents.filter(s => s.status === "present" || s.status === "late").length} Present)
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detected Students */}
          <Card className="lg:row-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Detected Students
              </CardTitle>
              <CardDescription>
                {detectedStudents.length} student(s) recognized
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {detectedStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No students detected yet</p>
                  <p className="text-sm">Start recognition to detect faces</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  <AnimatePresence>
                    {detectedStudents.map((student) => (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{student.fullName}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{student.rollNumber}</span>
                            {student.isManual ? (
                              <span className="text-xs">(Manual)</span>
                            ) : (
                              <span className="text-xs">
                                ({Math.round(student.confidence * 100)}% match)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={student.status}
                            onValueChange={(value) => 
                              updateStudentStatus(student.id, value as "present" | "absent" | "late")
                            }
                          >
                            <SelectTrigger className="w-24 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="late">Late</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeStudent(student.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* All Students List for Manual Add */}
              {selectedClass && allStudents.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Add Manually</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {allStudents
                      .filter(s => !detectedStudents.find(d => d.id === s.id))
                      .map(student => (
                        <button
                          key={student.id}
                          onClick={() => addManualStudent(student)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-secondary transition-colors text-sm"
                        >
                          <span className="font-medium">{student.full_name}</span>
                          <span className="text-muted-foreground ml-2">
                            {student.roll_number}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {detectedStudents.length > 0 && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Present:</span>
                    <span className="font-medium text-green-600">
                      {detectedStudents.filter(s => s.status === "present").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Late:</span>
                    <span className="font-medium text-yellow-600">
                      {detectedStudents.filter(s => s.status === "late").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Students:</span>
                    <span className="font-medium">{allStudents.length}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
