import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export default function FaceTraining() {
  const { toast } = useToast();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Teacher's assigned subjects/sections
  const [assignedSections, setAssignedSections] = useState<any[]>([]);
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
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const fetchAssignedSections = async () => {
    try {
      // Get subjects assigned to current teacher
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

      // Extract unique sections
      const sectionsMap = new Map();
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

      // Auto-select first section if available
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
        video: { width: 640, height: 480, facingMode: "user" },
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

      // Flash effect
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

    // Add to recent trainings with pending status
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
        .single();

      let studentId: string;

      if (existingStudent) {
        // Update existing student
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
        // Create new student
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

      // TODO: Call backend API to process face images
      // POST /api/face-training
      // Body: { student_id, images: capturedImages.map(img => img.dataUrl) }
      
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update training status to success
      setRecentTrainings(prev =>
        prev.map(t =>
          t.rollNumber === formData.rollNumber
            ? { ...t, status: "success" as const, message: "Face model trained successfully" }
            : t
        )
      );

      toast({
        title: "Training Complete",
        description: `${formData.fullName} has been trained successfully.`,
      });

      // Reset form
      setFormData({
        fullName: "",
        rollNumber: "",
        email: "",
      });
      setCapturedImages([]);
    } catch (error: any) {
      // Update training status to failed
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

  const selectedSection = assignedSections.find(s => s.id === selectedSectionId);

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <ScanFace className="h-8 w-8 text-primary" />
            Face Training
          </h1>
          <p className="text-muted-foreground">
            Capture student faces and train the recognition model
          </p>
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
                <CardContent>
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
                    <div className="mt-4 p-3 bg-muted rounded-lg">
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
                      disabled={isSubmitting || capturedImages.length < 5}
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
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-white"
                            />
                          )}
                        </AnimatePresence>
                        {/* Single face guide overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-48 h-48 border-4 border-accent border-dashed rounded-full opacity-50" />
                        </div>
                        <Badge className="absolute top-3 left-3 bg-background/80">
                          Single Face Only
                        </Badge>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                        <CameraOff className="h-12 w-12 mb-3 opacity-50" />
                        <p>Camera is off</p>
                      </div>
                    )}
                  </div>

                  {/* Hidden canvas */}
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Camera Controls */}
                  <div className="flex gap-2">
                    {!isCameraActive ? (
                      <Button
                        type="button"
                        onClick={startCamera}
                        className="flex-1 gap-2"
                      >
                        <Camera className="h-4 w-4" />
                        Start Camera
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          onClick={captureImage}
                          className="flex-1 gap-2"
                          disabled={capturedImages.length >= 10}
                        >
                          <Camera className="h-4 w-4" />
                          Capture ({capturedImages.length}/10)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={stopCamera}
                        >
                          <CameraOff className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Captured Images */}
                  {capturedImages.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          Captured Images ({capturedImages.length})
                        </p>
                        <Button
                          type="button"
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
                          <motion.div
                            key={img.id}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="relative aspect-square group"
                          >
                            <img
                              src={img.dataUrl}
                              alt="Captured face"
                              className="w-full h-full object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(img.id)}
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                            >
                              <Trash2 className="h-4 w-4 text-white" />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Requirements */}
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="space-y-1 text-muted-foreground">
                        <p>• Only ONE student should be in frame</p>
                        <p>• Capture at least 5 clear face images</p>
                        <p>• Ensure good lighting and visibility</p>
                        <p>• Capture from slightly different angles</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Trainings */}
              {recentTrainings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Training Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recentTrainings.slice(0, 5).map((session, index) => (
                        <div
                          key={`${session.rollNumber}-${index}`}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{session.studentName}</p>
                            <p className="text-sm text-muted-foreground">
                              {session.rollNumber}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {session.status === "training" && (
                              <Badge variant="secondary" className="gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Training...
                              </Badge>
                            )}
                            {session.status === "success" && (
                              <Badge className="gap-1 bg-green-600">
                                <CheckCircle className="h-3 w-3" />
                                Success
                              </Badge>
                            )}
                            {session.status === "failed" && (
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
