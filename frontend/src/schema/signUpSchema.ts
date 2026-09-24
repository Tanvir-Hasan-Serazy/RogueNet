import * as z from "zod";

export const signUpSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(50, "First name must be at most 50 characters"),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(50, "Last name must be at most 50 characters"),
    username: z
      .string()
      .trim()
      .min(1, "Username is required")
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be at most 20 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers and underscores",
      ),
    email: z
      .string()
      .min(1, "Email is required")
      .trim()
      .toLowerCase()
      .pipe(z.email("Please enter a valid email address")),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(32, "Password must be at most 32 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    dob: z
      .string()
      .trim()
      .min(1, "Date of birth is required")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date")
      .refine((val) => {
        const [year, month, day] = val.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return (
          date.getFullYear() === year &&
          date.getMonth() === month - 1 &&
          date.getDate() === day
        );
      }, "Please enter a valid date")
      .refine(
        (val) => {
          const date = new Date(val);
          const now = new Date();
          return date <= now;
        },
        { message: "Date of birth cannot be in the future" },
      )
      .refine(
        (val) => {
          const dob = new Date(val);
          const now = new Date();
          let age = now.getFullYear() - dob.getFullYear();
          const m = now.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
            age--;
          }
          return age >= 13;
        },
        { message: "You must be at least 13 years old" },
      )
      .refine(
        (val) => {
          const dob = new Date(val);
          const now = new Date();
          let age = now.getFullYear() - dob.getFullYear();
          const m = now.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
            age--;
          }
          return age <= 120;
        },
        { message: "Please enter a valid date of birth" },
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
