import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-sans uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#1A1A1A] text-white hover:bg-[#333] rounded-none",
        destructive: "bg-transparent text-red-700 hover:bg-red-50 border border-red-700 rounded-none",
        outline: "border border-[#1A1A1A] bg-transparent text-[#1A1A1A] hover:bg-[#F9F9F9] rounded-none",
        secondary: "bg-[#F0F0F0] text-[#1A1A1A] hover:bg-[#E5E5E5] rounded-none",
        ghost: "hover:bg-[#F9F9F9] hover:text-[#1A1A1A] rounded-none",
        link: "text-[#1A1A1A] underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-10 px-5 py-2 text-[11px]",
        sm: "h-8 px-3 text-[10px]",
        lg: "h-12 px-8 text-xs font-semibold",
        xs: "h-6 px-2 text-[9px]",
        icon: "h-10 w-10 text-[11px]",
        "icon-sm": "h-8 w-8 text-[10px]",
        "icon-xs": "h-6 w-6 text-[9px]",
        "icon-lg": "h-12 w-12 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
