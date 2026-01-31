import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Camera,
  BarChart3,
  Users,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "AI Face Recognition",
    description: "Automatically detect and recognize multiple faces in real-time using advanced AI.",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    description: "Comprehensive attendance analytics with risk indicators and predictions.",
  },
  {
    icon: Users,
    title: "Multi-Role Access",
    description: "Separate dashboards for admins, teachers, and students with role-based permissions.",
  },
  {
    icon: Shield,
    title: "Secure & Reliable",
    description: "Enterprise-grade security with audit logs for all attendance modifications.",
  },
  {
    icon: Zap,
    title: "Fast Processing",
    description: "Mark attendance for entire classes in seconds with batch face recognition.",
  },
  {
    icon: GraduationCap,
    title: "University Hierarchy",
    description: "Full support for departments, years, sections, and subjects organization.",
  },
];

const benefits = [
  "Eliminate proxy attendance",
  "Save time on manual roll calls",
  "Real-time attendance tracking",
  "Automated eligibility calculations",
  "Comprehensive audit trails",
  "Easy integration with existing systems",
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-display font-bold text-foreground">AI Attendance</h1>
              <p className="text-xs text-muted-foreground">Smart Analytics System</p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/login">
              <Button className="gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-8">
              <Zap className="h-4 w-4" />
              AI-Powered Attendance System
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-6">
              Multi-Face Recognition
              <br />
              <span className="text-gradient-accent">Attendance & Analytics</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Transform your attendance management with AI-powered face recognition. 
              Mark attendance instantly, track analytics, and ensure eligibility compliance.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/login">
                <Button size="lg" className="gap-2 h-12 px-8 text-base">
                  Start Using Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                Watch Demo
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-20 max-w-4xl mx-auto"
          >
            {[
              { value: "99%", label: "Recognition Accuracy" },
              { value: "<2s", label: "Processing Time" },
              { value: "50+", label: "Faces Per Frame" },
              { value: "24/7", label: "System Uptime" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-3xl lg:text-4xl font-display font-bold text-foreground">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32 bg-secondary/30">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-display font-bold mb-4">
              Everything You Need
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A complete solution for modern attendance management with powerful features
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-xl bg-card border border-border hover:shadow-lg hover:border-accent/20 transition-all duration-300"
              >
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-lg font-display font-semibold mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl lg:text-4xl font-display font-bold mb-6">
                Why Choose Our
                <br />
                <span className="text-accent">AI Attendance System?</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Built for educational institutions that demand accuracy, efficiency, 
                and comprehensive insights into student attendance patterns.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                    <span className="text-sm">{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Link to="/login">
                  <Button size="lg" className="gap-2">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-square rounded-2xl bg-gradient-hero flex items-center justify-center p-12">
                <div className="w-full max-w-sm space-y-4">
                  {/* Mock attendance card */}
                  <div className="bg-card/90 backdrop-blur rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-accent/20" />
                      <div className="flex-1">
                        <div className="h-3 w-24 bg-foreground/20 rounded" />
                        <div className="h-2 w-16 bg-foreground/10 rounded mt-1" />
                      </div>
                      <div className="h-6 w-16 rounded-full bg-success/20 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-2 flex-1 bg-success/30 rounded" />
                    </div>
                  </div>
                  <div className="bg-card/90 backdrop-blur rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20" />
                      <div className="flex-1">
                        <div className="h-3 w-20 bg-foreground/20 rounded" />
                        <div className="h-2 w-14 bg-foreground/10 rounded mt-1" />
                      </div>
                      <div className="h-6 w-16 rounded-full bg-success/20 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-card/90 backdrop-blur rounded-xl p-4 shadow-xl opacity-80">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-warning/20" />
                      <div className="flex-1">
                        <div className="h-3 w-28 bg-foreground/20 rounded" />
                        <div className="h-2 w-12 bg-foreground/10 rounded mt-1" />
                      </div>
                      <div className="h-6 w-16 rounded-full bg-warning/20" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 bg-gradient-hero">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-primary-foreground mb-6">
              Ready to Transform Your Attendance System?
            </h2>
            <p className="text-primary-foreground/70 text-lg mb-8">
              Join hundreds of educational institutions using AI-powered attendance tracking.
            </p>
            <Link to="/login">
              <Button size="lg" variant="secondary" className="gap-2 h-12 px-8">
                Get Started Now
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display font-semibold">AI Attendance System</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
