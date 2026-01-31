-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- Create user_roles table (critical for security - roles must be in separate table)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create profiles table for user details
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create departments table
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create years table
CREATE TABLE public.years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    year_number INTEGER NOT NULL CHECK (year_number >= 1 AND year_number <= 6),
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (department_id, year_number)
);

-- Create sections table
CREATE TABLE public.sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    year_id UUID REFERENCES public.years(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (year_id, name)
);

-- Create subjects table
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create students table
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    roll_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT,
    section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE NOT NULL,
    face_registered BOOLEAN NOT NULL DEFAULT false,
    face_embedding_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create classes table (scheduled classes)
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    class_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'excused')),
    marked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_manual_override BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    face_confidence DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (class_id, student_id)
);

-- Create attendance_logs for audit trail
CREATE TABLE public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Get user's role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage profiles" ON public.profiles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for departments (viewable by all authenticated)
CREATE POLICY "Authenticated users can view departments" ON public.departments
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage departments" ON public.departments
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for years
CREATE POLICY "Authenticated users can view years" ON public.years
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage years" ON public.years
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sections
CREATE POLICY "Authenticated users can view sections" ON public.sections
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage sections" ON public.sections
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for subjects
CREATE POLICY "Authenticated users can view subjects" ON public.subjects
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers can view assigned subjects" ON public.subjects
FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Admins can manage subjects" ON public.subjects
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for students
CREATE POLICY "Students can view own record" ON public.students
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Teachers can view students in their classes" ON public.students
FOR SELECT USING (
    public.has_role(auth.uid(), 'teacher') AND
    section_id IN (
        SELECT s.section_id FROM public.subjects s WHERE s.teacher_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage students" ON public.students
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can register students" ON public.students
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update students" ON public.students
FOR UPDATE USING (public.has_role(auth.uid(), 'teacher'));

-- RLS Policies for classes
CREATE POLICY "Teachers can view own classes" ON public.classes
FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Students can view their classes" ON public.classes
FOR SELECT USING (
    subject_id IN (
        SELECT sub.id FROM public.subjects sub
        JOIN public.students st ON st.section_id = sub.section_id
        WHERE st.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage classes" ON public.classes
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can manage own classes" ON public.classes
FOR ALL USING (teacher_id = auth.uid());

-- RLS Policies for attendance
CREATE POLICY "Students can view own attendance" ON public.attendance
FOR SELECT USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

CREATE POLICY "Teachers can manage attendance for their classes" ON public.attendance
FOR ALL USING (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
);

CREATE POLICY "Admins can manage all attendance" ON public.attendance
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for attendance_logs
CREATE POLICY "Teachers can view logs for their classes" ON public.attendance_logs
FOR SELECT USING (
    attendance_id IN (
        SELECT a.id FROM public.attendance a
        JOIN public.classes c ON a.class_id = c.id
        WHERE c.teacher_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all logs" ON public.attendance_logs
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs" ON public.attendance_logs
FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger function to log attendance changes
CREATE OR REPLACE FUNCTION public.log_attendance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO public.attendance_logs (attendance_id, previous_status, new_status, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NEW.override_reason);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for attendance changes
CREATE TRIGGER on_attendance_change
  AFTER UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.log_attendance_change();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();