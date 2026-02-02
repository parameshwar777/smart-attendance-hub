import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpen,
  Plus,
  Loader2,
  Search,
  Trash2,
  Users,
  Building2,
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Year {
  id: string;
  name: string;
  year_number: number;
  department_id: string;
}

interface Section {
  id: string;
  name: string;
  year_id: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  section_id: string;
  teacher_id: string | null;
  section: {
    id: string;
    name: string;
    year: {
      id: string;
      name: string;
      department: {
        id: string;
        name: string;
        code: string;
      };
    };
  };
  teacher?: {
    full_name: string;
    email: string;
  } | null;
}

export default function Subjects() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [years, setYears] = useState<Year[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    sectionId: "",
  });

  // Filter states for the form
  const [formDept, setFormDept] = useState<string>("");
  const [formYear, setFormYear] = useState<string>("");

  useEffect(() => {
    fetchSubjects();
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (formDept) {
      fetchYears(formDept);
    } else {
      setYears([]);
      setFormYear("");
    }
  }, [formDept]);

  useEffect(() => {
    if (formYear) {
      fetchSections(formYear);
    } else {
      setSections([]);
      setFormData(prev => ({ ...prev, sectionId: "" }));
    }
  }, [formYear]);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, code")
      .order("name");

    if (!error && data) {
      setDepartments(data);
    }
  };

  const fetchYears = async (deptId: string) => {
    const { data, error } = await supabase
      .from("years")
      .select("id, name, year_number, department_id")
      .eq("department_id", deptId)
      .order("year_number");

    if (!error && data) {
      setYears(data);
    }
  };

  const fetchSections = async (yearId: string) => {
    const { data, error } = await supabase
      .from("sections")
      .select("id, name, year_id")
      .eq("year_id", yearId)
      .order("name");

    if (!error && data) {
      setSections(data);
    }
  };

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select(`
          id,
          name,
          code,
          section_id,
          teacher_id,
          sections!inner (
            id,
            name,
            years!inner (
              id,
              name,
              departments!inner (
                id,
                name,
                code
              )
            )
          )
        `)
        .order("name");

      if (error) throw error;

      // Get teacher info for subjects with teachers
      const teacherIds = (data || [])
        .filter(s => s.teacher_id)
        .map(s => s.teacher_id);

      let teacherMap: Record<string, { full_name: string; email: string }> = {};

      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", teacherIds);

        if (profiles) {
          profiles.forEach(p => {
            teacherMap[p.user_id] = { full_name: p.full_name, email: p.email };
          });
        }
      }

      const mappedSubjects: Subject[] = (data || []).map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        section_id: s.section_id,
        teacher_id: s.teacher_id,
        section: {
          id: (s.sections as any).id,
          name: (s.sections as any).name,
          year: {
            id: (s.sections as any).years.id,
            name: (s.sections as any).years.name,
            department: {
              id: (s.sections as any).years.departments.id,
              name: (s.sections as any).years.departments.name,
              code: (s.sections as any).years.departments.code,
            },
          },
        },
        teacher: s.teacher_id ? teacherMap[s.teacher_id] || null : null,
      }));

      setSubjects(mappedSubjects);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch subjects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code || !formData.sectionId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("subjects")
        .insert({
          name: formData.name,
          code: formData.code.toUpperCase(),
          section_id: formData.sectionId,
        });

      if (error) throw error;

      toast({
        title: "Subject Created",
        description: `${formData.name} has been added successfully.`,
      });

      setFormData({ name: "", code: "", sectionId: "" });
      setFormDept("");
      setFormYear("");
      setDialogOpen(false);
      fetchSubjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create subject",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;

    try {
      const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Subject Deleted",
        description: "Subject has been removed successfully.",
      });

      fetchSubjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete subject",
        variant: "destructive",
      });
    }
  };

  const filteredSubjects = subjects.filter(
    subject =>
      subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.section.year.department.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <h1 className="text-3xl font-display font-bold">Subjects</h1>
            <p className="text-muted-foreground">
              Manage subjects and assign them to sections
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Subject</DialogTitle>
                <DialogDescription>
                  Add a new subject to a section. Teachers can be assigned later from the Teachers page.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSubject} className="space-y-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={formDept} onValueChange={(val) => {
                    setFormDept(val);
                    setFormYear("");
                    setFormData(prev => ({ ...prev, sectionId: "" }));
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select 
                    value={formYear} 
                    onValueChange={(val) => {
                      setFormYear(val);
                      setFormData(prev => ({ ...prev, sectionId: "" }));
                    }}
                    disabled={!formDept}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formDept ? "Select year" : "Select department first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select 
                    value={formData.sectionId} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, sectionId: val }))}
                    disabled={!formYear}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formYear ? "Select section" : "Select year first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map(section => (
                        <SelectItem key={section.id} value={section.id}>
                          Section {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Subject Name</Label>
                  <Input
                    id="name"
                    placeholder="Data Structures"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Subject Code</Label>
                  <Input
                    id="code"
                    placeholder="CS201"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="uppercase"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Subject
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subjects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Subjects Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              All Subjects ({filteredSubjects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSubjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No subjects found</p>
                <p className="text-sm">Create a subject to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Year / Section</TableHead>
                    <TableHead>Assigned Teacher</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{subject.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {subject.section.year.department.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {subject.section.year.name} - Section {subject.section.name}
                      </TableCell>
                      <TableCell>
                        {subject.teacher ? (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{subject.teacher.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSubject(subject.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
