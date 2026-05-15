/**
 * Insignia de usuario verificado
 * Muestra un ícono azul con check cuando el usuario está verificado
 */
export function VerifiedBadge({ size = 'md', className = '', isOfficial = false }: { size?: 'sm' | 'md' | 'lg'; className?: string; isOfficial?: boolean }) {
  const sizeClasses = {
    sm: 'h-3 w-3 p-0.5',
    md: 'h-4 w-4 p-1',
    lg: 'h-5 w-5 p-1.5',
  };

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  if (isOfficial) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-green-500 text-white ${sizeClasses[size]} ${className}`}
        title="Tienda Oficial"
        aria-label="Tienda Oficial"
      >
        <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-green-500 ${sizeClasses[size]} ${className}`}
      title="Usuario verificado"
      aria-label="Usuario verificado"
    >
      <svg className={`${iconSizes[size]} text-white`} fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
