# Domain Layer

Domain modules contain pure business rules that do not know about React,
Next.js, Prisma, generated database types, or HTTP. Keep them small and
framework-free so application use cases and infrastructure adapters can reuse
the same rules without pulling UI or persistence concerns inward.
