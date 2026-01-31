import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  GraduationCap,
  Calendar,
} from "lucide-react";

interface StudentAnalytics {
  id: string;
  rollNumber: string;
  fullName: string;
  totalClasses: number;
  attended: number;
  missed: number;
  attendancePercentage: number;
  classesNeededFor80: number;
  riskLevel: "safe" | "warning" | "risk";
}

export default function Analytics() {
  const { role } = useAuth();
  const [students, setStudents] = useState<StudentAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  useEffect(() => {
    fetchDepartments();
    fetchAnalytics();
  }, []);

  const fetchDepartments = async () => {
    const { data } = await supabase.from("departments").select("*").order("name");
    setDepartments(data || []);
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    
    // Fetch all students with their attendance records
    const { data: studentsData } = await supabase
      .from("students")
      .select(`
        id,
        roll_number,
        full_name,
        section_id,
        sections (
          year_id,
          years (
            department_id
          )
        )
      `);

    if (!studentsData) {
      setLoading(false);
      return;
    }

    // For each student, calculate their analytics
    const analyticsPromises = studentsData.map(async (student: any) => {
      // Get total classes for this student's section
      const { count: totalClasses } = await supabase
        .from("classes")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      // Get attended classes
      const { count: attendedCount } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.id)
        .eq("status", "present");

      const total = totalClasses || 0;
      const attended = attendedCount || 0;
      const missed = total - attended;
      const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
      
      // Calculate classes needed for 80%
      // Formula: (attended + x) / (total + x) = 0.8
      // Solving: x = (0.8 * total - attended) / 0.2
      let classesNeeded = 0;
      if (percentage < 80 && total > 0) {
        classesNeeded = Math.ceil((0.8 * total - attended) / 0.2);
        if (classesNeeded < 0) classesNeeded = 0;
      }

      const riskLevel: "safe" | "warning" | "risk" = 
        percentage >= 80 ? "safe" :
        percentage >= 70 ? "warning" : "risk";

      return {
        id: student.id,
        rollNumber: student.roll_number,
        fullName: student.full_name,
        departmentId: student.sections?.years?.department_id,
        totalClasses: total,
        attended,
        missed,
        attendancePercentage: percentage,
        classesNeededFor80: classesNeeded,
        riskLevel,
      };
    });

    const analytics = await Promise.all(analyticsPromises);
    setStudents(analytics);
    setLoading(false);
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = 
      student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRisk = 
      riskFilter === "all" || student.riskLevel === riskFilter;

    const matchesDepartment = 
      selectedDepartment === "all" || 
      (student as any).departmentId === selectedDepartment;

    return matchesSearch && matchesRisk && matchesDepartment;
  });

  const stats = {
    totalStudents: students.length,
    safeStudents: students.filter(s => s.riskLevel === "safe").length,
    warningStudents: students.filter(s => s.riskLevel === "warning").length,
    riskStudents: students.filter(s => s.riskLevel === "risk").length,
    averageAttendance: students.length > 0 
      ? Math.round(students.reduce((acc, s) => acc + s.attendancePercentage, 0) / students.length)
      : 0,
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <DashboardLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-display font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive attendance analytics and student performance insights
          </p>
        </motion.div>

        {/* Stats Overview */}
        <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Students"
            value={stats.totalStudents}
            icon={Users}
            variant="default"
          />
          <StatCard
            title="Average Attendance"
            value={`${stats.averageAttendance}%`}
            icon={TrendingUp}
            variant="accent"
          />
          <StatCard
            title="Safe (≥80%)"
            value={stats.safeStudents}
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            title="Warning (70-79%)"
            value={stats.warningStudents}
            icon={AlertTriangle}
            variant="warning"
          />
          <StatCard
            title="At Risk (<70%)"
            value={stats.riskStudents}
            icon={TrendingDown}
            variant="danger"
          />
        </motion.div>

        {/* Filters */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or roll number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="safe">Safe</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="risk">At Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Students Table */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Student Attendance Details
              </CardTitle>
              <CardDescription>
                Detailed breakdown of attendance for each student
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No students found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead className="text-center">Total Classes</TableHead>
                        <TableHead className="text-center">Attended</TableHead>
                        <TableHead className="text-center">Missed</TableHead>
                        <TableHead className="text-center">Attendance %</TableHead>
                        <TableHead className="text-center">Classes for 80%</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{student.fullName}</p>
                              <p className="text-sm text-muted-foreground">
                                {student.rollNumber}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {student.totalClasses}
                          </TableCell>
                          <TableCell className="text-center text-success">
                            {student.attended}
                          </TableCell>
                          <TableCell className="text-center text-danger">
                            {student.missed}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Progress 
                                value={student.attendancePercentage} 
                                className="h-2 w-20"
                              />
                              <span className="text-sm font-medium w-12 text-right">
                                {student.attendancePercentage}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {student.riskLevel === "safe" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="font-medium text-warning">
                                +{student.classesNeededFor80}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge variant={student.riskLevel}>
                              {student.riskLevel === "safe" && "Safe"}
                              {student.riskLevel === "warning" && "Warning"}
                              {student.riskLevel === "risk" && "At Risk"}
                            </StatusBadge>
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
      </motion.div>
    </DashboardLayout>
  );
}
