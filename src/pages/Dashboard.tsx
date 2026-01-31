import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Users,
  GraduationCap,
  ClipboardCheck,
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  todayAttendance: number;
  averageAttendance: number;
  atRiskStudents: number;
}

export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalClasses: 0,
    todayAttendance: 0,
    averageAttendance: 0,
    atRiskStudents: 0,
  });
  const [todaysClasses, setTodaysClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user, role]);

  const fetchDashboardData = async () => {
    try {
      // Fetch students count
      const { count: studentsCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true });

      // Fetch today's classes
      const today = new Date().toISOString().split("T")[0];
      const { data: classesData } = await supabase
        .from("classes")
        .select(`
          *,
          subjects (name, code)
        `)
        .eq("class_date", today);

      setStats({
        totalStudents: studentsCount || 0,
        totalClasses: classesData?.length || 0,
        todayAttendance: 0,
        averageAttendance: 85, // Placeholder
        atRiskStudents: 0,
      });

      setTodaysClasses(classesData || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
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
        className="space-y-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="space-y-1">
          <h1 className="text-3xl font-display font-bold">
            Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your attendance today.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={itemVariants}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            title="Total Students"
            value={stats.totalStudents}
            icon={GraduationCap}
            variant="default"
          />
          <StatCard
            title="Today's Classes"
            value={stats.totalClasses}
            icon={Calendar}
            variant="accent"
          />
          <StatCard
            title="Average Attendance"
            value={`${stats.averageAttendance}%`}
            icon={TrendingUp}
            variant="success"
            subtitle="This month"
          />
          <StatCard
            title="At Risk Students"
            value={stats.atRiskStudents}
            icon={AlertTriangle}
            variant={stats.atRiskStudents > 0 ? "danger" : "default"}
            subtitle="Below 70%"
          />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today's Classes */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Today's Classes</CardTitle>
                  <CardDescription>
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </CardDescription>
                </div>
                {role === "teacher" && (
                  <Button
                    onClick={() => navigate("/attendance")}
                    className="gap-2"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    Take Attendance
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {todaysClasses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No classes scheduled for today</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todaysClasses.map((cls, index) => (
                      <div
                        key={cls.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-accent" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {cls.subjects?.name || "Unknown Subject"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {cls.start_time} - {cls.end_time}
                            </p>
                          </div>
                        </div>
                        <StatusBadge
                          variant={
                            cls.status === "completed"
                              ? "safe"
                              : cls.status === "in_progress"
                              ? "warning"
                              : "default"
                          }
                        >
                          {cls.status === "completed"
                            ? "Completed"
                            : cls.status === "in_progress"
                            ? "In Progress"
                            : "Scheduled"}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>
                  Common tasks and shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {role !== "student" && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-14 px-4"
                      onClick={() => navigate("/register-student")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                          <GraduationCap className="h-4 w-4 text-accent" />
                        </div>
                        <span>Register New Student</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-14 px-4"
                      onClick={() => navigate("/students")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <span>View All Students</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-between h-14 px-4"
                  onClick={() => navigate("/analytics")}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-success" />
                    </div>
                    <span>View Analytics</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Attendance Overview */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attendance Overview</CardTitle>
              <CardDescription>
                Real-time attendance statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-success/5 border border-success/20">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                  <div>
                    <p className="text-2xl font-bold font-display">85%</p>
                    <p className="text-sm text-muted-foreground">Present Today</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-warning/5 border border-warning/20">
                  <Clock className="h-8 w-8 text-warning" />
                  <div>
                    <p className="text-2xl font-bold font-display">10%</p>
                    <p className="text-sm text-muted-foreground">Late Arrivals</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-danger/5 border border-danger/20">
                  <AlertTriangle className="h-8 w-8 text-danger" />
                  <div>
                    <p className="text-2xl font-bold font-display">5%</p>
                    <p className="text-sm text-muted-foreground">Absent</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
