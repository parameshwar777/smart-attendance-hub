import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Camera,
  CameraOff,
  Play,
  Square,
  Users,
  Check,
  X,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface DetectedStudent {
  id: string;
  rollNumber: string;
  fullName: string;
  confidence: number;
  status: "present" | "absent" | "late";
}

interface ClassInfo {
  id: string;
  subject_name: string;
  subject_code: string;
  start_time: string;
  end_time: string;
  status: string;
}

export default function TakeAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [todaysClasses, setTodaysClasses] = useState<ClassInfo[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchTodaysClasses();
  }, [user]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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

    // Get the section from the subject
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
        video: { width: 1280, height: 720, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
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
    setStream(null);
    setIsCameraActive(false);
    setIsRecognizing(false);
  };

  const startRecognition = async () => {
    setIsRecognizing(true);
    
    // TODO: This would call the backend AI API for face recognition
    // For now, simulate detection with mock data
    toast({
      title: "Recognition Started",
      description: "AI is analyzing the camera feed for faces...",
    });

    // Simulate face detection after 2 seconds
    setTimeout(() => {
      // Mock detected students
      const mockDetected: DetectedStudent[] = allStudents.slice(0, 3).map((student, i) => ({
        id: student.id,
        rollNumber: student.roll_number,
        fullName: student.full_name,
        confidence: 0.95 - i * 0.05,
        status: i === 2 ? "late" : "present" as "present" | "late",
      }));

      setDetectedStudents(mockDetected);
      
      toast({
        title: "Faces Detected",
        description: `${mockDetected.length} student(s) recognized`,
      });
    }, 2000);
  };

  const stopRecognition = () => {
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
        face_confidence: student.confidence,
      }));

      // Also mark absent students
      const absentStudents = allStudents
        .filter(s => !detectedStudents.find(d => d.id === s.id))
        .map(student => ({
          class_id: selectedClass,
          student_id: student.id,
          status: "absent" as const,
          marked_by: user?.id,
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

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-display font-bold">Take Attendance</h1>
          <p className="text-muted-foreground">
            Use AI-powered face recognition to mark attendance automatically
          </p>
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
                      {/* Face detection overlay */}
                      <div className="absolute inset-0 pointer-events-none">
                        {/* This would show bounding boxes for detected faces */}
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <CameraOff className="h-16 w-16 mb-4 opacity-50" />
                      <p className="text-lg">Camera is off</p>
                      <p className="text-sm">Select a class and start the camera</p>
                    </div>
                  )}
                </div>

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
                <div className="space-y-3">
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
                            <span className="text-xs">
                              ({Math.round(student.confidence * 100)}% match)
                            </span>
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
                          className="w-full flex items-center justify-between p-2 text-sm rounded-lg hover:bg-secondary transition-colors"
                        >
                          <span>{student.full_name}</span>
                          <span className="text-muted-foreground">{student.roll_number}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              {detectedStudents.length > 0 && (
                <Button
                  onClick={submitAttendance}
                  className="w-full gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Submit Attendance
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
