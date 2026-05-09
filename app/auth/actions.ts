"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export interface SignUpResult {
  error: string | null;
  success: boolean;
}

export async function signUp(formData: FormData): Promise<SignUpResult> {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const departmentId = formData.get("department") as string;

  if (!name || !email || !password || !departmentId) {
    return { error: "All fields are required", success: false };
  }

  // Create the user with Supabase auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  if (authError || !authData.user) {
    return {
      error: authError?.message || "Failed to create account",
      success: false,
    };
  }

  // Insert extra user details into the public users table
  const { error: profileError } = await supabase.from("users").insert({
    id: authData.user.id,
    name,
    email,
    department_id: parseInt(departmentId, 10),
  });

  if (profileError) {
    // If profile creation fails, we might want to delete the auth user
    // For now, we'll just return the error
    return {
      error: profileError.message || "Failed to create profile",
      success: false,
    };
  }

  return { error: null, success: true };
}

export async function signIn(formData: FormData): Promise<{ error: string | null; success: boolean }> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required", success: false };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth");
}