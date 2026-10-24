'use client';

/**
 * @file button.tsx
 * @description Botón accesible y táctil con sistema de 8 estados de retroalimentación
 * y área mínima táctil de 48px según directrices ergonómicas de DESIGN.md.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 ease-out select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground font-semibold shadow-sm hover:brightness-110 active:brightness-95',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
        outline:
          'border border-border bg-transparent hover:bg-secondary hover:text-foreground',
        ghost:
          'hover:bg-secondary hover:text-foreground border border-transparent',
        destructive:
          'bg-destructive text-destructive-foreground hover:brightness-110 active:brightness-95',
        subtle:
          'bg-accent text-accent-foreground hover:bg-accent/80',
      },
      size: {
        default: 'h-12 min-h-[48px] px-5 py-2.5 min-w-[48px]', // Ergonómico 48px
        sm: 'h-10 min-h-[40px] px-3.5 py-1.5 text-xs',
        lg: 'h-14 min-h-[56px] px-7 py-3 text-base',
        icon: 'h-12 w-12 min-h-[48px] min-w-[48px] p-0 flex items-center justify-center', // Tap target 48x48
        'icon-sm': 'h-9 w-9 min-h-[36px] min-w-[36px] p-0 flex items-center justify-center',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
