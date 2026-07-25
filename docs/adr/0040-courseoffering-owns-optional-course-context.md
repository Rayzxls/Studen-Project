# CourseOffering owns optional course context

Beagle Classroom will not require an Admin-managed Academic Year, Term, Class, or Homeroom Teacher structure before a Teacher can create a CourseOffering.

The centralized structure fit a single school calendar but made Admin a provisioning bottleneck and constrained tutors, universities, short courses, and other global use cases. The existing lazy Class upsert also treated matching free-text room names as one shared institutional Class even when Teachers did not intentionally share that object.

Teacher creates and owns a CourseOffering directly. Learner Group Label, Academic Period Label, and Credit Hours are independent optional metadata. Missing values are omitted from the interface. The labels describe one CourseOffering and do not create shared structural entities, grant permissions, determine lifecycle, or participate in aggregate GPA calculations.

CourseOffering lifecycle is Active or Archived. Archived courses preserve readable history and reject teaching and learning mutations until the owning Teacher restores them. Admin remains a read-only observer of CourseOfferings and does not create academic structure.

The current development dataset is disposable. Code dependencies move to CourseOffering before an explicitly approved database reset removes the retired Academic Year, Term, Class, and Homeroom Teacher persistence.
