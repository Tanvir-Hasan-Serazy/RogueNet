"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import * as z from "zod";

import { ImageWithFallback } from "@/components/common/ImageWithFallback";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useLogin } from "@/hooks/use-login";
import { toast } from "@/components/ui/toast";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .trim()
    .toLowerCase()
    .pipe(z.email("Please enter a valid email address")),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { mutateAsync: signIn, isPending, error: signInError } = useLogin();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await signIn({
        email: data.email,
        password: data.password,
      });
      toast.add({ type: "success", description: "Login Successful!" });
      reset();
      router.push("/");
    } catch (error) {
      toast.add({ type: "warning", description: (error as Error).message });
      console.log(error);
    }
  };

  const handleGithubLogin = () => {
    // TODO: integrate with better-auth or next-auth
    console.log("Login with GitHub");
  };

  const handleGoogleLogin = () => {
    // TODO: integrate with better-auth or next-auth
    console.log("Login with Google");
  };

  return (
    <section className="bg-white flex flex-col lg:flex-row w-full min-h-screen">
      {/* Left - Image */}
      <div className="hidden lg:flex w-full lg:w-1/2 items-center justify-center p-6 lg:p-0">
        <ImageWithFallback
          className="object-cover rounded-2xl lg:rounded-none w-160 h-100 "
          src="/images/sign-up/plane.jpeg"
          alt="Airplane"
          width={1264}
          height={1000}
          loading="eager"
        />
      </div>
      {/* Mobile image - shown only on small screens */}
      <div className="w-full lg:hidden px-6 pt-6">
        <ImageWithFallback
          className="object-cover rounded-2xl w-full h-50 sm:h-65"
          src="/images/sign-up/plane.jpeg"
          alt="Airplane"
          width={1264}
          height={1000}
          loading="eager"
        />
      </div>

      {/* Right - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-8 lg:px-12 xl:px-16">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            <h1 className="text-2xl lg:text-4xl text-[#4E64EE] font-bold tracking-tight">
              Welcome to the RogueNet Community!
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              Please log in to continue
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            <FieldGroup className="gap-5">
              {/* Email */}
              <Field data-invalid={!!errors.email}>
                <FieldLabel
                  htmlFor="email"
                  className="text-sm font-medium leading-none"
                >
                  Email
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className="h-10 rounded-md border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-sm"
                  {...register("email")}
                />
                {errors.email && (
                  <FieldError
                    id="email-error"
                    errors={[{ message: errors.email.message }]}
                    className="text-sm font-medium"
                  />
                )}
              </Field>

              {/* Password */}
              <Field data-invalid={!!errors.password}>
                <div className="flex items-center justify-between">
                  <FieldLabel
                    htmlFor="password"
                    className="text-sm font-medium leading-none"
                  >
                    Password
                  </FieldLabel>
                  <Link
                    href="#"
                    tabIndex={-1}
                    className="text-xs font-medium text-[#4E64EE] hover:underline underline-offset-4"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    className="h-10 rounded-md border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-sm"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" weight="regular" />
                    ) : (
                      <EyeIcon className="h-5 w-5" weight="regular" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <FieldError
                    id="password-error"
                    errors={[{ message: errors.password.message }]}
                    className="text-sm font-medium"
                  />
                )}
              </Field>
            </FieldGroup>

            <Button
              type="submit"
              disabled={isSubmitting || isPending}
              className="w-full h-10 rounded-md bg-[#4E64EE] hover:bg-[#4E64EE]/90 text-white font-medium text-sm disabled:opacity-70"
            >
              {isSubmitting ? "Logging in..." : "Log In"}
            </Button>
          </form>

          {/* Divider - shadcn Separator */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGithubLogin}
              className="h-10 w-full gap-2 rounded-md border-input bg-background font-medium"
            >
              <FaGithub className="h-4 w-4" />
              GitHub
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              className="h-10 w-full gap-2 rounded-md border-input bg-background font-medium"
            >
              <FcGoogle className="h-4 w-4" />
              Google
            </Button>
          </div>

          {/* Signup */}
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-semibold text-[#4E64EE] hover:underline underline-offset-4"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default LoginPage;
