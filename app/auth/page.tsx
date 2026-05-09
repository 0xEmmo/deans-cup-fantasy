"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/utils/supabase/browser";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    department: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const departments = [
    { id: 1, name: "Philosophy" },
    { id: 2, name: "Engineering" },
    { id: 3, name: "Law" },
    { id: 5, name: "Business" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createBrowserSupabaseClient();

    try {
      if (isLogin) {
        // Handle Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        setMessage({
          type: "success",
          text: "Successfully signed in! Redirecting...",
        });

        // Redirect to home page after successful login
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      } else {
        // Handle Sign Up
        if (!formData.name || !formData.department) {
          throw new Error("Please fill in all required fields");
        }

        const selectedDept = departments.find(
          (d) => d.name === formData.department
        );

        if (!selectedDept) {
          throw new Error("Please select a valid department");
        }

        // Step 1: Create auth user via Supabase Auth.
        // We pass the name as user metadata so it's also available on the
        // auth.users record (some projects use a DB trigger to mirror this
        // into public.users automatically).
        const { data: authData, error: authError } =
          await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
              data: {
                name: formData.name,
                department_id: selectedDept.id,
              },
            },
          });

        if (authError) throw authError;

        if (!authData.user) {
          throw new Error("Failed to create user account");
        }

        // Step 2: Insert the user's extra details into our custom
        // public.users table. We use upsert + ignoreDuplicates so that
        // if a DB trigger has already created the row, we don't error.
        const { error: profileError } = await supabase
          .from("users")
          .upsert(
            {
              id: authData.user.id,
              name: formData.name,
              email: formData.email,
              department_id: selectedDept.id,
            },
            { onConflict: "id", ignoreDuplicates: false }
          );

        if (profileError) throw profileError;

        // If Supabase returns a user but no session, email confirmation
        // is required before sign-in.
        const needsEmailConfirmation = !authData.session;

        setMessage({
          type: "success",
          text: needsEmailConfirmation
            ? `Account created! Please check ${formData.email} to confirm your address before signing in.`
            : "Account created successfully! You can now sign in.",
        });

        // Clear form and switch to login mode
        setFormData({
          name: "",
          email: formData.email,
          password: "",
          department: "",
        });

        setTimeout(() => {
          setIsLogin(true);
        }, 2500);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred. Please try again.";
      setMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">
              Dean&apos;s Cup Fantasy
            </h1>
            <p className="text-indigo-100">
              {isLogin ? "Welcome back!" : "Join the competition"}
            </p>
          </div>

          {/* Toggle Buttons */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-4 text-center font-semibold transition-all ${
                isLogin
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-4 text-center font-semibold transition-all ${
                !isLogin
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              Register
            </button>
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`mx-8 mt-6 p-4 rounded-lg ${
                message.type === "error"
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-green-50 border border-green-200 text-green-700"
              }`}
            >
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Name Field - Only for Registration */}
            {!isLogin && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required={!isLogin}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                  placeholder="Enter your full name"
                />
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                placeholder="Enter your email"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                placeholder="Enter your password"
              />
            </div>

            {/* Department Dropdown - Only for Registration */}
            {!isLogin && (
              <div>
                <label
                  htmlFor="department"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Department
                </label>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  required={!isLogin}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none bg-white"
                >
                  <option value="">Select your department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Forgot Password Link - Only for Login */}
            {isLogin && (
              <div className="flex items-center justify-end">
                <a
                  href="#"
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Forgot password?
                </a>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transform hover:scale-[1.02] transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <span>{isLogin ? "Sign In" : "Create Account"}</span>
              )}
            </button>

            {/* Additional Info */}
            <p className="text-center text-sm text-gray-600 mt-4">
              {isLogin ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Register here
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Login here
                  </button>
                </>
              )}
            </p>
          </form>
        </div>

        {/* Footer Text */}
        <p className="text-center text-white text-sm mt-6 drop-shadow-lg">
          © 2026 Dean&apos;s Cup Fantasy. All rights reserved.
        </p>
      </div>
    </div>
  );
}
