import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Camera,
  Percent,
  Clock,
  Save,
  Loader2,
} from "lucide-react";

interface SystemSettings {
  attendanceThreshold: number;
  faceConfidenceThreshold: number;
  autoMarkAbsent: boolean;
  autoMarkAbsentAfterMinutes: number;
  emailNotifications: boolean;
  lowAttendanceAlertThreshold: number;
}

export default function Settings() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>({
    attendanceThreshold: 75,
    faceConfidenceThreshold: 80,
    autoMarkAbsent: true,
    autoMarkAbsentAfterMinutes: 30,
    emailNotifications: true,
    lowAttendanceAlertThreshold: 60,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("systemSettings");
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Save to localStorage for now (can be migrated to DB later)
    localStorage.setItem("systemSettings", JSON.stringify(settings));
    
    toast({
      title: "Settings Saved",
      description: "Your settings have been updated successfully.",
    });
    
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 max-w-3xl"
      >
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <SettingsIcon className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground">
            Configure system-wide settings for the attendance system
          </p>
        </div>

        {/* Attendance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Attendance Thresholds
            </CardTitle>
            <CardDescription>
              Configure minimum attendance requirements and thresholds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="attendanceThreshold">
                Minimum Attendance Requirement (%)
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  id="attendanceThreshold"
                  type="number"
                  min={0}
                  max={100}
                  value={settings.attendanceThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      attendanceThreshold: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  Students below this threshold will be flagged
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="lowAttendanceAlert">
                Low Attendance Alert Threshold (%)
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  id="lowAttendanceAlert"
                  type="number"
                  min={0}
                  max={100}
                  value={settings.lowAttendanceAlertThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      lowAttendanceAlertThreshold: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  Send alerts when attendance drops below this level
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Face Recognition Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Face Recognition
            </CardTitle>
            <CardDescription>
              Configure face recognition sensitivity and accuracy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="faceConfidence">
                Minimum Face Confidence Score (%)
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  id="faceConfidence"
                  type="number"
                  min={50}
                  max={100}
                  value={settings.faceConfidenceThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      faceConfidenceThreshold: parseInt(e.target.value) || 80,
                    })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  Higher values reduce false positives but may miss some faces
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Marking Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Automatic Marking
            </CardTitle>
            <CardDescription>
              Configure automatic attendance marking behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-mark absent students</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically mark students as absent after class time
                </p>
              </div>
              <Switch
                checked={settings.autoMarkAbsent}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, autoMarkAbsent: checked })
                }
              />
            </div>

            {settings.autoMarkAbsent && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="autoAbsentMinutes">
                    Mark absent after (minutes)
                  </Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="autoAbsentMinutes"
                      type="number"
                      min={5}
                      max={120}
                      value={settings.autoMarkAbsentAfterMinutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          autoMarkAbsentAfterMinutes: parseInt(e.target.value) || 30,
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      Minutes after class start time
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send email alerts for low attendance
                </p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailNotifications: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
