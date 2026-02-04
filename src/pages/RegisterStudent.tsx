import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Camera,
  CameraOff,
  Check,
  Loader2,
  User,
  RefreshCw,
  Trash2,
  Save,
  AlertCircle,
} from "lucide-react";

interface CapturedImage {
  id: number;
  dataUrl: string;
}

export default function RegisterStudent() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [formData, setFormData] = useState({
    fullName: "",
    rollNumber: "",
    email: "",
    departmentId: "",
    yearId: "",
    sectionId: "",
  });

  const [departments, setDepartments] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (formData.departmentId) {
      fetchYears(formData.departmentId);
    }
  }, [formData.departmentId]);

  useEffect(() => {
    if (formData.yearId) {
      fetchSections(formData.yearId);
    }
  }, [formData.yearId]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from("departments").select("*").order("name");
    setDepartments(data || []);
  };

  const fetchYears = async (departmentId: string) => {
    const { data } = await supabase
      .from("years")
      .select("*")
      .eq("department_id", departmentId)
      .order("year_number");
    setYears(data || []);
    setFormData(prev => ({ ...prev, yearId: "", sectionId: "" }));
  };

  const fetchSections = async (yearId: string) => {
    const { data } = await supabase
      .from("sections")
      .select("*")
      .eq("year_id", yearId)
      .order("name");
    setSections(data || []);
    setFormData(prev => ({ ...prev, sectionId: "" }));
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: 640, height: 480, facingMode: { ideal: "user" } },
      });
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {
            // Ignore autoplay/playback errors; user gesture already occurred
          });
        };
        videoRef.current.srcObject = mediaStream;
        const maybePromise = videoRef.current.play();
        if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
          await maybePromise;
        }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.rollNumber || !formData.sectionId) {
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
        description: "Please capture at least 5 face images for registration.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert student record
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .insert({
          full_name: formData.fullName,
          roll_number: formData.rollNumber,
          email: formData.email || null,
          section_id: formData.sectionId,
          face_registered: false, // Will be updated after face embedding
        })
        .select()
        .single();

      if (studentError) throw studentError;

      // TODO: Call backend API to process face images and create embeddings
      // For now, we'll just store the student record
      
      toast({
        title: "Student Registered",
        description: `${formData.fullName} has been registered successfully. Face training will be processed.`,
      });

      // Reset form
      setFormData({
        fullName: "",
        rollNumber: "",
        email: "",
        departmentId: "",
        yearId: "",
        sectionId: "",
      });
      setCapturedImages([]);
      stopCamera();

    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred during registration.",
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
        className="space-y-6 max-w-4xl mx-auto"
      >
        <div>
          <h1 className="text-3xl font-display font-bold">Register Student</h1>
          <p className="text-muted-foreground">
            Register a new student with face capture for attendance recognition
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
          {/* Student Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Student Information
              </CardTitle>
              <CardDescription>
                Enter the student's personal and academic details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rollNumber">Roll Number *</Label>
                <Input
                  id="rollNumber"
                  placeholder="2024CS001"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Department *</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Year *</Label>
                  <Select
                    value={formData.yearId}
                    onValueChange={(value) => setFormData({ ...formData, yearId: value })}
                    disabled={!formData.departmentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Section *</Label>
                  <Select
                    value={formData.sectionId}
                    onValueChange={(value) => setFormData({ ...formData, sectionId: value })}
                    disabled={!formData.yearId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          Section {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Face Capture */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Face Capture
              </CardTitle>
              <CardDescription>
                Capture 5-10 face images for recognition training
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
                    {/* Face guide overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-4 border-accent border-dashed rounded-full opacity-50" />
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <CameraOff className="h-12 w-12 mb-3 opacity-50" />
                    <p>Camera is off</p>
                  </div>
                )}
              </div>

              {/* Hidden canvas for capture */}
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
                    <p>• Capture at least 5 clear face images</p>
                    <p>• Ensure good lighting and face visibility</p>
                    <p>• Capture from slightly different angles</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="lg:col-span-2">
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={isSubmitting || capturedImages.length < 5}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Register Student
                </>
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </DashboardLayout>
  );
}
