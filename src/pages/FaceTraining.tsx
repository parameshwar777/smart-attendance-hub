import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFaceApi } from "@/hooks/useFaceApi";
import {
  Camera,
  CameraOff,
  Loader2,
  User,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle,
  XCircle,
  ScanFace,
  GraduationCap,
  Zap,
  WifiOff,
  RefreshCw,
} from "lucide-react";

interface CapturedImage {
  id: number;
  dataUrl: string;
}

interface TrainingSession {
  studentName: string;
  rollNumber: string;
  status: "pending" | "training" | "success" | "failed";
  message?: string;
}

interface AssignedSection {
  id: string;
  name: string;
  year: string;
  yearNumber: number;
  department: string;
  departmentCode: string;
  yearId: string;
  departmentId: string;
}

export default function FaceTraining() {
  const { toast } = useToast();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const {
    isApiAvailable,
    checkingApi,
    trainStudent,
    trainModel,
    isTraining,
    isTrainingModel,
    modelStatus,
    fetchModelStatus,
  } = useFaceApi();

  const [assignedSections, setAssignedSections] = useState<AssignedSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const [formData, setFormData] = useState({
    fullName: "",
    rollNumber: "",
    email: "",
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [recentTrainings, setRecentTrainings] = useState<TrainingSession[]>([]);

  useEffect(() => {
    if (user) {
      fetchAssignedSections();
    }
  }, [user]);

  useEffect(() => {
    if (selectedSectionId) {
      fetchModelStatus(selectedSectionId);
    }
  }, [selectedSectionId, fetchModelStatus]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Attach stream after the <video> mounts.
  // Fixes: permission prompt shown, but preview remains blank because the ref was null at startCamera time.
  useEffect(() => {
    if (!isCameraActive || !stream || !videoRef.current) return;

    const videoEl = videoRef.current;
    videoEl.srcObject = stream;

    const play = async () => {
      try {
        await videoEl.play();
      } catch {
        // Ignore autoplay/playback errors; user already initiated via click.
      }
    };

    const onLoaded = () => {
      void play();
    };

    // If metadata is already available, play immediately; otherwise wait.
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

  const fetchAssignedSections = async () => {
    try {
      const { data: subjects, error } = await supabase
        .from("subjects")
        .select(`
          id,
          name,
          code,
          section_id,
          sections!inner (
            id,
            name,
            years!inner (
              id,
              name,
              year_number,
              departments!inner (
                id,
                name,
                code
              )
            )
          )
        `)
        .eq("teacher_id", user?.id);

      if (error) throw error;

      const sectionsMap = new Map<string, AssignedSection>();
      (subjects || []).forEach(subject => {
        const section = subject.sections as any;
        if (!sectionsMap.has(section.id)) {
          sectionsMap.set(section.id, {
            id: section.id,
            name: section.name,
            year: section.years.name,
            yearNumber: section.years.year_number,
            department: section.years.departments.name,
            departmentCode: section.years.departments.code,
            yearId: section.years.id,
            departmentId: section.years.departments.id,
          });
        }
      });

      const sections = Array.from(sectionsMap.values());
      setAssignedSections(sections);

      if (sections.length > 0 && !selectedSectionId) {
        setSelectedSectionId(sections[0].id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch assigned sections",
        variant: "destructive",
      });
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: 640, height: 480, facingMode: { ideal: "user" } },
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
    setStream(null);
    setIsCameraActive(false);
  };

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const newImage: CapturedImage = {
        id: Date.now(),
        dataUrl,
      };

      setCapturedImages(prev => [...prev, newImage]);

      setIsCapturing(true);
      setTimeout(() => setIsCapturing(false), 150);
    }
  }, []);

  const removeImage = (id: number) => {
    setCapturedImages(prev => prev.filter(img => img.id !== id));
  };

  const clearAllImages = () => {
    setCapturedImages([]);
  };

  const handleTrainStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.rollNumber || !selectedSectionId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (capturedImages.length < 5) {
      toast({
        title: "Insufficient Images",
        description: "Please capture at least 5 face images for training.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const trainingSession: TrainingSession = {
      studentName: formData.fullName,
      rollNumber: formData.rollNumber,
      status: "training",
    };
    setRecentTrainings(prev => [trainingSession, ...prev]);

    try {
      // Check if student already exists
      const { data: existingStudent } = await supabase
        .from("students")
        .select("id")
        .eq("roll_number", formData.rollNumber)
        .maybeSingle();

      let studentId: string;

      if (existingStudent) {
        const { error: updateError } = await supabase
          .from("students")
          .update({
            full_name: formData.fullName,
            email: formData.email || null,
          })
          .eq("id", existingStudent.id);

        if (updateError) throw updateError;
        studentId = existingStudent.id;
      } else {
        const { data: newStudent, error: insertError } = await supabase
          .from("students")
          .insert({
            full_name: formData.fullName,
            roll_number: formData.rollNumber,
            email: formData.email || null,
            section_id: selectedSectionId,
            face_registered: false,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        studentId = newStudent.id;
      }

      // Call backend API for face training
      const result = await trainStudent({
        student_id: studentId,
        roll_number: formData.rollNumber,
        images: capturedImages.map(img => img.dataUrl),
      });

      if (result?.success) {
        // Update face_registered status in database
        await supabase
          .from("students")
          .update({ 
            face_registered: true,
            face_embedding_id: result.face_embedding_id,
          })
          .eq("id", studentId);

        setRecentTrainings(prev =>
          prev.map(t =>
            t.rollNumber === formData.rollNumber
              ? { ...t, status: "success" as const, message: result.message }
              : t
          )
        );

        // Reset form
        setFormData({ fullName: "", rollNumber: "", email: "" });
        setCapturedImages([]);
      } else {
        setRecentTrainings(prev =>
          prev.map(t =>
            t.rollNumber === formData.rollNumber
              ? { ...t, status: "failed" as const, message: result?.error || "Training failed" }
              : t
          )
        );
      }
    } catch (error: any) {
      setRecentTrainings(prev =>
        prev.map(t =>
          t.rollNumber === formData.rollNumber
            ? { ...t, status: "failed" as const, message: error.message }
            : t
        )
      );

      toast({
        title: "Training Failed",
        description: error.message || "An error occurred during training.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrainModel = async () => {
    if (!selectedSectionId) return;
    await trainModel(selectedSectionId);
  };

  const selectedSection = assignedSections.find(s => s.id === selectedSectionId);

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <ScanFace className="h-8 w-8 text-primary" />
              Face Training
            </h1>
            <p className="text-muted-foreground">
              Capture student faces and train the recognition model
            </p>
          </div>
          
          {/* API Status Indicator */}
          <div className="flex items-center gap-2">
            {checkingApi ? (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking API...
              </Badge>
            ) : isApiAvailable ? (
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle className="h-3 w-3" />
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

        {assignedSections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Sections Assigned</h3>
              <p className="text-muted-foreground">
                You don't have any subjects/sections assigned yet. Please contact an administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Training Form */}
            <div className="space-y-6">
              {/* Section Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Class Selection</CardTitle>
                  <CardDescription>
                    Students will be registered to the selected section
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    value={selectedSectionId}
                    onValueChange={setSelectedSectionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignedSections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.departmentCode} - {section.year} - Section {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedSection && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Department:</span>
                          <p className="font-medium">{selectedSection.department}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Year:</span>
                          <p className="font-medium">{selectedSection.year}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Section:</span>
                          <p className="font-medium">{selectedSection.name}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Model Status & Train Button */}
                  {modelStatus && (
                    <div className="p-3 bg-secondary/50 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Model Status</span>
                        <Badge variant={modelStatus.is_trained ? "default" : "secondary"}>
                          {modelStatus.is_trained ? "Trained" : "Not Trained"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {modelStatus.trained_students_count} / {modelStatus.students_count} students trained
                      </div>
                      <Progress 
                        value={(modelStatus.trained_students_count / Math.max(modelStatus.students_count, 1)) * 100} 
                        className="h-2"
                      />
                      {modelStatus.last_trained_at && (
                        <p className="text-xs text-muted-foreground">
                          Last trained: {new Date(modelStatus.last_trained_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handleTrainModel}
                    disabled={!selectedSectionId || isTrainingModel || !isApiAvailable}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    {isTrainingModel ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {isTrainingModel ? "Training Model..." : "Train Section Model"}
                  </Button>
                </CardContent>
              </Card>

              {/* Student Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Student Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTrainStudent} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        placeholder="Student Name"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rollNumber">Roll Number *</Label>
                      <Input
                        id="rollNumber"
                        placeholder="22KT1A4301"
                        value={formData.rollNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, rollNumber: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email (Optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="student@university.edu"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={isSubmitting || capturedImages.length < 5 || !isApiAvailable}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Train Student ({capturedImages.length}/5+ images)
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Camera and Capture */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Face Capture
                  </CardTitle>
                  <CardDescription>
                    Capture 5-10 clear face images for training
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Camera Preview */}
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
                        <AnimatePresence>
                          {isCapturing && (
                            <motion.div
                              initial={{ opacity: 1 }}
                              animate={{ opacity: 0 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-white"
                            />
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                        <CameraOff className="h-16 w-16 mb-4 opacity-50" />
                        <p className="text-lg">Camera is off</p>
                        <p className="text-sm">Click "Start Camera" to begin</p>
                      </div>
                    )}
                  </div>

                  {/* Hidden canvas for capture */}
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Camera Controls */}
                  <div className="flex gap-2">
                    {!isCameraActive ? (
                      <Button onClick={startCamera} className="flex-1 gap-2">
                        <Camera className="h-4 w-4" />
                        Start Camera
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={captureImage}
                          className="flex-1 gap-2"
                          disabled={capturedImages.length >= 10}
                        >
                          <Camera className="h-4 w-4" />
                          Capture ({capturedImages.length}/10)
                        </Button>
                        <Button variant="destructive" onClick={stopCamera}>
                          <CameraOff className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Captured Images */}
                  {capturedImages.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Captured Images ({capturedImages.length})
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllImages}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Clear All
                        </Button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {capturedImages.map((img) => (
                          <div key={img.id} className="relative group">
                            <img
                              src={img.dataUrl}
                              alt="Captured face"
                              className="w-full aspect-square object-cover rounded-lg"
                            />
                            <button
                              onClick={() => removeImage(img.id)}
                              className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Training Sessions */}
              {recentTrainings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Training</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recentTrainings.slice(0, 5).map((training, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{training.studentName}</p>
                            <p className="text-sm text-muted-foreground">
                              {training.rollNumber}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {training.status === "training" && (
                              <Badge variant="secondary" className="gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Training...
                              </Badge>
                            )}
                            {training.status === "success" && (
                              <Badge variant="default" className="gap-1 bg-green-600">
                                <CheckCircle className="h-3 w-3" />
                                Success
                              </Badge>
                            )}
                            {training.status === "failed" && (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Failed
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
