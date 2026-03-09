
-- Enable RLS on face_embeddings
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;

-- Admins can fully manage face embeddings
CREATE POLICY "Admins can manage face embeddings"
  ON public.face_embeddings
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Teachers can read embeddings for students in their sections
CREATE POLICY "Teachers can read embeddings for their students"
  ON public.face_embeddings
  FOR SELECT
  USING (
    id IN (
      SELECT s.face_embedding_id FROM public.students s
      JOIN public.subjects sub ON sub.section_id = s.section_id
      WHERE sub.teacher_id = auth.uid()
    )
  );
