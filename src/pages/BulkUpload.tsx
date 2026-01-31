import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Upload,
  FileSpreadsheet,
  FolderArchive,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
  Trash2,
  Play,
  GraduationCap,
} from "lucide-react";

interface ParsedStudent {
  serialNo: number;
  rollNumber: string;
  studentName: string;
  branch: string;
  semester: string;
  gender: string;
  status: "pending" | "uploading" | "success" | "failed" | "no_image";
  message?: string;
  hasImage?: boolean;
}

interface UploadedImage {
  serialNo: number;
  fileName: string;
  dataUrl: string;
}

export default function BulkUpload() {
  const { toast } = useToast();
  const { user } = useAuth();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const [assignedSections, setAssignedSections] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [currentTrainingStudent, setCurrentTrainingStudent] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAssignedSections();
    }
  }, [user]);

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

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setIsProcessing(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

      const students: ParsedStudent[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        
        // Map CSV columns
        const serialNoIdx = headers.findIndex(h => h.includes("s.no") || h.includes("serial"));
        const rollNoIdx = headers.findIndex(h => h.includes("roll"));
        const nameIdx = headers.findIndex(h => h.includes("name") && h.includes("student"));
        const branchIdx = headers.findIndex(h => h.includes("branch"));
        const semesterIdx = headers.findIndex(h => h.includes("semester"));
        const genderIdx = headers.findIndex(h => h.includes("gender"));

        if (values.length > 1) {
          students.push({
            serialNo: parseInt(values[serialNoIdx] || `${i}`) || i,
            rollNumber: values[rollNoIdx] || "",
            studentName: values[nameIdx] || "",
            branch: values[branchIdx] || "",
            semester: values[semesterIdx] || "",
            gender: values[genderIdx] || "",
            status: "pending",
          });
        }
      }

      // Check if images exist for each student
      const updatedStudents = students.map(student => ({
        ...student,
        hasImage: uploadedImages.some(img => img.serialNo === student.serialNo),
        status: uploadedImages.some(img => img.serialNo === student.serialNo) 
          ? "pending" as const 
          : "no_image" as const,
      }));

      setParsedStudents(updatedStudents);

      toast({
        title: "CSV Parsed",
        description: `Found ${students.length} students in the file.`,
      });
    } catch (error) {
      toast({
        title: "Parse Error",
        description: "Failed to parse CSV file. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setZipFile(file);
    setIsProcessing(true);

    try {
      // Dynamic import JSZip
      const JSZipModule = await import("jszip");
      const JSZip = JSZipModule.default;
      const zip = await JSZip.loadAsync(file);

      const images: UploadedImage[] = [];

      const fileNames = Object.keys(zip.files);
      for (const fileName of fileNames) {
        const zipEntry = zip.files[fileName];
        if (!zipEntry.dir && /\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
          // Extract serial number from filename (e.g., "1.jpg", "001.png")
          const match = fileName.match(/(\d+)\.(jpg|jpeg|png|webp)$/i);
          if (match) {
            const serialNo = parseInt(match[1]);
            const blob = await zipEntry.async("blob");
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });

            images.push({
              serialNo,
              fileName: fileName.split("/").pop() || fileName,
              dataUrl,
            });
          }
        }
      }

      setUploadedImages(images);

      // Update parsed students with image availability
      if (parsedStudents.length > 0) {
        const updatedStudents = parsedStudents.map(student => ({
          ...student,
          hasImage: images.some(img => img.serialNo === student.serialNo),
          status: images.some(img => img.serialNo === student.serialNo) 
            ? "pending" as const 
            : "no_image" as const,
        }));
        setParsedStudents(updatedStudents);
      }

      toast({
        title: "Images Extracted",
        description: `Found ${images.length} images in the ZIP file.`,
      });
    } catch (error) {
      toast({
        title: "Extract Error",
        description: "Failed to extract ZIP file. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const startBulkTraining = async () => {
    if (!selectedSectionId) {
      toast({
        title: "Error",
        description: "Please select a section first.",
        variant: "destructive",
      });
      return;
    }

    const studentsToTrain = parsedStudents.filter(s => s.status === "pending" && s.hasImage);
    if (studentsToTrain.length === 0) {
      toast({
        title: "No Students to Train",
        description: "All students are either missing images or already processed.",
        variant: "destructive",
      });
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);

    for (let i = 0; i < studentsToTrain.length; i++) {
      const student = studentsToTrain[i];
      setCurrentTrainingStudent(student.studentName);

      // Update status to uploading
      setParsedStudents(prev =>
        prev.map(s =>
          s.serialNo === student.serialNo ? { ...s, status: "uploading" as const } : s
        )
      );

      try {
        // Check if student exists
        const { data: existingStudent } = await supabase
          .from("students")
          .select("id")
          .eq("roll_number", student.rollNumber)
          .single();

        let studentId: string;

        if (existingStudent) {
          studentId = existingStudent.id;
        } else {
          // Create new student
          const { data: newStudent, error } = await supabase
            .from("students")
            .insert({
              full_name: student.studentName,
              roll_number: student.rollNumber,
              section_id: selectedSectionId,
              face_registered: false,
            })
            .select()
            .single();

          if (error) throw error;
          studentId = newStudent.id;
        }

        // Get the image for this student
        const studentImage = uploadedImages.find(img => img.serialNo === student.serialNo);

        // TODO: Call backend API for face training
        // POST /api/face-training
        // Body: { student_id: studentId, images: [studentImage?.dataUrl] }
        
        // Simulate training
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update status to success
        setParsedStudents(prev =>
          prev.map(s =>
            s.serialNo === student.serialNo
              ? { ...s, status: "success" as const, message: "Trained successfully" }
              : s
          )
        );
      } catch (error: any) {
        // Update status to failed
        setParsedStudents(prev =>
          prev.map(s =>
            s.serialNo === student.serialNo
              ? { ...s, status: "failed" as const, message: error.message }
              : s
          )
        );
      }

      setTrainingProgress(((i + 1) / studentsToTrain.length) * 100);
    }

    setIsTraining(false);
    setCurrentTrainingStudent(null);

    const successCount = parsedStudents.filter(s => s.status === "success").length;
    toast({
      title: "Bulk Training Complete",
      description: `Successfully trained ${successCount} students.`,
    });
  };

  const clearAll = () => {
    setCsvFile(null);
    setZipFile(null);
    setParsedStudents([]);
    setUploadedImages([]);
    setTrainingProgress(0);
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (zipInputRef.current) zipInputRef.current.value = "";
  };

  const downloadSampleCsv = () => {
    const sampleData = `S.No,Roll.No,Student Name,Branch,Semester,Gender
1,22KT1A4301,ADIVARAPU KAVYA SRI,CSE-AI,VIII Semester,F
2,22KT1A4302,BHIMANA CHARITHASRI,CSE-AI,VIII Semester,F
3,22KT1A4303,STUDENT NAME,CSE-AI,VIII Semester,M`;

    const blob = new Blob([sampleData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_students.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedSection = assignedSections.find(s => s.id === selectedSectionId);
  const pendingCount = parsedStudents.filter(s => s.status === "pending" && s.hasImage).length;
  const successCount = parsedStudents.filter(s => s.status === "success").length;
  const failedCount = parsedStudents.filter(s => s.status === "failed").length;
  const noImageCount = parsedStudents.filter(s => !s.hasImage).length;

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
            <Upload className="h-8 w-8 text-primary" />
            Bulk Upload & Training
          </h1>
          <p className="text-muted-foreground">
            Upload CSV with student data and ZIP with face images for bulk training
          </p>
        </div>

        {assignedSections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Sections Assigned</h3>
              <p className="text-muted-foreground">
                You don't have any subjects/sections assigned yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Section Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Target Section</CardTitle>
                <CardDescription>
                  All students will be registered to this section
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedSectionId}
                  onValueChange={setSelectedSectionId}
                >
                  <SelectTrigger className="max-w-md">
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
              </CardContent>
            </Card>

            {/* Upload Cards */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* CSV Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Student Data (CSV)
                  </CardTitle>
                  <CardDescription>
                    Upload CSV with columns: S.No, Roll.No, Student Name, Branch, Semester, Gender
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {csvFile ? csvFile.name : "Click to upload CSV"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CSV file with student details
                      </p>
                    </label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadSampleCsv}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Sample CSV
                  </Button>
                </CardContent>
              </Card>

              {/* ZIP Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderArchive className="h-5 w-5" />
                    Face Images (ZIP)
                  </CardTitle>
                  <CardDescription>
                    Upload ZIP with images named by serial number (e.g., 1.jpg, 2.png)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      ref={zipInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleZipUpload}
                      className="hidden"
                      id="zip-upload"
                    />
                    <label
                      htmlFor="zip-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <FolderArchive className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {zipFile ? zipFile.name : "Click to upload ZIP"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ZIP file with face images
                      </p>
                    </label>
                  </div>
                  {uploadedImages.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {uploadedImages.length} images extracted
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Training Status */}
            {parsedStudents.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Training Status</CardTitle>
                      <CardDescription>
                        {parsedStudents.length} students loaded from CSV
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAll}
                        disabled={isTraining}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                      </Button>
                      <Button
                        size="sm"
                        onClick={startBulkTraining}
                        disabled={isTraining || pendingCount === 0}
                        className="gap-2"
                      >
                        {isTraining ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Start Training ({pendingCount})
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">{pendingCount}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">{successCount}</p>
                      <p className="text-xs text-green-600">Success</p>
                    </div>
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg text-center">
                      <p className="text-2xl font-bold text-red-600">{failedCount}</p>
                      <p className="text-xs text-red-600">Failed</p>
                    </div>
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg text-center">
                      <p className="text-2xl font-bold text-yellow-600">{noImageCount}</p>
                      <p className="text-xs text-yellow-600">No Image</p>
                    </div>
                  </div>

                  {/* Progress */}
                  {isTraining && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Training: {currentTrainingStudent}</span>
                        <span>{Math.round(trainingProgress)}%</span>
                      </div>
                      <Progress value={trainingProgress} />
                    </div>
                  )}

                  {/* Students Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">S.No</TableHead>
                          <TableHead>Roll Number</TableHead>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead className="w-24">Image</TableHead>
                          <TableHead className="w-32">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedStudents.slice(0, 20).map((student) => (
                          <TableRow key={student.serialNo}>
                            <TableCell>{student.serialNo}</TableCell>
                            <TableCell className="font-mono">
                              {student.rollNumber}
                            </TableCell>
                            <TableCell>{student.studentName}</TableCell>
                            <TableCell>{student.branch}</TableCell>
                            <TableCell>
                              {student.hasImage ? (
                                <Badge variant="secondary" className="gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Yes
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-yellow-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  Missing
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {student.status === "pending" && (
                                <Badge variant="secondary">Pending</Badge>
                              )}
                              {student.status === "uploading" && (
                                <Badge variant="secondary" className="gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Training
                                </Badge>
                              )}
                              {student.status === "success" && (
                                <Badge className="bg-green-600 gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Success
                                </Badge>
                              )}
                              {student.status === "failed" && (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Failed
                                </Badge>
                              )}
                              {student.status === "no_image" && (
                                <Badge variant="outline" className="text-yellow-600">
                                  No Image
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {parsedStudents.length > 20 && (
                      <div className="p-3 text-center text-sm text-muted-foreground border-t">
                        Showing 20 of {parsedStudents.length} students
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
