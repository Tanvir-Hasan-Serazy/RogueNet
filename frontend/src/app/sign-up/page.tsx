"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSignup } from "@/hooks/use-sign-up";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { CalendarDotsIcon, EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import * as z from "zod";
import { signUpSchema } from "@/schema/signUpSchema";
import { ImageWithFallback } from "@/components/common/ImageWithFallback";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

type SignUpFormValues = z.infer<typeof signUpSchema>;

const SignUpPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [dobOpen, setDobOpen] = useState(false);
  const { mutateAsync: signUp, isPending, error: signUpError } = useSignup();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      dob: "",
    },
  });

  const onSubmit = async (data: SignUpFormValues) => {
    try {
      await signUp({
        username: data.username,
        email: data.email,
        password: data.password,
        dob: data.dob,
      });
      toast.add({
        type: "success",
        description:
          "Registration successful! Check your email to verify your account.",
      });
      reset();
      router.push("/login");
    } catch (error) {
      toast.add({ type: "warning", description: (error as Error).message });
    }
    if (signUpError) {
      const msg = (signUpError as Error).message;
      console.log(msg);
    }
  };

  const handleGithubSignUp = async () => {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: `${window.location.origin}/`,
    });
  };

  const handleGoogleSignUp = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/`,
    });
  };

  const maxDobDate = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setFullYear(d.getFullYear() - 13);
    return d;
  })();
  const minDobDate = new Date("1900-01-01");

  return (
    <section className="bg-white flex flex-col lg:flex-row w-full min-h-screen">
      {/* Left - Image */}
      <div className="hidden lg:flex w-full lg:w-1/2 items-center justify-center p-6 lg:p-0 lg:sticky lg:top-0 lg:h-screen">
        <ImageWithFallback
          className="object-cover rounded-2xl lg:rounded-none w-160 h-100"
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
          {/* Header - same style as login */}
          <div className="space-y-2 text-center">
            <h1 className="text-2xl lg:text-4xl text-[#4E64EE] font-bold tracking-tight">
              Welcome to RogueNet!
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              Please sign up to continue
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            <FieldGroup className="gap-5">
              {/* Username */}
              <Field data-invalid={!!errors.username}>
                <FieldLabel
                  htmlFor="username"
                  className="text-sm font-medium leading-none"
                >
                  Username
                </FieldLabel>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="username"
                  aria-invalid={!!errors.username}
                  aria-describedby={
                    errors.username ? "username-error" : undefined
                  }
                  className="h-10 rounded-md border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-sm"
                  {...register("username")}
                />
                {errors.username && (
                  <FieldError
                    id="username-error"
                    errors={[{ message: errors.username.message }]}
                    className="text-sm font-medium"
                  />
                )}
              </Field>

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
                <FieldLabel
                  htmlFor="password"
                  className="text-sm font-medium leading-none"
                >
                  Password
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
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

              {/* Confirm Password */}
              <Field data-invalid={!!errors.confirmPassword}>
                <FieldLabel
                  htmlFor="confirmPassword"
                  className="text-sm font-medium leading-none"
                >
                  Confirm password
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    aria-invalid={!!errors.confirmPassword}
                    aria-describedby={
                      errors.confirmPassword
                        ? "confirmPassword-error"
                        : undefined
                    }
                    className="h-10 rounded-md border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-sm"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    aria-pressed={showConfirmPassword}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="h-5 w-5" weight="regular" />
                    ) : (
                      <EyeIcon className="h-5 w-5" weight="regular" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <FieldError
                    id="confirmPassword-error"
                    errors={[{ message: errors.confirmPassword.message }]}
                    className="text-sm font-medium"
                  />
                )}
              </Field>

              {/* Date of Birth - styled shadcn Calendar Popover */}
              <Controller
                control={control}
                name="dob"
                render={({ field }) => {
                  const selectedDate = field.value
                    ? new Date(field.value + "T00:00:00")
                    : undefined;
                  const isInvalid = !!errors.dob;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel
                        htmlFor="dob-trigger"
                        className="text-sm font-medium leading-none"
                      >
                        Date of birth
                      </FieldLabel>

                      <Popover open={dobOpen} onOpenChange={setDobOpen}>
                        <PopoverTrigger
                          render={
                            <Button
                              id="dob-trigger"
                              type="button"
                              variant="outline"
                              aria-invalid={isInvalid}
                              aria-describedby={
                                errors.dob ? "dob-error" : undefined
                              }
                              className={cn(
                                "h-10 w-full justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-normal ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-sm",
                                !field.value && "text-muted-foreground",
                                isInvalid &&
                                  "border-destructive ring-1 ring-destructive/20",
                              )}
                            />
                          }
                        >
                          <span className="flex w-full items-center justify-between">
                            <span>
                              {field.value && selectedDate
                                ? format(selectedDate, "PPP")
                                : "Pick a date"}
                            </span>
                            <CalendarDotsIcon className="h-4 w-4 shrink-0 opacity-60" />
                          </span>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 bg-white"
                          align="start"
                          sideOffset={8}
                        >
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              if (date) {
                                const yyyy = date.getFullYear();
                                const mm = String(date.getMonth() + 1).padStart(
                                  2,
                                  "0",
                                );
                                const dd = String(date.getDate()).padStart(
                                  2,
                                  "0",
                                );
                                field.onChange(`${yyyy}-${mm}-${dd}`);
                              } else {
                                field.onChange("");
                              }
                              setDobOpen(false);
                            }}
                            disabled={(date) =>
                              date > maxDobDate || date < minDobDate
                            }
                            captionLayout="dropdown"
                            startMonth={minDobDate}
                            endMonth={maxDobDate}
                            defaultMonth={
                              selectedDate ??
                              new Date(maxDobDate.getFullYear() - 5, 0, 1)
                            }
                            classNames={{
                              caption_label: "text-sm font-medium",
                            }}
                          />
                          <div className="flex items-center justify-between border-t border-border p-2">
                            <span className="px-2 text-xs text-muted-foreground">
                              {field.value
                                ? `Selected: ${format(selectedDate!, "PPP")}`
                                : "Select your birth date"}
                            </span>
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  field.onChange("");
                                  setDobOpen(false);
                                }}
                                className="h-7 text-xs"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {errors.dob && (
                        <FieldError
                          id="dob-error"
                          errors={[{ message: errors.dob.message }]}
                          className="text-sm font-medium"
                        />
                      )}
                    </Field>
                  );
                }}
              />
            </FieldGroup>

            <Button
              type="submit"
              disabled={isSubmitting || isPending}
              className="w-full h-10 rounded-md bg-[#4E64EE] hover:bg-[#4E64EE]/90 text-white font-medium text-sm disabled:opacity-70"
            >
              {isSubmitting ? "Creating account..." : "Sign Up"}
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
              onClick={handleGithubSignUp}
              className="h-10 w-full gap-2 rounded-md border-input bg-background font-medium"
            >
              <FaGithub className="h-4 w-4" />
              GitHub
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignUp}
              className="h-10 w-full gap-2 rounded-md border-input bg-background font-medium"
            >
              <FcGoogle className="h-4 w-4" />
              Google
            </Button>
          </div>

          {/* Login */}
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#4E64EE] hover:underline underline-offset-4"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default SignUpPage;
