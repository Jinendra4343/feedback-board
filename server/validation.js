import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
  role: z.enum(['designer', 'client']).default('client'),
});

export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createBoardSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
  clientEmail: z.union([z.email('Invalid client email'), z.literal('')]).optional(),
});

export const commentSchema = z.object({
  text: z.string().trim().min(1, 'Feedback text is required').max(2000, 'Feedback is too long'),
  x: z.number().min(0, 'Pin must be inside the design').max(100, 'Pin must be inside the design'),
  y: z.number().min(0, 'Pin must be inside the design').max(100, 'Pin must be inside the design'),
});

export const statusSchema = z.object({
  status: z.enum(['pending', 'in_review', 'approved'], { message: 'Invalid status' }),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message });
    }
    req.body = result.data;
    next();
  };
}
