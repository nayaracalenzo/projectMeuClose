import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const baseStyles =
    "rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed";

  const variantStyles = {
    primary: "bg-primary text-white shadow hover:bg-[#111111] focus:ring-primary",
    secondary:
      "bg-white text-primary border border-gray-300 shadow hover:bg-[#f7f7f7] focus:ring-gray-300",
    danger: "bg-[#BA1A1A] text-white shadow hover:bg-[#8f1515] focus:ring-[#BA1A1A]",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-md h-9",
    md: "px-4 py-2 text-md h-10",
    lg: "px-8 py-2 text-base h-11",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabled || isLoading ? "opacity-45" : ""} ${className ?? ""}`}
      {...props}
    >
      {isLoading ? "Carregando..." : children}
    </button>
  );
}
