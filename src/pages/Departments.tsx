import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Loader2,
  GraduationCap,
  BookOpen,
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  code: string;
  years: Year[];
}

interface Year {
  id: string;
  name: string;
  year_number: number;
  sections: Section[];
}

interface Section {
  id: string;
  name: string;
}

export default function Departments() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", code: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [isAddingYear, setIsAddingYear] = useState(false);
  const [newYear, setNewYear] = useState({ name: "", yearNumber: 1 });
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [selectedYear, setSelectedYear] = useState<Year | null>(null);
  const [newSection, setNewSection] = useState({ name: "" });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("departments")
      .select(`
        id,
        name,
        code,
        years (
          id,
          name,
          year_number,
          sections (
            id,
            name
          )
        )
      `)
      .order("name");

    if (!error && data) {
      setDepartments(data as any);
    }
    setLoading(false);
  };

  const addDepartment = async () => {
    if (!newDept.name || !newDept.code) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase
      .from("departments")
      .insert({ name: newDept.name, code: newDept.code.toUpperCase() });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Department added successfully.",
      });
      setNewDept({ name: "", code: "" });
      setIsAddingDept(false);
      fetchDepartments();
    }
    setIsSubmitting(false);
  };

  const addYear = async () => {
    if (!selectedDept || !newYear.name) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from("years").insert({
      name: newYear.name,
      year_number: newYear.yearNumber,
      department_id: selectedDept.id,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Year added successfully.",
      });
      setNewYear({ name: "", yearNumber: 1 });
      setIsAddingYear(false);
      fetchDepartments();
    }
    setIsSubmitting(false);
  };

  const addSection = async () => {
    if (!selectedYear || !newSection.name) {
      toast({
        title: "Missing Information",
        description: "Please enter a section name.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from("sections").insert({
      name: newSection.name.toUpperCase(),
      year_id: selectedYear.id,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Section added successfully.",
      });
      setNewSection({ name: "" });
      setIsAddingSection(false);
      fetchDepartments();
    }
    setIsSubmitting(false);
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Departments</h1>
            <p className="text-muted-foreground">
              Manage university hierarchy: Departments → Years → Sections
            </p>
          </div>
          <Dialog open={isAddingDept} onOpenChange={setIsAddingDept}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Department</DialogTitle>
                <DialogDescription>
                  Create a new department in the university
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Department Name</Label>
                  <Input
                    placeholder="Computer Science"
                    value={newDept.name}
                    onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department Code</Label>
                  <Input
                    placeholder="CS"
                    value={newDept.code}
                    onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                    className="uppercase"
                  />
                </div>
                <Button onClick={addDepartment} className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Department
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : departments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No departments yet</p>
              <p className="text-sm">Add your first department to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {departments.map((dept) => (
              <Card key={dept.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{dept.name}</CardTitle>
                        <CardDescription>Code: {dept.code}</CardDescription>
                      </div>
                    </div>
                    <Dialog open={isAddingYear && selectedDept?.id === dept.id} onOpenChange={(open) => {
                      setIsAddingYear(open);
                      if (open) setSelectedDept(dept);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Plus className="h-4 w-4" />
                          Add Year
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Year to {dept.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label>Year Name</Label>
                            <Input
                              placeholder="First Year"
                              value={newYear.name}
                              onChange={(e) => setNewYear({ ...newYear, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Year Number</Label>
                            <Input
                              type="number"
                              min={1}
                              max={6}
                              value={newYear.yearNumber}
                              onChange={(e) => setNewYear({ ...newYear, yearNumber: parseInt(e.target.value) })}
                            />
                          </div>
                          <Button onClick={addYear} className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add Year
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {dept.years && dept.years.length > 0 ? (
                    <div className="space-y-4">
                      {dept.years.sort((a, b) => a.year_number - b.year_number).map((year) => (
                        <div key={year.id} className="p-4 rounded-lg bg-secondary/50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{year.name}</span>
                            </div>
                            <Dialog open={isAddingSection && selectedYear?.id === year.id} onOpenChange={(open) => {
                              setIsAddingSection(open);
                              if (open) setSelectedYear(year);
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 gap-1">
                                  <Plus className="h-3 w-3" />
                                  Section
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Add Section to {year.name}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 pt-4">
                                  <div className="space-y-2">
                                    <Label>Section Name</Label>
                                    <Input
                                      placeholder="A"
                                      value={newSection.name}
                                      onChange={(e) => setNewSection({ name: e.target.value })}
                                      className="uppercase"
                                    />
                                  </div>
                                  <Button onClick={addSection} className="w-full" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Section
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                          {year.sections && year.sections.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {year.sections.map((section) => (
                                <div
                                  key={section.id}
                                  className="px-3 py-1.5 bg-background rounded-lg text-sm border"
                                >
                                  Section {section.name}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No sections yet</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No years added yet
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
