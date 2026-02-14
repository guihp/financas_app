interface LogoProps {
  variant?: "horizontal" | "icon" | "light" | "dark";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const Logo = ({ variant = "horizontal", size = "md", className = "" }: LogoProps) => {
  // Sizes for full logo with text (Documento_3.png)
  const fullLogoSizes = {
    sm: "h-10",
    md: "h-14",
    lg: "h-20",
    xl: "h-28"
  };

  // Sizes for icon only (F_DE_FINANÇAS.png)
  const iconSizes = {
    sm: "h-8",
    md: "h-12",
    lg: "h-16",
    xl: "h-20"
  };

  if (variant === "icon") {
    // Just the F swoosh icon
    return (
      <div className={`flex items-center ${className}`}>
        <img 
          src="/F_DE_FINANÇAS.png" 
          alt="IAFÉ Finanças" 
          className={`${iconSizes[size]} w-auto object-contain`}
        />
      </div>
    );
  }

  // horizontal, light, dark all show full logo with "IAFÉ FINANÇAS" text
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src="/Documento_3.png" 
        alt="IAFÉ Finanças" 
        className={`${fullLogoSizes[size]} w-auto object-contain`}
      />
    </div>
  );
};
