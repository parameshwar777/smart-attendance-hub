-- Fix overly permissive policy on attendance_logs
DROP POLICY IF EXISTS "System can insert logs" ON public.attendance_logs;

-- Replace with proper policy - only users who can modify attendance can insert logs
CREATE POLICY "Users can insert logs for attendance they manage" ON public.attendance_logs
FOR INSERT WITH CHECK (
    attendance_id IN (
        SELECT a.id FROM public.attendance a
        JOIN public.classes c ON a.class_id = c.id
        WHERE c.teacher_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
);