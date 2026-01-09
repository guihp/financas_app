interface LogoProps {
  variant?: "horizontal" | "icon" | "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Logo = ({ variant = "horizontal", size = "md", className = "" }: LogoProps) => {
  const sizeClasses = {
    sm: "h-6",
    md: "h-8", 
    lg: "h-12"
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  };

  // Logo IAFÉ Finanças baseada na imagem enviada
  const IafeLogo = () => {
    const isDark = variant === "dark" || variant === "light";
    
    if (variant === "icon") {
      return (
        <div className={`${className}`}>
          <svg viewBox="0 0 200 200" className={`${sizeClasses[size]} w-auto`}>
            <defs>
              <linearGradient id={`iafe-gradient-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="50%" stopColor="#fcd34d" />
                <stop offset="100%" stopColor="#fde047" />
              </linearGradient>
            </defs>
            
            {/* Círculo principal com sorriso */}
            <circle cx="80" cy="100" r="70" fill={`url(#iafe-gradient-${size})`} />
            
            {/* Círculo secundário */}
            <ellipse cx="140" cy="100" rx="50" ry="70" fill={`url(#iafe-gradient-${size})`} opacity="0.9" />
            
            {/* Sorriso */}
            <path 
              d="M 50 85 Q 80 115 110 85" 
              stroke="#92400e" 
              strokeWidth="8" 
              fill="none" 
              strokeLinecap="round"
            />
          </svg>
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <svg viewBox="0 0 200 200" className={`${sizeClasses[size]} w-auto flex-shrink-0`}>
          <defs>
            <linearGradient id={`iafe-gradient-${variant}-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#fcd34d" />
              <stop offset="100%" stopColor="#fde047" />
            </linearGradient>
          </defs>
          
          {/* Círculo principal com sorriso */}
          <circle cx="80" cy="100" r="70" fill={`url(#iafe-gradient-${variant}-${size})`} />
          
          {/* Círculo secundário */}
          <ellipse cx="140" cy="100" rx="50" ry="70" fill={`url(#iafe-gradient-${variant}-${size})`} opacity="0.9" />
          
          {/* Sorriso */}
          <path 
            d="M 50 85 Q 80 115 110 85" 
            stroke="#92400e" 
            strokeWidth="8" 
            fill="none" 
            strokeLinecap="round"
          />
        </svg>
        
        {variant === "horizontal" && (
          <span 
            className={`font-bold ${textSizes[size]} text-yellow-400`}
          >
            IAFÉ Finanças
          </span>
        )}
        
        {variant === "dark" && (
          <span 
            className={`font-bold ${textSizes[size]} text-yellow-400`}
          >
            IAFÉ Finanças
          </span>
        )}
        
        {variant === "light" && (
          <span 
            className={`font-bold ${textSizes[size]} text-yellow-400`}
          >
            IAFÉ Finanças
          </span>
        )}
      </div>
    );
  };

  return <IafeLogo />;
};