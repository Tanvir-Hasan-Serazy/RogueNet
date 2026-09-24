import * as z from "zod";

const dateOfBirthSchema = z
  .string()
  .trim()
  .min(1, "Date of birth is required")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date")
  .refine((value) => {
    const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }, "Please enter a valid date")
  .refine((value) => new Date(`${value}T00:00:00`) <= new Date(), {
    message: "Date of birth cannot be in the future",
  })
  .refine((value) => {
    const dob = new Date(`${value}T00:00:00`);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const month = now.getMonth() - dob.getMonth();
    if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 13 && age <= 120;
  }, "You must be between 13 and 120 years old")
  .describe("Date of birth in YYYY-MM-DD format");

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(101),
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
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be at most 20 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers and underscores",
      ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Invalid email address")),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(32, "Password must be at most 32 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    dob: dateOfBirthSchema,
  })
  .passthrough()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email address")),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
});
