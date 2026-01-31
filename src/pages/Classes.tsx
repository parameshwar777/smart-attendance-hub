import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Users,
  Plus,
  Calendar,
  Clock,
  BookOpen,
  Loader2,
} from "lucide-react";

interface ClassSchedule {
  id: string;
  class_date: string;
  start_time: string;
  end_time: string;
  status: string;
  subject: {
    name: string;
    code: string;
  };
}

export default function Classes() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [newClass, setNewClass] = useState({
    subjectId: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "10:00",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("classes")
      .select(`
        id,
        class_date,
        start_time,
        end_time,
        status,
        subjects (
          name,
          code
        )
      `)
      .order("class_date", { ascending: false });

    if (!error && data) {
      const formattedClasses = data.map((c: any) => ({
        id: c.id,
        class_date: c.class_date,
        start_time: c.start_time,
        end_time: c.end_time,
        status: c.status,
        subject: {
          name: c.subjects?.name || "Unknown",
          code: c.subjects?.code || "",
        },
      }));
      setClasses(formattedClasses);
    }
    setLoading(false);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase
      .from("subjects")
      .select(`
        id,
        name,
        code,
        sections (
          name,
          years (
            name,
            departments (name)
          )
        )
      `)
      .order("name");
    setSubjects(data || []);
  };

  const addClass = async () => {
    if (!newClass.subjectId) {
      toast({
        title: "Missing Information",
        description: "Please select a subject.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("classes").insert({
      subject_id: newClass.subjectId,
      class_date: newClass.date,
      start_time: newClass.startTime,
      end_time: newClass.endTime,
      teacher_id: userData.user?.id,
      status: "scheduled",
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
        description: "Class scheduled successfully.",
      });
      setNewClass({
        subjectId: "",
        date: new Date().toISOString().split("T")[0],
        startTime: "09:00",
        endTime: "10:00",
      });
      setIsAddingClass(false);
      fetchClasses();
    }
    setIsSubmitting(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "in_progress":
        return "bg-warning/10 text-warning border-warning/20";
      case "cancelled":
        return "bg-danger/10 text-danger border-danger/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
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
            <h1 className="text-3xl font-display font-bold">Classes</h1>
            <p className="text-muted-foreground">
              Schedule and manage your class sessions
            </p>
          </div>
          <Dialog open={isAddingClass} onOpenChange={setIsAddingClass}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Schedule Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule New Class</DialogTitle>
                <DialogDescription>
                  Create a new class session
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select
                    value={newClass.subjectId}
                    onValueChange={(value) => setNewClass({ ...newClass, subjectId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name} ({subject.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newClass.date}
                    onChange={(e) => setNewClass({ ...newClass, date: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={newClass.startTime}
                      onChange={(e) => setNewClass({ ...newClass, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={newClass.endTime}
                      onChange={(e) => setNewClass({ ...newClass, endTime: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={addClass} className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Schedule Class
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              All Classes
            </CardTitle>
            <CardDescription>
              {classes.length} class(es) scheduled
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : classes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No classes scheduled</p>
                <p className="text-sm">Schedule your first class to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
                              <BookOpen className="h-4 w-4 text-accent" />
                            </div>
                            <div>
                              <p className="font-medium">{cls.subject.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {cls.subject.code}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(cls.class_date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {cls.start_time} - {cls.end_time}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                              cls.status
                            )}`}
                          >
                            {cls.status.charAt(0).toUpperCase() + cls.status.slice(1).replace("_", " ")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
